import type { EmContext, EmElement, EmField, EmModel, EmSlice, MedolSourceRange } from './model';

export interface LineageField {
  id: string;
  elementId: string;
  elementName: string;
  kind: EmElement['kind'];
  section: 'field' | 'result';
  contextId: string;
  contextName: string;
  sliceId?: string;
  name: string;
  type: string;
  range?: MedolSourceRange;
  origin: 'input' | 'generated' | 'port' | 'mapping' | 'derived' | 'inferred' | 'unknown';
  reason: string;
}

export interface LineageLink {
  source: string;
  target: string;
  evidence: 'declared' | 'inferred';
  path: string;
}

export interface CompletenessDiagnostic {
  code: string;
  severity: 'error' | 'warning';
  fieldId: string;
  message: string;
}

export interface FieldLineage {
  fields: LineageField[];
  links: LineageLink[];
  diagnostics: CompletenessDiagnostic[];
}

interface RecordEntry {
  context: EmContext;
  slice?: EmSlice;
  element: EmElement;
}

const fieldId = (element: EmElement, field: EmField, section: LineageField['section'] = 'field') => `${element.id}/${section}/${field.name}`;

export class FieldSourceValidationError extends Error {
  readonly diagnostics: Array<CompletenessDiagnostic & { range?: MedolSourceRange }>;

  constructor(lineage: FieldLineage) {
    const diagnostics = lineage.diagnostics.filter((item) => item.severity === 'error').map((item) => ({
      ...item, range: lineage.fields.find((field) => field.id === item.fieldId)?.range
    }));
    super(diagnostics.map((item) => `[${item.code}] ${item.message}`).join('\n'));
    this.name = 'FieldSourceValidationError';
    this.diagnostics = diagnostics;
  }
}

// This graph describes declared dependencies, not runtime availability or business approval.
export function analyzeFieldLineage(model: EmModel): FieldLineage {
  const result: FieldLineage = { fields: [], links: [], diagnostics: [] };
  const records: RecordEntry[] = model.contexts.flatMap((context) => [
    ...[...context.slices, ...context.aggregates.flatMap((owner) => owner.slices)]
      .flatMap((slice) => slice.elements.map((element) => ({ context, slice, element }))),
    ...context.looseElements.map((element) => ({ context, element }))
  ]);
  const byId = new Map(records.map((record) => [record.element.id, record]));
  const sourceRecords = records.filter(({ element }) => ['command', 'event', 'readmodel'].includes(element.kind)
    || (element.kind === 'screen' && element.fields.length > 0));
  const domains = new Map(model.domains.flatMap((domain) => domain.contexts.map((context) => [context.id, domain.name] as const)));
  const addDiagnostic = (node: LineageField, code: string, severity: 'error' | 'warning', message: string) => {
    result.diagnostics.push({ fieldId: node.id, code, severity,
      message: `${node.contextName}.${node.elementName}.${node.section === 'result' ? 'result.' : ''}${node.name}: ${message}` });
  };
  const incoming = (id: string, labels: string[]) => model.edges
    .filter((edge) => edge.target === id && labels.includes(edge.label ?? ''))
    .map((edge) => byId.get(edge.source)).filter((record): record is RecordEntry => Boolean(record));
  const resolveElements = (name: string, context: EmContext): RecordEntry[] => {
    const qualified = sourceRecords.filter((record) => `${record.context.name}.${record.element.name}` === name
      || `${domains.get(record.context.id)}.${record.context.name}.${record.element.name}` === name);
    if (qualified.length) return qualified;
    const local = sourceRecords.filter((record) => record.context.id === context.id && record.element.name === name);
    return local.length ? local : sourceRecords.filter((record) => record.element.name === name);
  };
  const resolvePath = (path: string, record: RecordEntry): { ids: string[]; state?: boolean; ambiguous?: boolean } => {
    const parts = path.split('.');
    if (parts.length === 1) {
      const field = record.element.fields.find((item) => item.name === path);
      if (field) return { ids: [fieldId(record.element, field)] };
    }
    // Resolve the longest exact element prefix; never normalize or fuzzy-match names.
    for (let split = parts.length - 1; split >= 1; split--) {
      const candidates = resolveElements(parts.slice(0, split).join('.'), record.context);
      if (!candidates.length) continue;
      const ids = candidates.flatMap((candidate) => {
        let field = candidate.element.fields.find((item) => item.name === parts[split]);
        if (!field) return [];
        const root = field;
        for (const member of parts.slice(split + 1)) {
          const valueType = candidate.context.valueTypes.find((item) => item.name === field!.type);
          field = valueType?.fields.find((item) => item.name === member);
          if (!field) return [];
        }
        return [fieldId(candidate.element, root)];
      });
      return { ids: [...new Set(ids)], ambiguous: candidates.length > 1 };
    }
    const ownerName = parts.slice(0, -1).join('.');
    const allOwners = model.contexts.flatMap((context) => [
      ...context.concepts.map((owner) => ({ context, owner, sliceIds: owner.sliceIds })),
      ...context.aggregates.map((owner) => ({ context, owner, sliceIds: owner.slices.map((slice) => slice.id) }))
    ]);
    const localOwners = allOwners.filter((item) => item.context.id === record.context.id && item.owner.name === ownerName);
    const owners = localOwners.length ? localOwners : allOwners.filter((item) => item.owner.name === ownerName
      || `${item.context.name}.${item.owner.name}` === ownerName
      || `${domains.get(item.context.id)}.${item.context.name}.${item.owner.name}` === ownerName);
    const sliceIds = new Set(owners.flatMap((item) => item.sliceIds));
    const stateFields = records.filter((candidate) => candidate.slice && sliceIds.has(candidate.slice.id) && candidate.element.kind === 'event')
      .flatMap((candidate) => candidate.element.fields.filter((field) => field.name === parts.at(-1))
        .map((field) => fieldId(candidate.element, field)));
    return { ids: [...new Set(stateFields)], state: owners.length === 1, ambiguous: owners.length > 1 };
  };

  for (const record of records) {
    const { element, context, slice } = record;
    if (!['command', 'event', 'readmodel', 'screen'].includes(element.kind)) continue;
    const automations = incoming(element.id, ['emits']).filter((item) => item.element.kind === 'automation');
    const fields = [...element.fields.map((field) => ({ field, section: 'field' as const })),
      ...(element.resultFields ?? []).map((field) => ({ field, section: 'result' as const }))];
    for (const { field, section } of fields) {
      const node: LineageField = { id: fieldId(element, field, section), elementId: element.id, elementName: element.name,
        kind: element.kind, contextId: context.id, contextName: context.name, sliceId: slice?.id,
        section,
        name: field.name, type: field.type, range: field.sourceRange ?? element.sourceRange,
        origin: 'unknown', reason: 'No field source is declared.' };
      result.fields.push(node);
      const link = (ids: string[], evidence: LineageLink['evidence'], path: string) => {
        for (const source of ids) if (!result.links.some((item) => item.source === source && item.target === node.id && item.path === path)) {
          result.links.push({ source, target: node.id, evidence, path });
        }
      };
      if (field.mapping) {
        node.origin = field.mapping.kind === 'derived' ? 'derived' : 'mapping';
        node.reason = field.mapping.rule ?? (field.mapping.lookup ? 'Declared lookup; runtime lookup behavior is not verified.' : 'Explicit field mapping.');
        if (!field.mapping.sources.length) {
          addDiagnostic(node, 'source-missing', 'warning', 'Derivation has no structured source; a prose rule is not an executable dependency.');
        }
        for (const path of field.mapping.sources) {
          // A fan-out alias refers to members of the explicitly declared source list.
          // Its lexical binding takes precedence over a board element with the same name.
          const bindings: Array<string | undefined> = [];
          for (const automation of automations) {
            for (const [key, alias] of Object.entries(automation.element.metadata ?? {})) {
              if (!key.startsWith('fanOutAlias') || (path !== alias && !path.startsWith(`${alias}.`))) continue;
              const source = automation.element.metadata?.[`fanOutSource${key.slice('fanOutAlias'.length)}`];
              bindings.push(source ? `${source}${path === alias ? '' : path.slice(alias.length)}` : undefined);
            }
          }
          const candidates = bindings.length
            ? bindings.map((binding) => binding ? resolvePath(binding, record) : { ids: [] })
            : [resolvePath(element.syncSource && !path.includes('.') ? `${element.syncSource}.${path}` : path, record)];
          const resolved = { ids: [...new Set(candidates.flatMap((item) => item.ids))],
            state: candidates.every((item) => 'state' in item && item.state),
            ambiguous: candidates.some((item) => 'ambiguous' in item && item.ambiguous) };
          if (resolved.ambiguous || (resolved.ids.length > 1 && !resolved.state)) {
            addDiagnostic(node, 'source-ambiguous', 'error', `Source ${path} is ambiguous; qualify its context.`);
          } else if (candidates.some((item) => !item.ids.length)) {
            addDiagnostic(node, 'source-unresolved', 'error', `Source ${path} does not resolve to a declared field.`);
          } else {
            link(resolved.ids, resolved.state ? 'inferred' : 'declared', path);
            if (resolved.state) addDiagnostic(node, 'state-history', 'warning', `Source ${path} references state history; current-state availability and merge behavior require review.`);
          }
        }
      } else if (element.kind === 'event' && context.name === 'Scheduling' && model.capabilityImports?.some(i => i.name === 'Scheduling')) {
        node.origin = 'generated';
        node.reason = 'Supplied by the built-in scheduling decision using authoritative event-sourced state.';
      } else if (element.kind === 'event' && ['OrganizationManagement','SystemConfiguration','BusinessCalendar'].includes(context.name) && model.capabilityImports?.some(i => i.name === context.name)) {
        node.origin = 'generated';
        node.reason = 'Supplied by the authoritative management transaction and durable event outbox.';
      } else if (element.kind === 'event' && context.name === 'DocumentGeneration' && model.capabilityImports?.some(i => i.name === 'DocumentGeneration')) {
        node.origin = 'port';
        node.reason = 'Supplied by the transactional document runtime and its outbox; generation data snapshots remain private.';
      } else if (element.kind === 'event' && context.name === 'Numbering'
        && model.capabilityImports?.some(imported => imported.name === 'Numbering')) {
        node.origin = 'generated';
        node.reason = 'Supplied by the transactional numbering service and its outbox.';
      } else if (element.kind === 'readmodel' && context.name === 'OperationAudit'
        && element.name === 'OperationAuditCatalog'
        && model.capabilityImports?.some(imported => imported.name === 'OperationAudit')) {
        node.origin = 'generated';
        node.reason = 'Projected by the imported operation-audit AuditTrailProjection from business and operation-result events.';
      } else if (field.attributes.includes('generated')) {
        node.origin = 'generated';
        node.reason = 'Explicit generated attribute; generation behavior is not verified.';
      } else if (field.attributes.includes('portOutput')) {
        node.origin = 'port';
        node.reason = 'Explicit port output; adapter implementation is not verified.';
        if (!slice?.port) addDiagnostic(node, 'port-missing', 'warning', 'portOutput is declared outside a port slice.');
      } else if (section === 'result') {
        node.reason = 'Command result has no declared supplier.';
      } else if (element.kind === 'command' && !automations.length) {
        node.origin = field.attributes.includes('technical') ? 'unknown' : 'input';
        node.reason = node.origin === 'input' ? 'Command boundary input; this does not prove a UI supplies it.' : 'Technical command input has no declared supplier.';
      } else {
        let upstream = incoming(element.id, ['emits', 'updates', 'reactsTo']);
        for (const automation of automations) upstream.push(...incoming(automation.element.id, ['triggers', 'reactsTo']));
        if (element.syncSource) upstream.push(...resolveElements(element.syncSource, context));
        const ids = [...new Set(upstream.flatMap((candidate) => candidate.element.fields
          .filter((source) => source.name === field.name && source.type === field.type
            && (source.cardinality ?? 'Single') === (field.cardinality ?? 'Single'))
          .map((source) => fieldId(candidate.element, source))))];
        if (ids.length) {
          node.origin = 'inferred';
          node.reason = 'Same-name, same-type candidate along an explicit relationship; assignment is not declared.';
          link(ids, 'inferred', field.name);
          if (ids.length > 1) addDiagnostic(node, 'source-inferred', 'warning', 'Multiple relationship-based candidates supply this field; confirm assignment and merge behavior.');
        }
      }
      if (node.origin === 'unknown') addDiagnostic(node, 'source-unknown', 'warning', node.reason);
    }
  }

  // A dependency loop may represent historical state, not an invalid runtime cycle.
  const explicit = new Map<string, string[]>();
  for (const link of result.links.filter((item) => item.evidence === 'declared')) {
    explicit.set(link.target, [...(explicit.get(link.target) ?? []), link.source]);
  }
  const visited = new Set<string>();
  const active = new Set<string>();
  const cyclic = new Set<string>();
  const stack: string[] = [];
  const visit = (id: string) => {
    if (active.has(id)) {
      for (const item of stack.slice(stack.indexOf(id))) cyclic.add(item);
      return;
    }
    if (visited.has(id)) return;
    active.add(id);
    stack.push(id);
    for (const source of explicit.get(id) ?? []) visit(source);
    stack.pop();
    active.delete(id);
    visited.add(id);
  };
  for (const node of result.fields) visit(node.id);
  for (const node of result.fields.filter((item) => cyclic.has(item.id))) {
    addDiagnostic(node, 'source-cycle', 'warning', 'Field dependencies contain a cycle; verify the initial value and distinguish historical state from current inputs.');
  }
  return result;
}

export function traceField(lineage: FieldLineage, id: string, direction: 'sources' | 'consumers' = 'sources') {
  const ids = new Set([id]);
  const links: LineageLink[] = [];
  const visit = (current: string) => {
    for (const link of lineage.links.filter((item) => (direction === 'sources' ? item.target : item.source) === current)) {
      links.push(link);
      const next = direction === 'sources' ? link.source : link.target;
      if (!ids.has(next)) { ids.add(next); visit(next); }
    }
  };
  visit(id);
  return { fields: lineage.fields.filter((field) => ids.has(field.id)), links };
}
