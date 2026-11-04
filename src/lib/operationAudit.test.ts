import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMedol } from './dslParser';
import { modelToCodegenModel } from './codegenModel';
import { analyzeFieldLineage } from './fieldLineage';

test('operation audit is an imported read-only capability with no public append commands', () => {
  const parsed = parseMedol(`import operation-audit as Audit deploy Backend
    frontend Console { includes OperationAudit from Backend }`);
  assert.deepEqual(parsed.diagnostics, []);
  assert.deepEqual(analyzeFieldLineage(parsed).diagnostics, []);
  const model = modelToCodegenModel(parsed);
  assert.deepEqual(model.operationAudit, {context: 'OperationAudit', readModel: 'OperationAuditCatalog'});
  assert.equal(model.slices.flatMap(slice => slice.commands).length, 0);
  const fields = model.slices.flatMap(slice => slice.readmodels).flatMap(readmodel => readmodel.fields);
  assert(fields.some(field => field.name === 'targetId'));
  assert(!fields.some(field => /payload|password|token/i.test(field.name)));
  assert(model.actors.some(actor => actor.name === 'OperationAuditor'));
});

test('a same-named user context does not activate the audit adapter', () => {
  const parsed = parseMedol('context OperationAudit { slice Catalog { readmodel OperationAuditCatalog[] { auditRecordId: UUID id } } }');
  assert.equal(modelToCodegenModel(parsed).operationAudit, undefined);
});

test('audit records use the platform control plane when tenants are enabled', () => {
  const model = modelToCodegenModel(parseMedol('import operationAudit as Audit deploy Support\nimport tenant-management deploy Support'));
  assert(model.tenancy?.managementContexts.includes('OperationAudit'));
});
