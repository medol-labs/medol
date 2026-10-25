import { allContextSlices } from './dslParser';
import type { EmElement, EmModel, MedolSourceRange } from './model';

export interface BehaviorSource {
  id: string;
  name: string;
  range?: MedolSourceRange;
}
export interface BehaviorOutcome extends BehaviorSource {
  kind: 'event' | 'reject' | 'error';
  association: 'declared' | 'candidate';
}
export interface BehaviorScenario extends BehaviorSource {
  specification: string;
  given: Array<{ eventId: string; name: string; values: Record<string, string> }>;
  input: Record<string, string>;
  outcome?: BehaviorOutcome;
}
export interface BehaviorReview {
  code: 'indistinguishable-scenarios' | 'unbound-outcome' | 'unmapped-fact';
  contextId: string;
  sliceId: string;
  source: BehaviorSource;
  message: string;
}

const sourceOf = (element: EmElement): BehaviorSource => ({ id: element.id, name: element.name, range: element.sourceRange });
const valuesWithPrefix = (metadata: Record<string, string>, prefix: string) => Object.fromEntries(
  Object.entries(metadata).filter(([key]) => key.startsWith(prefix))
    .map(([key, value]) => [key.slice(prefix.length), value]).sort(([a], [b]) => a.localeCompare(b))
);
// Review declared evidence without executing rules or constructing a second model.
export function buildBehaviorReviews(model: EmModel): BehaviorReview[] {
  const reviews: BehaviorReview[] = [];
  const records = model.contexts.flatMap((context) => allContextSlices(context).flatMap((slice) =>
    slice.elements.map((element) => ({ context, slice, element }))));
  const byId = new Map(records.map((record) => [record.element.id, record]));
  const whens = new Map<string, EmElement[]>();
  const givens = new Map<string, EmElement[]>();
  const thens = new Map<string, EmElement>();
  const emits = new Map<string, Set<string>>();
  for (const edge of model.edges) {
    const source = byId.get(edge.source)?.element;
    const target = byId.get(edge.target)?.element;
    if (edge.label === 'when' && target?.kind === 'gwt') whens.set(edge.source, [...(whens.get(edge.source) ?? []), target]);
    if (edge.label === 'given' && source?.kind === 'event') givens.set(edge.target, [...(givens.get(edge.target) ?? []), source]);
    if (edge.label === 'then' && target?.kind === 'event') thens.set(edge.source, target);
    if (edge.label === 'emits') emits.set(edge.source, new Set([...(emits.get(edge.source) ?? []), edge.target]));
  }
  for (const record of records.filter(({ element }) => element.kind === 'command')) {
    const { context, slice, element: command } = record;
    const events = slice.elements.filter((element) => element.kind === 'event');
    const specifications = whens.get(command.id) ?? [];
    const scenarios: BehaviorScenario[] = specifications.map((element) => {
      const metadata = element.metadata ?? {};
      const event = thens.get(element.id);
      const kind = metadata.thenReject !== undefined ? 'reject' : metadata.thenError !== undefined ? 'error' : 'event';
      const name = metadata.thenReject ?? metadata.thenError ?? event?.name;
      return {
        ...sourceOf(element), specification: metadata.specification ?? element.name,
        given: Object.keys(metadata).filter((key) => /^given\d+$/.test(key))
          .sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)))
          .map((key) => {
            const name = metadata[key];
            const event = givens.get(element.id)?.find((event) => event.name === name);
            return { eventId: event?.id ?? `unresolved:${name}`, name, values: valuesWithPrefix(metadata, `givenExample:${key.slice(5)}:`) };
          }),
        input: valuesWithPrefix(metadata, 'example:'),
        outcome: name ? { id: event?.id ?? element.id, name, kind, association: 'declared', range: element.sourceRange } : undefined
      };
    });
    const outcomes: BehaviorOutcome[] = events.map((event) => ({
      ...sourceOf(event), kind: 'event',
      association: scenarios.some((scenario) => scenario.outcome?.kind === 'event' && scenario.outcome.id === event.id)
        || events.length === 1 && emits.get(command.id)?.has(event.id) ? 'declared' : 'candidate'
    }));
    const groups = new Map<string, BehaviorScenario[]>();
    for (const scenario of scenarios) {
      // Given history order is significant. Assignment order is not. Scenario names are not facts.
      const key = JSON.stringify([scenario.specification, scenario.given.map((given) => [given.eventId, given.values]), scenario.input]);
      groups.set(key, [...(groups.get(key) ?? []), scenario]);
    }
    for (const group of groups.values()) {
      const outcomes = new Set(group.filter((item) => item.outcome).map((item) => JSON.stringify([
        item.outcome!.kind, item.outcome!.kind === 'event' ? item.outcome!.id : item.outcome!.name
      ])));
      if (outcomes.size < 2) continue;
      for (const scenario of group) {
        reviews.push({ code: 'indistinguishable-scenarios', contextId: context.id, sliceId: slice.id, source: scenario,
          message: `Scenario ${scenario.name} has the same declared Given/When facts as ${group.filter((item) => item !== scenario).map((item) => item.name).join(', ')} but expects a different outcome. Additional decision facts or policy are needed; this is not proof of a contradiction.` });
      }
    }
    for (const fact of command.fields.filter((field) => field.mapping?.kind === 'derived' && !field.mapping.sources?.length)) reviews.push({
      code: 'unmapped-fact', contextId: context.id, sliceId: slice.id, source: sourceOf(command),
      message: `Derived fact ${fact.name} has no declared source. A prose rule does not identify the complete decision fact set.`
    });
    for (const outcome of outcomes.filter((outcome) => outcome.association === 'candidate')) reviews.push({
      code: 'unbound-outcome', contextId: context.id, sliceId: slice.id, source: outcome,
      message: `Event ${outcome.name} is in the same slice as ${command.name}, but no command or scenario relationship binds this outcome to the operation.`
    });
  }
  return reviews;
}
