import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMedol } from './dslParser';
import { modelToCodegenModel } from './codegenModel';
import { codegenModelToConfig } from './codegenToConfig';
import { configToDsl } from './configToDsl';

const parseEnabled = (text: string) => parseMedol('import data-access\n' + text);

const source = `
access policy ParticipantAccess {
  organizationId from People.Members.organizationId by userAccountId = identity.userId
}
access policy PublicAccess {}
default access ParticipantAccess
context People {
  slice Directory {
    readmodel Members[] {
      access PublicAccess
      id: UUID id
      userAccountId: UUID
      organizationId: UUID
      state: String
      eligible when { state == "Active" }
    }
    readmodel Orders[] {
      id: UUID id
      organizationId: UUID
    }
    readmodel Mine[] {
      access {
        organizationId = ownerOrganizationId
        ownerUserId from identity.userId
      }
      id: UUID id
      ownerOrganizationId: UUID
      ownerUserId: UUID
    }
  }
}`;

test('default access, local rebinding and AND additions survive codegen and legacy roundtrip', () => {
  const model = parseEnabled(source);
  assert.deepEqual(model.diagnostics, []);
  const output = modelToCodegenModel(model);
  const items = output.slices.flatMap(s => s.readmodels);
  assert.equal(items.find(r => r.name === 'Orders')?.accessPolicy, 'ParticipantAccess');
  const mine = items.find(r => r.name === 'Mine')!;
  assert.deepEqual(mine.accessBindings, { organizationId: 'ownerOrganizationId' });
  assert.deepEqual(mine.accessRules, [{ kind: 'scope', field: 'ownerUserId', source: 'identity.userId' }]);
  assert.equal(mine.accessPolicyInherited, true);
  const roundtrip = parseMedol(configToDsl(codegenModelToConfig(output) as Parameters<typeof configToDsl>[0]));
  assert.deepEqual(roundtrip.diagnostics, []);
  assert.deepEqual(modelToCodegenModel(roundtrip).slices.flatMap(s => s.readmodels).find(r => r.name === 'Mine')?.accessRules, mine.accessRules);
});

test('missing default fields, unknown bindings, duplicate additions and source type mismatches fail closed', () => {
  for (const [text, message] of [
    [source.replace('organizationId: UUID\n    }\n    readmodel Mine', 'other: UUID\n    }\n    readmodel Mine'), /access field organizationId/],
    [source.replace('organizationId = ownerOrganizationId', 'missing = ownerOrganizationId'), /not an inherited scope/],
    [source.replace('ownerUserId from identity.userId', 'organizationId from identity.userId'), /cannot replace/],
    [source.replace('ownerOrganizationId: UUID', 'ownerOrganizationId: String'), /types must match/],
    [source.replace('by userAccountId', 'by missing'), /UUID user field/]
  ] as const) {
    const model = parseEnabled(text);
    assert.ok(model.diagnostics.some(d => message.test(d)), model.diagnostics.join('\n'));
    assert.throws(() => modelToCodegenModel(model), message);
  }
});

test('domain default overrides global and explicit empty policy exempts a readmodel', () => {
  const model = parseEnabled(`
access policy Global { ownerId from identity.userId }
access policy Department { departmentId from identity.departmentIds }
access policy Public {}
default access Global
domain Sales {
  default access Department
  context Orders { slice Views {
    readmodel Directory[] { id: UUID id departmentId: UUID }
    readmodel Open[] { access Public id: UUID id }
  } }
}`);
  assert.deepEqual(model.diagnostics, []);
  const items = modelToCodegenModel(model).slices.flatMap(s => s.readmodels);
  assert.equal(items.find(r => r.name === 'Directory')?.accessPolicy, 'Department');
  assert.equal(items.find(r => r.name === 'Open')?.accessPolicy, 'Public');
});

test('rejects policy and rule names that collide in lowercase IAM permission codes', () => {
  const policies = parseEnabled(`access policy DataAccess {} access policy dataAccess {}`);
  assert.ok(policies.diagnostics.some(d => d.includes('permission normalization')));
  assert.throws(() => modelToCodegenModel(policies), /permission normalization/);
  const fields = parseEnabled(`
access policy Own { ownerId from identity.userId }
default access Own
context Orders { slice Views {
  readmodel Mine[] {
    access { OwnerId from identity.userId }
    id: UUID id ownerId: UUID OwnerId: UUID
  }
}}`);
  assert.ok(fields.diagnostics.some(d => d.includes('permission normalization')));
});

test('only importing data-access enables the exported capability, not context names or policies', () => {
  const text = `access policy Own { ownerId from identity.userId }
    default access Own context Records { slice Views { readmodel Items[] { id: UUID id } } }`;
  const disabled = parseMedol(text);
  assert.deepEqual(disabled.diagnostics, []);
  assert.equal(modelToCodegenModel(disabled).dataAccess, undefined);
  assert.equal(modelToCodegenModel(parseMedol('context DataAccess {}')).dataAccess, undefined);
  const enabled = parseEnabled(text.replace('id: UUID id', 'id: UUID id ownerId: UUID'));
  assert.deepEqual(enabled.diagnostics, []);
  assert.deepEqual(modelToCodegenModel(enabled).dataAccess, {enabled: true});
  assert.ok(!modelToCodegenModel(enabled).deployments?.some(d => d.name === 'DataAccess'));
  assert.ok(!modelToCodegenModel(enabled).contexts.some(c => c.name === 'DataAccess'));
  assert.ok(parseEnabled(text).diagnostics.some(d => d.includes('access field ownerId')));
});
