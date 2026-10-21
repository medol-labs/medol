import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCodegenModelExport } from './codegenExport';
import { sourceSha256 } from '../../lib/codegenProvenance';

const old = 'domain Old { context Original {} }';
const current = 'domain New { context Updated {} }';

test('immediate exports parse the captured source instead of the previous debounced model', async () => {
  const previous = await resolveCodegenModelExport({ dsl: old, locale: 'en' }, async () => '');
  const output = JSON.parse(await resolveCodegenModelExport({ dsl: current, locale: 'en', workspaceId: 'w' }, async () => previous));
  assert.equal(output.domain, 'New');
  assert.equal(output.contexts[0].name, 'Updated');
  assert.equal(output.metadata.source.sha256, await sourceSha256(current));
  assert.equal(output.metadata.source.release, undefined);
});

test('offline, invalid persisted models and deleted workspaces do not block valid draft exports', async () => {
  for (const message of ['offline', '404 workspace not found', '400 invalid persisted DSL']) {
    const output = JSON.parse(await resolveCodegenModelExport({ dsl: current, locale: 'en', workspaceId: 'w' }, async () => { throw new Error(message); }));
    assert.equal(output.domain, 'New');
    assert.equal(output.metadata.source.release, undefined);
  }
  await assert.rejects(resolveCodegenModelExport({ dsl: 'invalid DSL', locale: 'en' }, async () => ''), /context|domain|MEDOL/);
});

test('matching server exports keep the exact immutable release association', async () => {
  const exported = JSON.parse(await resolveCodegenModelExport({ dsl: current, locale: 'en' }, async () => ''));
  exported.metadata.source.release = { channel: 'stable', label: 'v1.0.0' };
  const output = await resolveCodegenModelExport({ dsl: current, locale: 'en', workspaceId: 'w' }, async () => JSON.stringify(exported));
  assert.equal(JSON.parse(output).metadata.source.release.label, 'v1.0.0');
});

test('draft translation lookup uses the same captured source', async () => {
  let received: string | undefined;
  const output = JSON.parse(await resolveCodegenModelExport({ dsl: current, locale: 'zh-CN', workspaceId: 'w' }, async () => { throw new Error('offline'); }, async (input) => {
    received = input.dsl;
    return { translations: { New: 'Current translation' } };
  }));
  assert.equal(received, current);
  assert.equal(output.translations['zh-CN'].New, 'Current translation');
});
