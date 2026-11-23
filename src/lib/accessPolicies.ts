import type { EmModel, EmAccessScopeRule } from './model';

/** Validate explicit scope contracts without guessing ownership from field names. */
export function accessPolicyDiagnostics(model: EmModel): string[] {
  if (!model.capabilityImports?.some(i => i.name === 'DataAccess')) return [];
  const errors: string[] = [];
  const records = model.contexts.flatMap(context => [
    ...context.looseElements, ...context.slices.flatMap(s => s.elements),
    ...context.aggregates.flatMap(a => a.slices.flatMap(s => s.elements))
  ].filter(e => e.kind === 'readmodel').map(element => ({ context, element })));
  const uniqueRecords = [...new Map(records.map(r => [r.element.id, r])).values()];
  const scopes = (rules: typeof model.accessPolicies[number]['rules']) => rules.filter((r): r is EmAccessScopeRule => r.kind === 'scope');
  const scalar = (field: { type: string; cardinality?: string }) => (!field.cardinality || field.cardinality === 'Single') && ['UUID', 'String', 'Int', 'Long'].includes(field.type);
  const policyCodes = new Map<string, string>();
  for (const policy of model.accessPolicies) {
    const key = policy.name.toLowerCase();
    const previous = policyCodes.get(key);
    if (previous && previous !== policy.name) errors.push(`Access policies ${previous} and ${policy.name} collide after IAM permission normalization.`);
    policyCodes.set(key, policy.name);
    const scopeCodes = new Map<string, string>();
    const localRules = uniqueRecords.filter(({ context, element }) => {
      const domain = model.domains.find(d => d.contexts.some(c => c.id === context.id));
      return (element.accessPolicy ?? domain?.defaultAccessPolicy ?? model.defaultAccessPolicy) === policy.name;
    }).flatMap(r => r.element.accessRules ?? []);
    for (const rule of [...scopes(policy.rules), ...localRules]) {
      const key = rule.field.toLowerCase();
      const previous = scopeCodes.get(key);
      if (previous && previous !== rule.field) errors.push(`Access policy ${policy.name}: fields ${previous} and ${rule.field} collide after IAM permission normalization.`);
      scopeCodes.set(key, rule.field);
    }
    const names = scopes(policy.rules).map(r => r.field);
    if (new Set(names).size !== names.length) errors.push(`Access policy ${policy.name}: duplicate scope field.`);
  }
  for (const { context, element } of uniqueRecords) {
    const domain = model.domains.find(d => d.contexts.some(c => c.id === context.id));
    const name = element.accessPolicy ?? domain?.defaultAccessPolicy ?? model.defaultAccessPolicy;
    const policy = model.accessPolicies.find(p => p.name === name);
    const label = `Readmodel ${context.name}.${element.name}`;
    if ((element.accessBindings || element.accessRules) && !policy) errors.push(`${label}: access adjustments require a defined explicit or default policy.`);
    const inherited = scopes(policy?.rules ?? []);
    const all = [...inherited, ...(element.accessRules ?? [])];
    if (new Set(all.map(r => r.field)).size !== all.length) errors.push(`${label}: additional access fields cannot replace inherited rules.`);
    for (const field of Object.keys(element.accessBindings ?? {})) {
      if (!inherited.some(r => r.field === field)) errors.push(`${label}: access binding ${field} is not an inherited scope field.`);
    }
    for (const rule of all) {
      const fieldName = element.accessBindings?.[rule.field] ?? rule.field;
      const target = element.fields.find(f => f.name === fieldName);
      if (!target || !scalar(target)) errors.push(`${label}: access field ${fieldName} must exist and be a required UUID, String, Int or Long scalar.`);
      const parts = rule.source.split('.');
      if (parts[0] === 'identity') {
        if (parts.length !== 2 || rule.subjectField) errors.push(`${label}: identity scope ${rule.field} requires identity.attribute without by.`);
        if (rule.source === 'identity.userId' && target && target.type !== 'UUID') errors.push(`${label}: identity.userId requires a UUID target.`);
      } else {
        const matches = uniqueRecords.filter(r => parts.length === 3 && r.context.name === parts[0] && r.element.name === parts[1]);
        const source = matches[0]?.element;
        const value = source?.fields.find(f => f.name === parts[2]);
        const subject = source?.fields.find(f => f.name === rule.subjectField);
        if (matches.length !== 1 || !value || !scalar(value)) errors.push(`${label}: access source ${rule.source} must resolve to a required scalar readmodel field.`);
        if (!subject || subject.type !== 'UUID' || !scalar(subject) || rule.subjectSource !== 'identity.userId') errors.push(`${label}: business access scope requires by <UUID user field> = identity.userId.`);
        if (value && target && value.type !== target.type) errors.push(`${label}: access source and target field types must match.`);
      }
    }
  }
  return [...new Set(errors)];
}
