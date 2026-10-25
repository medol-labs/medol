import { allContextSlices } from '../../lib/dslParser';
import type { EmElement, EmEligibility, EmModel, MedolSourceRange } from '../../lib/model';
import { buildBehaviorReviews } from '../../lib/behaviorSemantics';

export type Evidence = 'declared' | 'inferred' | 'unknown';
export interface AnalysisSource {
  id: string;
  name: string;
  range?: MedolSourceRange;
}
export interface AnalysisOwner extends AnalysisSource {
  contextId: string;
  contextName: string;
  kind: 'concept' | 'aggregate';
  states: string[];
  sliceIds: string[];
}
export interface LifecycleOperation {
  id: string;
  contextId: string;
  ownerId: string;
  sliceId: string;
  source: AnalysisSource;
  startsLifecycle: boolean;
  fromStates: string[];
  evidence: Evidence;
  reason: string;
  triggers: AnalysisSource[];
  events: AnalysisSource[];
  to?: string;
  outcomeEvidence: Evidence;
  port: boolean;
}
export interface ReferenceUsage {
  id: string;
  contextId: string;
  sliceId: string;
  command: AnalysisSource;
  field: string;
  sourcePath: string;
  projectionIds: string[];
  evidence: Evidence;
  reason: string;
  selected?: EmEligibility;
  matchingProfiles: string[];
}
export interface AnalysisProjection extends AnalysisSource {
  ownerIds: string[];
  contextId: string;
  contextName: string;
  sliceId: string;
  eligibility: EmEligibility[];
}
export interface AnalysisIssue {
  code?: string;
  id: string;
  severity: 'warning' | 'info';
  contextId?: string;
  ownerId?: string;
  sliceId?: string;
  source: AnalysisSource;
  message: string;
}
export interface ModelAnalysis {
  owners: AnalysisOwner[];
  operations: LifecycleOperation[];
  projections: AnalysisProjection[];
  references: ReferenceUsage[];
  issues: AnalysisIssue[];
}

const sourceOf = (item: { id: string; name: string; sourceRange?: MedolSourceRange }): AnalysisSource => ({
  id: item.id, name: item.name, range: item.sourceRange
});
const profileKey = (text: string) => text.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();

// Profile selection mirrors command/slice matching and default fallback, not conjunction.
export const selectEligibility = (rules: EmEligibility[], command: AnalysisSource, slice: AnalysisSource) => {
  const keys = new Set([command.id, command.name, slice.id, slice.name].map(profileKey));
  const matches = rules.filter((rule) => rule.profile && keys.has(profileKey(rule.profile)));
  return { selected: matches[0] ?? rules.find((rule) => !rule.profile), matches };
};

export function analyzeModel(model: EmModel): ModelAnalysis {
  const result: ModelAnalysis = { owners: [], operations: [], projections: [], references: [], issues: [] };
  const records = model.contexts.flatMap((context) => [
    ...allContextSlices(context),
    ...(context.looseElements.length ? [{ id: context.id, name: context.name, sourceRange: context.sourceRange,
      tags: [], hotspots: [], elements: context.looseElements }] : [])
  ].map((slice) => ({ context, slice })));
  const elements = new Map(records.flatMap(({ slice }) => slice.elements.map((element) => [element.id, { element, slice }] as const)));
  const projections = records.flatMap(({ context, slice }) => slice.elements
    .filter((element) => element.kind === 'readmodel')
    .map((element) => ({ context, slice, element })));
  const addIssue = (issue: Omit<AnalysisIssue, 'id'>) => {
    result.issues.push({ ...issue, id: `analysis:${result.issues.length}:${issue.source.id}` });
  };
  for (const review of buildBehaviorReviews(model)) addIssue({ ...review, severity: 'info' });

  for (const context of model.contexts) {
    result.owners.push(...context.aggregates.map((owner): AnalysisOwner => ({
      ...sourceOf(owner), contextId: context.id, contextName: context.name, kind: 'aggregate',
      states: owner.states, sliceIds: owner.slices.map((slice) => slice.id)
    })), ...context.concepts.map((owner): AnalysisOwner => ({
      ...sourceOf(owner), contextId: context.id, contextName: context.name, kind: 'concept',
      states: owner.states, sliceIds: owner.sliceIds
    })));
  }

  for (const owner of result.owners) {
    const slices = records.filter(({ context, slice }) => context.id === owner.contextId && owner.sliceIds.includes(slice.id));
    for (const { slice } of slices) {
      const triggers = model.edges.filter((edge) => edge.label === 'reactsTo' && slice.elements.some((item) => item.id === edge.target))
        .map((edge) => ({ id: edge.source, record: elements.get(edge.source) }));
      const fromStates: string[] = [];
      const reasons: string[] = [];
      for (const trigger of triggers) {
        const record = trigger.record;
        if (!record || record.element.kind !== 'event') {
          reasons.push('The trigger event cannot be resolved');
        } else if (!owner.sliceIds.includes(record.slice.id)) {
          reasons.push('The trigger event belongs to another business object and does not establish the current object state');
        } else if (record.slice.elements.filter((item) => item.kind === 'event').length !== 1) {
          reasons.push('The source slice of the trigger has multiple events; their state mapping is unclear');
        } else if (!record.slice.resultingState || !owner.states.includes(record.slice.resultingState)) {
          reasons.push('The trigger event is not associated with a declared state of this object');
        } else {
          fromStates.push(record.slice.resultingState);
        }
      }
      const events = slice.elements.filter((item) => item.kind === 'event');
      const evidence: Evidence = slice.startsLifecycle ? 'declared'
        : triggers.length > 0 && reasons.length === 0 ? 'inferred' : 'unknown';
      const reason = slice.startsLifecycle ? 'startsLifecycle explicitly declares the lifecycle entry'
        : triggers.length === 0 ? 'No trigger relationship establishes a precondition state'
          : reasons.length ? [...new Set(reasons)].join('; ') : 'Source event history inferred from reactsTo. It does not declare a current-state precondition or authorize this operation.';
      for (const command of slice.elements.filter((item) => item.kind === 'command')) {
        result.operations.push({
          id: `${owner.id}:${command.id}`, contextId: owner.contextId, ownerId: owner.id, sliceId: slice.id,
          source: sourceOf(command), startsLifecycle: Boolean(slice.startsLifecycle),
          fromStates: [...new Set(fromStates)], evidence, reason,
          triggers: triggers.map(({ id, record }) => record ? sourceOf(record.element) : { id, name: id }),
          events: events.map(sourceOf), to: slice.resultingState,
          outcomeEvidence: slice.resultingState && events.length === 1 && owner.states.includes(slice.resultingState) ? 'declared' : 'unknown',
          port: Boolean(slice.port)
        });
      }
      if (slice.resultingState && events.length !== 1) addIssue({
        severity: 'warning', contextId: owner.contextId, ownerId: owner.id, sliceId: slice.id, source: sourceOf(slice),
        message: 'The slice declares a resulting state without a unique event mapping. The state effect of each event is unresolved.'
      });
      if (!slice.startsLifecycle && evidence === 'unknown' && slice.elements.some((item) => item.kind === 'command') && owner.states.length) addIssue({
        severity: 'info', contextId: owner.contextId, ownerId: owner.id, sliceId: slice.id, source: sourceOf(slice),
        message: `Precondition state is unknown: ${reason}. This does not mean the operation is allowed in every state.`
      });
      if (slice.port) addIssue({
        severity: 'info', contextId: owner.contextId, ownerId: owner.id, sliceId: slice.id, source: sourceOf(slice),
        message: 'An external port is involved. Model relationships do not verify its implementation or runtime outcome.'
      });
    }
  }

  result.projections = projections.map(({ context, slice, element }) => ({
    ...sourceOf(element), contextId: context.id, contextName: context.name, sliceId: slice.id,
    ownerIds: result.owners.filter((owner) => owner.contextId === context.id && (owner.sliceIds.includes(slice.id)
      || element.fields.some((field) => field.type === `${owner.name}.State`))).map((owner) => owner.id),
    eligibility: element.eligibility ?? []
  }));

  for (const { context, slice } of records) {
    for (const command of slice.elements.filter((item) => item.kind === 'command')) {
      for (const field of command.fields.filter((item) => item.mapping?.kind === 'from')) {
        for (const path of new Set(field.mapping?.sources ?? [])) {
          const parts = path.split('.');
          const fieldName = parts.pop();
          const ownerName = parts.pop();
          const contextName = parts.join('.');
          // Never silently pick the first projection when names collide across contexts.
          const matches = projections.filter((item) => (!contextName || item.context.name === contextName)
            && item.element.name === ownerName && item.element.fields.some((candidate) => candidate.name === fieldName));
          const compatible = projections.filter((item) => (!contextName || item.context.name === contextName)
            && projectionNameMatches(item.element, ownerName ?? '') && item.element.fields.some((candidate) => candidate.name === fieldName));
          const candidates = matches.length ? matches : compatible;
          const compatibilityRisk = matches.length === 1 && compatible.length > 1;
          const selected = candidates.length === 1 ? selectEligibility(candidates[0].element.eligibility ?? [], sourceOf(command), sourceOf(slice)) : undefined;
          const exact = matches.length === 1;
          const reference: ReferenceUsage = {
            id: `${command.id}:${field.name}:${path}`, contextId: context.id, sliceId: slice.id,
            command: { ...sourceOf(command), range: field.sourceRange ?? command.sourceRange }, field: field.name, sourcePath: path,
            projectionIds: candidates.map((item) => item.element.id),
            evidence: candidates.length !== 1 ? 'unknown' : exact ? 'declared' : 'inferred',
            reason: candidates.length > 1 ? 'Multiple projection candidates exist. Qualify the context; no candidate is selected automatically'
              : candidates.length === 0 ? 'No projection field resolved. The source may be an event or another element; this is not necessarily an error'
                : compatibilityRisk ? 'Resolved by the exact model reference. Generator name matching has additional candidates; verify the generated implementation'
                  : exact ? 'The from mapping of the field explicitly references the projection' : 'A candidate was found only through generator-compatible name matching; review the reference',
            selected: selected?.selected, matchingProfiles: selected?.matches.map((rule) => rule.profile!) ?? []
          };
          result.references.push(reference);
          if (selected?.selected?.profile && candidates[0].element.eligibility?.some((rule) => !rule.profile)) addIssue({
            code: 'profile-replaces-default', severity: 'info', contextId: context.id, sliceId: slice.id, source: reference.command,
            message: `Profile ${selected.selected.profile} replaces the default eligibility condition for ${field.name}. Shared baseline constraints are not implicitly added; review whether the selected profile states the complete business requirement.`
          });
          if (compatibilityRisk) addIssue({
            severity: 'warning', contextId: context.id, sliceId: slice.id, source: reference.command,
            message: `Field ${field.name} explicitly references ${path}, but generator name matching also finds ${compatible.map((item) => `${item.context.name}.${item.element.name}`).join(', ')}. Conditions shown follow the exact reference; verify the generated implementation.`
          });
          if (candidates.length > 1 || selected && selected.matches.length > 1) addIssue({
            severity: 'warning', contextId: context.id, sliceId: slice.id, source: reference.command,
            message: candidates.length > 1 ? `Field ${field.name} has an ambiguous projection source: ${path}.`
              : `Field ${field.name} matches multiple business profiles: ${reference.matchingProfiles.join(', ')}. The current generator uses the first declared match.`
          });
          if (candidates.length === 1 && !exact) addIssue({
            severity: 'info', contextId: context.id, sliceId: slice.id, source: reference.command, message: reference.reason
          });
        }
      }
    }
  }

  for (const projection of result.projections) {
    const uses = result.references.filter((item) => item.projectionIds.length === 1 && item.projectionIds[0] === projection.id);
    for (const rule of projection.eligibility) {
      const matchingCommands = records.flatMap(({ slice }) => slice.elements.filter((item) => item.kind === 'command')
        .filter((command) => selectEligibility([rule], sourceOf(command), sourceOf(slice)).selected === rule));
      if (rule.profile && matchingCommands.length === 0) addIssue({
        severity: 'warning', contextId: projection.contextId, sliceId: projection.sliceId, source: projection,
        message: `Business profile ${rule.profile} matches no command or slice and is not used as the default selection condition.`
      });
      else if (!uses.some((item) => item.selected === rule)) addIssue({
        severity: 'info', contextId: projection.contextId, sliceId: projection.sliceId, source: projection,
        message: `${rule.profile ? `Business profile ${rule.profile}` : 'Default condition'} has no resolved consumer through direct field references. This does not prove the rule is invalid or ungenerated; review row actions and other reference mechanisms.`
      });
    }
  }

  // Existing parser/semantic diagnostics remain the authority; expose them without reimplementing validation.
  for (const diagnostic of model.diagnosticDetails) {
    const line = diagnostic.range?.start.line;
    const containingOwner = result.owners.find((owner) => line !== undefined && owner.range
      && (!diagnostic.sourceName || owner.range.sourceName === diagnostic.sourceName)
      && owner.range.start.line <= line && owner.range.end.line >= line);
    const containing = records.filter(({ slice }) => line !== undefined && slice.sourceRange
      && (!diagnostic.sourceName || slice.sourceRange.sourceName === diagnostic.sourceName)
      && slice.sourceRange.start.line <= line && slice.sourceRange.end.line >= line)[0];
    const context = containing?.context ?? model.contexts.find((item) => line !== undefined && item.sourceRange
      && (!diagnostic.sourceName || item.sourceRange.sourceName === diagnostic.sourceName)
      && item.sourceRange.start.line <= line && item.sourceRange.end.line >= line);
    addIssue({ severity: 'warning', contextId: context?.id, ownerId: containingOwner?.id, sliceId: containing?.slice.id,
      source: { id: containing?.slice.id ?? containingOwner?.id ?? context?.id ?? 'model', name: containing?.slice.name ?? containingOwner?.name ?? context?.name ?? 'Model diagnostic',
        range: diagnostic.range ? { ...diagnostic.range, sourceName: diagnostic.sourceName } : undefined },
      message: diagnostic.message });
  }
  return result;
}

function projectionNameMatches(element: EmElement, name: string): boolean {
  const key = profileKey(name);
  if (!key) return false;
  return [element.name, element.id].map(profileKey).some((candidate) => candidate === key
    || candidate.startsWith(key) || candidate.endsWith(key) || key.startsWith(candidate) || key.endsWith(candidate));
}

export interface AnalysisScope { contextId?: string; ownerId?: string; sliceId?: string }
export function scopeAnalysis(analysis: ModelAnalysis, scope: AnalysisScope): ModelAnalysis {
  const owners = analysis.owners.filter((owner) => (!scope.contextId || owner.contextId === scope.contextId)
    && (!scope.ownerId || owner.id === scope.ownerId) && (!scope.sliceId || owner.sliceIds.includes(scope.sliceId)));
  const ownerSlices = scope.ownerId ? new Set(owners.flatMap((owner) => owner.sliceIds)) : undefined;
  const inScope = (contextId: string | undefined, sliceId: string | undefined) => (!scope.contextId || scope.contextId === contextId)
    && (!scope.sliceId || scope.sliceId === sliceId) && (!ownerSlices || Boolean(sliceId && ownerSlices.has(sliceId)));
  const references = analysis.references.filter((item) => inScope(item.contextId, item.sliceId));
  const operations = analysis.operations.filter((item) => inScope(item.contextId, item.sliceId)
    && (!scope.ownerId || item.ownerId === scope.ownerId));
  const ownProjections = analysis.projections.filter((item) => inScope(item.contextId, item.sliceId)
    || Boolean(scope.ownerId && !scope.sliceId && item.ownerIds.includes(scope.ownerId)));
  const projectionIds = new Set([...ownProjections.map((item) => item.id), ...references.flatMap((item) => item.projectionIds)]);
  const projections = analysis.projections.filter((item) => projectionIds.has(item.id));
  const visibleReferences = analysis.references.filter((item) => references.includes(item)
    || item.projectionIds.some((id) => ownProjections.some((projection) => projection.id === id)));
  return {
    owners, operations, projections,
    references: visibleReferences,
    issues: analysis.issues.filter((item) => !item.contextId || inScope(item.contextId, item.sliceId) || item.source.id === scope.ownerId
      || projections.some((projection) => projection.id === item.source.id)
      || visibleReferences.some((reference) => reference.command.id === item.source.id))
  };
}
