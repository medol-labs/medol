import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMedol } from './dslParser';
import { modelToCodegenModel } from './codegenModel';
import { sourceSha256, withCodegenProvenance } from './codegenProvenance';

test('exported JSON preserves the exact source and release identity', async () => {
  const dsl = 'domain Orders {}';
  const model = modelToCodegenModel(parseMedol(dsl));
  const result = await withCodegenProvenance(model, dsl, {
    workspaceId: 'orders',
    version: {
      id: 'snapshot-2', workspaceId: 'orders', versionNo: 2, dsl, modelHash: 'fnv1a-example',
      message: 'Release', createdAt: '2026-10-21',
      release: { channel: 'stable', label: 'v1.0.0', releasedAt: '2026-10-21' }
    }
  });
  const metadata = JSON.parse(JSON.stringify(result)).metadata;
  assert.equal(metadata.source.sha256, await sourceSha256(dsl));
  assert.equal(metadata.source.release.label, 'v1.0.0');
  assert.equal(metadata.source.versionId, 'snapshot-2');
  assert.notEqual(metadata.source.sha256, await sourceSha256(`${dsl}\n`));
  await assert.rejects(withCodegenProvenance(model, `${dsl}\n`, {
    version: { id: 'old', workspaceId: 'orders', versionNo: 1, dsl, modelHash: '', message: '', createdAt: '' }
  }), /does not match/);
});

test('CLI release labels normalize and draft exports have no release baseline', async () => {
  const dsl = 'domain Orders {}';
  const model = modelToCodegenModel(parseMedol(dsl));
  assert.equal((await withCodegenProvenance(model, dsl)).metadata?.source.release, undefined);
  assert.equal((await withCodegenProvenance(model, dsl, { releaseLabel: '1.2.3' })).metadata?.source.release?.label, 'v1.2.3');
  await assert.rejects(withCodegenProvenance(model, dsl, { releaseLabel: 'v1.2.3.4' }), /vX.Y.Z/);
});
