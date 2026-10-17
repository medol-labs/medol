import type { EmCapabilityProvider, EmElement, EmModel } from './model';
import { resolveCapabilityReferences } from './capabilityReferences';

export interface TenantCapabilityProvider {
  context: string;
  readModel: string;
  mappings: Record<string, string>;
}

export interface TenantCapability {
  enabled: true;
  directory: TenantCapabilityProvider;
  memberships: TenantCapabilityProvider;
  managementContexts: string[];
}

const rolesByKind = {
  tenantDirectory: ['id', 'state'],
  tenantMemberships: ['id', 'tenant', 'user', 'state']
} as const;

export const resolveTenantCapability = (model: EmModel): {
  capability?: TenantCapability;
  diagnostics: string[];
} => {
  if (!model.capabilityImports?.some((imported) => imported.name === 'TenantManagement')) {
    return { diagnostics: [] };
  }
  const references = resolveCapabilityReferences(model, 'TenantManagement');
  const diagnostics = [...references.diagnostics];
  for (const extension of references.extensions) {
    if (extension.context || extension.domain) {
      diagnostics.push('Tenant capability bindings must be declared at application level, outside domain and context blocks.');
    }
    for (const provider of extension.providers) {
      if (!Object.hasOwn(rolesByKind, provider.kind)) diagnostics.push(`Unknown tenant provider ${provider.kind}.`);
    }
  }
  const bindings = references.extensions.flatMap((extension) => extension.providers
    .filter((provider) => Object.hasOwn(rolesByKind, provider.kind))
    .map((provider) => ({ extension, provider })));
  const candidates = [...new Map(bindings.map((binding) => {
    const { extension, provider } = binding;
    const key = JSON.stringify([extension.builtinDefault ?? false, extension.context, extension.domain, provider.kind,
      provider.source, Object.entries(provider.mappings).sort(([left], [right]) => left.localeCompare(right))]);
    return [key, binding];
  })).values()];

  const readModels = model.contexts.flatMap((context) => [
    ...context.looseElements,
    ...context.slices.flatMap((slice) => slice.elements),
    ...context.aggregates.flatMap((aggregate) => aggregate.slices.flatMap((slice) => slice.elements))
  ].filter((element) => element.kind === 'readmodel').map((element) => ({ context: context.name, element })));

  const resolved = new Map<string, TenantCapabilityProvider>();
  const managementContexts = new Set<string>();
  for (const [kind, requiredRoles] of Object.entries(rolesByKind)) {
    const providers = candidates.filter((candidate) => candidate.provider.kind === kind);
    const overrides = providers.filter(({ extension }) => !extension.builtinDefault);
    const effective = overrides.length ? overrides : providers;
    if (effective.length !== 1) {
      diagnostics.push(`Tenant capability requires exactly one effective ${kind} provider; found ${effective.length}.`);
      continue;
    }
    const { extension, provider } = effective[0];
    const source = provider.source?.split('.') ?? [];
    const matches = readModels.filter(({ context, element }) => source.length === 2
      ? context === source[0] && element.name === source[1]
      : source.length === 1 && element.name === source[0] && (!extension.context || context === extension.context));
    if (matches.length !== 1) {
      diagnostics.push(`Tenant provider ${kind}: source ${provider.source ?? '<missing>'} must resolve to exactly one readmodel.`);
      continue;
    }
    const { context, element } = matches[0];
    const structuredTypes = new Set(model.contexts.flatMap((owner) => owner.valueTypes
      .filter((type) => type.kind === 'object')
      .flatMap((type) => [`${owner.name}.${type.name}`, ...(owner.name === context ? [type.name] : [])])));
    for (const role of requiredRoles) {
      validateMapping(provider, element, role, structuredTypes, diagnostics);
    }
    for (const role of Object.keys(provider.mappings)) {
      if (!(requiredRoles as readonly string[]).includes(role)) validateMapping(provider, element, role, structuredTypes, diagnostics);
    }
    resolved.set(kind, { context, readModel: element.name, mappings: { ...provider.mappings } });
    managementContexts.add(context);
  }
  const directory = resolved.get('tenantDirectory');
  const memberships = resolved.get('tenantMemberships');
  if (directory && memberships) {
    const directoryModel = readModels.find(({ context, element }) => context === directory.context && element.name === directory.readModel)!;
    const membershipModel = readModels.find(({ context, element }) => context === memberships.context && element.name === memberships.readModel)!;
    const tenantType = directoryModel.element.fields.find((field) => field.name === directory.mappings.id)?.type;
    const memberTenantType = membershipModel.element.fields.find((field) => field.name === memberships.mappings.tenant)?.type;
    if (tenantType && memberTenantType && tenantType !== memberTenantType) {
      diagnostics.push('Tenant providers: directory id and membership tenant fields must have the same type.');
    }
  }
  return {
    diagnostics,
    ...(directory && memberships && !diagnostics.length ? {
      capability: { enabled: true, directory, memberships, managementContexts: [...managementContexts] }
    } : {})
  };
};

const validateMapping = (
  provider: EmCapabilityProvider,
  element: EmElement,
  role: string,
  structuredTypes: Set<string>,
  diagnostics: string[]
): void => {
  const fieldName = provider.mappings[role];
  const field = element.fields.find((candidate) => candidate.name === fieldName);
  if (!field || (field.cardinality && field.cardinality !== 'Single') || structuredTypes.has(field.type) || ['Json', 'Any'].includes(field.type)) {
    diagnostics.push(`Tenant provider ${provider.kind}: role ${role} must map to an existing required scalar field on ${element.name}.`);
  }
};
