import { isAutomation, isAutomationTrigger, isCommand, isReadModel, isReactsTo, isSubscription,
  type Slice } from '../language/generated/ast';
import type { EmModel } from './model';

export function resolveSliceReactions(slice: Slice) {
  const candidates = slice.elements.filter((element) => isCommand(element) || isReadModel(element) || isAutomation(element));
  return slice.elements.filter(isReactsTo).map((reaction) => {
    const event = reaction.event?.$refText ?? '';
    const explicit = candidates.filter((element) => {
      if (isAutomation(element)) return element.elements.filter(isAutomationTrigger).some((trigger) => trigger.event?.$refText === event);
      if (isReadModel(element)) return element.elements.filter(isSubscription).some((subscription) => subscription.event?.$refText === event);
      return false;
    });
    const unbound = candidates.filter((element) => {
      if (isAutomation(element)) return !element.elements.some(isAutomationTrigger);
      if (isReadModel(element)) return !element.elements.some(isSubscription);
      return true;
    });
    return { reaction, event, targets: explicit.length ? explicit : unbound.length === 1 ? unbound : [] };
  });
}

export function reactionDiagnostics(model: EmModel): string[] {
  const diagnostics = model.contexts.flatMap((context) => [...context.slices, ...context.aggregates.flatMap((owner) => owner.slices)]
    .flatMap((slice) => (slice.reactions ?? []).filter((reaction) => !reaction.targetIds.length).map((reaction) =>
      `Slice ${slice.name}: reactsTo ${reaction.event} has no unambiguous response target. Use an explicit automation on or projection subscribe declaration, or keep a single response target in the slice.`)));
  const records = model.contexts.flatMap((context) => [...context.slices, ...context.aggregates.flatMap((owner) => owner.slices)]
    .map((slice) => ({ slice, owners: new Set([
      ...context.concepts.filter((owner) => owner.sliceIds.includes(slice.id)).map((owner) => owner.id),
      ...context.aggregates.filter((owner) => owner.slices.some((item) => item.id === slice.id)).map((owner) => owner.id)
    ]) })));
  const elements = new Map(records.flatMap((record) => record.slice.elements.map((element) => [element.id, { ...record, element }] as const)));
  for (const edge of model.edges.filter((edge) => edge.label === 'reactsTo')) {
    const source = elements.get(edge.source);
    const target = elements.get(edge.target);
    if (source?.element.kind !== 'event' || !target?.slice.resultingState || target.slice.startsLifecycle
      || !source.slice.resultingState || ![...source.owners].some((owner) => target.owners.has(owner))) continue;
    if (source.slice.elements.find((element) => element.kind === 'event')?.id === source.element.id) continue;
    diagnostics.push(`Slice ${target.slice.name}: reactsTo ${source.element.name} cannot establish a lifecycle guard because this secondary outcome of ${source.slice.name} has no explicit state association. Model it in a separate state-bearing slice; event names are not state declarations.`);
  }
  return [...new Set(diagnostics)];
}
