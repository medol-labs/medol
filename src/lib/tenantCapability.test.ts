import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMedol, parseMedolSources } from './dslParser';
import { modelToCodegenModel } from './codegenModel';
import { parseMedolFile } from './medolProject';

const customModels = `
  context CustomerAdministration {
    slice Customers {
      readmodel CustomerDirectory[] {
        customerKey: UUID id
        customerName: String
        status: String
      }
    }
  }
  context MembershipAdministration {
    slice Members {
      readmodel CustomerMembers[] {
        membershipKey: UUID id
        customerKey: UUID
        accountKey: UUID
        status: String
      }
    }
  }
`;
const directoryBinding = `
  provider tenantDirectory from CustomerAdministration.CustomerDirectory {
    id customerKey
    label customerName
    state status
  }
`;
const membershipBinding = `
  provider tenantMemberships from MembershipAdministration.CustomerMembers {
    id membershipKey
    tenant customerKey
    user accountKey
    state status
  }
`;
const bind = (providers = `${directoryBinding}\n${membershipBinding}`, target = 'TenantManagement') =>
  `extend ${target} { ${providers} }`;
const custom = () => `${customModels}\n${bind()}`;

test('ordinary contexts, fields and unrelated providers do not enable isolation', () => {
  for (const source of [
    'import identity-access-management deploy Support',
    'context TenantManagement { slice Settings { command Change { tenantId: UUID tenantIsolation: Boolean } } }',
    `${customModels}\n${bind(undefined, 'Utilities')}`,
    customModels
  ]) {
    const model = parseMedol(source);
    assert.deepEqual(model.diagnostics, []);
    assert.equal(modelToCodegenModel(model).tenancy, undefined);
  }
});

test('custom bindings require the tenant import before isolation can be enabled', () => {
  const disabled = parseMedol(custom());
  assert.deepEqual(disabled.diagnostics, []);
  assert.equal(modelToCodegenModel(disabled).tenancy, undefined);
  const model = parseMedol(`import tenant-management\n${custom()}`);
  assert.deepEqual(model.diagnostics, []);
  const codegen = modelToCodegenModel(model);
  assert.equal(codegen.tenancy?.enabled, true);
  assert.deepEqual(codegen.tenancy?.directory, {
    context: 'CustomerAdministration', readModel: 'CustomerDirectory',
    mappings: {id: 'customerKey', label: 'customerName', state: 'status'}
  });
  assert.equal(codegen.tenancy?.memberships.mappings.user, 'accountKey');
  assert.equal('runtimeExtensions' in codegen, false);
  assert(codegen.contexts.every((context) => !('runtimeFeatures' in context)));
});

test('the standard target is required; arbitrary extension names are not inferred as tenancy', () => {
  const model = parseMedol(`${customModels}\n${bind(undefined, 'CustomerCapability')}`);
  assert.deepEqual(model.diagnostics, []);
  assert.equal(modelToCodegenModel(model).tenancy, undefined);
});

test('builtin import contributes default application bindings', () => {
  const model = parseMedol(`
    import tenant-management as Tenants deploy Support
    context Orders { note "Business data" }
    deployment Business { includes Orders }
  `);
  assert.deepEqual(model.diagnostics, []);
  const codegen = modelToCodegenModel(model);
  assert.equal(codegen.tenancy?.enabled, true);
  assert.deepEqual(codegen.tenancy?.directory, {
    context: 'TenantManagement', readModel: 'TenantCatalog',
    mappings: {id: 'tenantId', code: 'tenantCode', label: 'tenantName', state: 'state'}
  });
  assert.deepEqual(codegen.tenancy?.managementContexts, ['TenantManagement']);
  assert.deepEqual(model.deployments.find((item) => item.name === 'Support')?.contexts, ['TenantManagement']);
  assert(model.capabilityExtensions.filter((extension) => extension.target === 'TenantManagement')
    .every((extension) => extension.builtinDefault && !extension.context && !extension.domain));
});

test('custom bindings override builtin defaults, including a partial override', () => {
  for (const providers of [directoryBinding, `${directoryBinding}\n${membershipBinding}`]) {
    const model = parseMedol(`import tenant-management deploy Support\n${customModels}\n${bind(providers)}`);
    assert.deepEqual(model.diagnostics, []);
    const contract = modelToCodegenModel(model).tenancy!;
    assert.equal(contract.directory.readModel, 'CustomerDirectory');
    assert.equal(contract.memberships.readModel, providers === directoryBinding ? 'TenantMembershipCatalog' : 'CustomerMembers');
  }
});

test('default precedence uses source provenance rather than a context name', () => {
  const model = parseMedol(`import tenant-management\n${custom()}`);
  assert.deepEqual(model.diagnostics, []);
  for (const context of model.contexts) {
    if (context.name === 'TenantManagement') context.name = 'RenamedAdministration';
  }
  for (const extension of model.capabilityExtensions.filter((item) => item.builtinDefault)) {
    for (const provider of extension.providers) provider.source = provider.source?.replace('TenantManagement.', 'RenamedAdministration.');
  }
  assert.equal(modelToCodegenModel(model).tenancy?.directory.readModel, 'CustomerDirectory');
});

test('import aliases resolve before custom bindings are selected', () => {
  const model = parseMedol(`import tenant-management as PlatformTenants deploy Support\n${customModels}\n${bind(undefined, 'PlatformTenants')}`);
  assert.deepEqual(model.diagnostics, []);
  assert.equal(modelToCodegenModel(model).tenancy?.memberships.readModel, 'CustomerMembers');
  const unrelated = parseMedol(`import dictionary-maintenance as Catalogs\n${customModels}\n${bind(undefined, 'Catalogs')}`);
  assert.deepEqual(unrelated.diagnostics, []);
  assert.equal(modelToCodegenModel(unrelated).tenancy, undefined);
});

test('conflicting aliases fail instead of changing the selected capability', () => {
  const model = parseMedol('import tenant-management as Management\nimport dictionary-maintenance as Management');
  assert.match(model.diagnostics.join('\n'), /Capability alias Management refers to conflicting capabilities/);
  assert.throws(() => modelToCodegenModel(model), /conflicting capabilities/);
});

test('tenant bindings must be application level', () => {
  for (const scope of ['context Example', 'domain Example']) {
    const model = parseMedol(`import tenant-management\n${customModels}\n${scope} { ${bind()} }`);
    assert.match(model.diagnostics.join('\n'), /application level/);
    assert.throws(() => modelToCodegenModel(model), /application level/);
  }
});

test('imported files retain top-level custom bindings without companion files', () => {
  const sources: Record<string, string> = {
    '/model/source.medol': 'import "bindings.medol"',
    '/model/bindings.medol': 'import "models.medol"\n' + bind(),
    '/model/models.medol': customModels
  };
  const reads: string[] = [];
  const model = parseMedolFile('/model/source.medol', {
    readFile: (path) => { reads.push(path); return sources[path]; },
    resolveImport: (_importer, imported) => `/model/${imported}`
  });
  assert.deepEqual(model.diagnostics, []);
  assert.equal(modelToCodegenModel(model).tenancy, undefined);
  assert.deepEqual(reads.sort(), Object.keys(sources).sort());
});

test('transitive builtin imports preserve default provenance and alias bindings', () => {
  const sources: Record<string, string> = {
    '/model/source.medol': 'import "bindings.medol"',
    '/model/bindings.medol': `import tenant-management as CustomerTenants deploy Support\n${customModels}\n${bind(undefined, 'CustomerTenants')}`
  };
  const model = parseMedolFile('/model/source.medol', {
    readFile: (path) => sources[path],
    resolveImport: (_importer, imported) => `/model/${imported}`
  });
  assert.deepEqual(model.diagnostics, []);
  assert.equal(modelToCodegenModel(model).tenancy?.directory.readModel, 'CustomerDirectory');
});

test('repeated imports share one effective contract across deployments', () => {
  const model = parseMedol('import tenant-management as First deploy Support\nimport tenantManagement as Second deploy Other');
  assert.deepEqual(model.diagnostics, []);
  assert.equal(modelToCodegenModel(model).tenancy?.enabled, true);
  assert.equal(model.deployments.filter((deployment) => deployment.contexts.includes('TenantManagement')).length, 2);
});

test('missing, misspelled, ambiguous and invalid bindings fail closed', () => {
  const cases: Array<[string, RegExp]> = [
    [bind('provider tenantDirectoryTypo {}'), /Unknown tenant provider/],
    [bind(`${directoryBinding}\n${membershipBinding.replace('user accountKey', 'user missingField')}`), /role user/],
    [`${bind()}\n${bind(directoryBinding.replace('label customerName', ''))}`, /exactly one effective tenantDirectory/],
    [bind(`${directoryBinding.replace('CustomerAdministration.CustomerDirectory', 'Missing.Directory')}\n${membershipBinding}`), /resolve to exactly one readmodel/]
  ];
  for (const [bindings, expected] of cases) {
    const model = parseMedol(`import tenant-management\n${customModels}\n${bindings}`);
    assert.match(model.diagnostics.join('\n'), expected);
    assert.throws(() => modelToCodegenModel(model), expected);
  }
  for (const [models, expected] of [
    [customModels.replace('accountKey: UUID', 'accountKey: UUID?'), /required scalar/],
    [customModels.replace('customerKey: UUID\n', 'customerKey: String\n'), /same type/]
  ] as const) {
    const model = parseMedol(`import tenant-management\n${models}\n${bind()}`);
    assert.match(model.diagnostics.join('\n'), expected);
    assert.throws(() => modelToCodegenModel(model), expected);
  }
  const imported = parseMedol('import tenant-management');
  imported.capabilityExtensions = [];
  assert.throws(() => modelToCodegenModel(imported), /exactly one effective/);
});

test('tenant lifecycle and membership ownership remain modeled', () => {
  const model = parseMedol('import tenant-management');
  assert.deepEqual(model.diagnostics, []);
  const codegen = modelToCodegenModel(model);
  for (const [name, from, to] of [
    ['ActivateTenant', 'Registered', 'Active'], ['SuspendTenant', 'Active', 'Suspended'],
    ['ResumeTenant', 'Suspended', 'Active'], ['RevokeTenantMember', 'Active', 'Revoked'],
    ['RestoreTenantMember', 'Revoked', 'Active']
  ]) {
    const transition = codegen.transitions.find((item) => item.command?.name === name)!;
    assert.equal(transition.from, from);
    assert.equal(transition.to, to);
  }
  const commands = codegen.slices.flatMap((slice) => slice.commands);
  assert.deepEqual(commands.find((item) => item.name === 'RestoreTenantMember')?.fields.map((field) => field.name),
    ['tenantMembershipId', 'restorationReason']);
  assert.deepEqual(commands.find((item) => item.name === 'UpdateTenant')?.fields.map((field) => field.name),
    ['tenantId', 'tenantName', 'description']);
  const events = codegen.slices.flatMap((slice) => slice.events);
  for (const name of ['TenantUpdated', 'TenantActivated', 'TenantSuspended', 'TenantResumed']) {
    const event = events.find((item) => item.name === name)!;
    for (const field of ['tenantId', 'tenantCode', 'tenantName', 'description']) assert(event.fields.some((item) => item.name === field));
    assert.deepEqual(event.fields.find((field) => field.name === 'tenantCode')?.source?.from, ['TenantRegistered.tenantCode']);
  }
  for (const name of ['TenantMemberRevoked', 'TenantMemberRestored']) {
    const event = events.find((item) => item.name === name)!;
    assert.deepEqual(event.fields.find((field) => field.name === 'tenantId')?.source?.from, ['TenantMemberAdded.tenantId']);
    assert.deepEqual(event.fields.find((field) => field.name === 'userAccountId')?.source?.from, ['TenantMemberAdded.userAccountId']);
  }
});

test('tenant codes, names and reasons retain portable nonblank constraints', () => {
  const model = parseMedol('import tenant-management');
  const matches = (name: string, value: string) => model.contexts[0].valueTypes.find((type) => type.name === name)!.constraints.every((constraint) => {
    if (constraint.kind === 'length') return value.length >= constraint.min && value.length <= constraint.max;
    if (constraint.kind === 'matches') return new RegExp(`^(?:${constraint.pattern})$`).test(value);
    return true;
  });
  for (const value of ['', ' ', 'acme corp', 'a'.repeat(65)]) assert.equal(matches('TenantCode', value), false);
  assert.equal(matches('TenantCode', 'Acme-Lab_01'), true);
  assert.equal(matches('TenantName', '  '), false);
  assert.equal(matches('TenantName', 'Example tenant'), true);
  assert.equal(matches('TenantChangeReason', ' \n\t'), false);
  assert.equal(matches('TenantChangeReason', 'Reviewed\nand restored'), true);
});

test('source parsing accepts custom bindings through the standard contract with no metadata', () => {
  const model = parseMedolSources([{sourceName: 'customer.medol', text: custom()}]);
  assert.deepEqual(model.diagnostics, []);
  assert.equal(modelToCodegenModel(model).tenancy, undefined);
});

test('without the tenant import incomplete or invalid tenant bindings do not produce tenant errors', () => {
  for (const source of [
    bind(''), bind(directoryBinding), bind('provider tenantDirectoryTypo {}'),
    bind(`${directoryBinding}\n${membershipBinding.replace('user accountKey', 'user missingField')}`),
    `context Example { ${bind()} }`
  ]) {
    const model = parseMedol(`${customModels}\n${source}`);
    assert.deepEqual(model.diagnostics, []);
    assert.equal(modelToCodegenModel(model).tenancy, undefined);
  }
});

test('removing the tenant import disables isolation even when custom bindings remain', () => {
  const enabled = parseMedol(`import tenant-management\n${custom()}`);
  assert.equal(modelToCodegenModel(enabled).tenancy?.enabled, true);
  const disabled = parseMedol(custom());
  assert.deepEqual(disabled.diagnostics, []);
  assert.equal(modelToCodegenModel(disabled).tenancy, undefined);
});

test('only imported IAM is classified as a platform control plane', () => {
  const imported = parseMedol('import tenant-management\nimport identity-access-management as Accounts');
  assert.deepEqual(imported.diagnostics, []);
  assert(modelToCodegenModel(imported).tenancy?.managementContexts.includes('IdentityAccessManagement'));
  const merelyNamed = parseMedol('import tenant-management\ncontext IdentityAccessManagement { note "Business context, not imported IAM" }');
  assert.deepEqual(merelyNamed.diagnostics, []);
  assert.equal(modelToCodegenModel(merelyNamed).tenancy?.managementContexts.includes('IdentityAccessManagement'), false);
});
