import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMedol} from './dslParser';
import {modelToCodegenModel} from './dslToConfig';
import {configToDsl} from './configToDsl';
import {analyzeFieldLineage} from './fieldLineage';

const source = 'import archiving as Archives deploy Support';
test('archiving import exports request contracts and event-backed catalogs', () => {
  const parsed = parseMedol(source);
  assert.deepEqual(parsed.diagnostics, []);
  assert.deepEqual(analyzeFieldLineage(parsed).diagnostics, []);
  const model = modelToCodegenModel(parsed);
  assert.deepEqual(model.archiving, {context: 'Archiving'});
  for (const [kind, names] of [
    ['Batch', ['batchId', 'targetKey', 'cutoffAt', 'batchSize']],
    ['Restore', ['restoreId', 'archiveId']],
  ] as const) {
    const slice = model.slices.find(s => s.name === `RequestArchive${kind}`)!;
    assert.deepEqual(slice.commands[0].fields.map(f => f.name), names);
    assert.deepEqual(slice.events[0].fields.map(f => f.name), names);
    assert.equal(slice.events[0].name, `Archive${kind}Requested`);
    const transition = model.transitions.find(t => t.command?.name === `RequestArchive${kind}`)!;
    assert.equal(transition.to, 'Requested');
    assert.equal(transition.startsLifecycle, true);
    const catalog = model.slices.flatMap(s => s.readmodels).find(r => r.name === `Archive${kind}Catalog`)!;
    assert.deepEqual(catalog.fields.map(f => f.name), names);
  }
});
test('archiving requires import and preserves source roundtrip; legacy reverse export fails closed', () => {
  assert.equal(modelToCodegenModel(parseMedol('context Archiving {}')).archiving, undefined);
  const exported = modelToCodegenModel(parseMedol(source));
  const restoredSource = JSON.parse(JSON.stringify({medol: source})).medol;
  assert.equal(restoredSource, source);
  assert.deepEqual(modelToCodegenModel(parseMedol(restoredSource)), exported);
  assert.throws(() => configToDsl(exported), /cannot restore archiving/);
});
test('archiving rejects tenancy independent of deployment and import order', () => {
  for (const text of [
    `${source}\nimport tenant-management deploy Support`,
    `import tenant-management deploy Tenants\n${source}`,
  ]) {
    const parsed = parseMedol(text);
    assert.deepEqual(parsed.diagnostics, []);
    assert.throws(() => modelToCodegenModel(parsed), /Archiving does not support tenancy/);
  }
});

test('scheduling binds archive batch identity and dynamic scan upper bound using canonical context', () => {
  const binding = `${source}
import scheduling as Schedules deploy Support
extend Schedules {
  provider scheduledCommand from Archiving.RequestArchiveBatch {
    occurrenceId batchId
    scheduledAt cutoffAt
  }
}`;
  const parsed = parseMedol(binding);
  assert.deepEqual(parsed.diagnostics, []);
  assert.deepEqual(analyzeFieldLineage(parsed).diagnostics, []);
  const model = modelToCodegenModel(parsed);
  assert.deepEqual(model.scheduling, {context: 'Scheduling', targets: [{
    key: 'Archiving.RequestArchiveBatch', context: 'Archiving', command: 'RequestArchiveBatch',
    occurrenceField: 'batchId', scheduledAtField: 'cutoffAt',
  }]});
  const command = model.slices.flatMap(s => s.commands).find(c => c.name === 'RequestArchiveBatch')!;
  assert.deepEqual(command.fields.filter(f => !['batchId', 'cutoffAt'].includes(f.name)).map(f => f.name), ['targetKey', 'batchSize']);
  const alias = parseMedol(binding.replace('from Archiving.', 'from Archives.'));
  assert.deepEqual(alias.diagnostics, []);
  assert.throws(() => modelToCodegenModel(alias), /Scheduling target Archives.RequestArchiveBatch must resolve/);
});
