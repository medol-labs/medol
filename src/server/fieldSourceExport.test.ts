import assert from 'node:assert/strict';
import { existsSync, unlinkSync } from 'node:fs';
import test from 'node:test';

const databasePath = `/private/tmp/medol-field-source-export-${process.pid}.sqlite`;
process.env.MEDOL_DB_PATH = databasePath;
const repository = await import('./modelingWorkspaceRepository');
const { Route } = await import('../routes/api/modeling/codegen-model');
const handlers = Route.options.server!.handlers!;
if (typeof handlers === 'function') throw new Error('Expected a direct route handler map.');
const get = handlers.GET!;

test.after(() => {
  for (const suffix of ['', '-shm', '-wal']) {
    const path = `${databasePath}${suffix}`;
    if (existsSync(path)) unlinkSync(path);
  }
});

test('HTTP export returns a 400 diagnostic with field identity and source location', async () => {
  const workspace = repository.createModelingWorkspace({ name: 'Invalid source', dsl: `context Orders {
    slice Place { command Place { id: UUID } event Placed { id: UUID from Place.missing } }
  }` });
  const response = await get({ request: new Request(`http://localhost/api/modeling/codegen-model?workspaceId=${workspace.id}`) } as Parameters<typeof get>[0]);
  assert(response instanceof Response);
  assert.equal(response.status, 400);
  const body = await response.json();
  assert(body.diagnostics[0].includes('Place.missing'));
  assert.equal(body.diagnosticDetails[0].code, 'source-unresolved');
  assert(body.diagnosticDetails[0].fieldId.endsWith('/field/id'));
  assert(body.diagnosticDetails[0].range.start.line > 0);
});

test('warning-only HTTP exports remain valid CodegenModel JSON', async () => {
  const workspace = repository.createModelingWorkspace({ name: 'Warning source', dsl: 'context Orders { slice View { event Saved { id: UUID } } }' });
  const response = await get({ request: new Request(`http://localhost/api/modeling/codegen-model?workspaceId=${workspace.id}`) } as Parameters<typeof get>[0]);
  assert(response instanceof Response);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).contexts[0].name, 'Orders');
});
