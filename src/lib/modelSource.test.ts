import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMedol, parseMedolSources } from './dslParser';
import { canvasBoards, builtinCanvasId, resolveCanvasBoard } from './canvasScope';
import { canLocateInEditor, hasBuiltinSource, isBuiltinDefinition } from './modelSource';
import { modelToCodegenModel } from './codegenModel';

test('business contexts with familiar library names remain business definitions', () => {
  const model = parseMedol('domain FileUpload { context IdentityAccessManagement {} }');
  assert.equal(canvasBoards(model)[0].kind, 'domain');
  assert.equal(isBuiltinDefinition(model.contexts[0]), false);
});

test('actual source metadata identifies arbitrarily named built-in contexts', () => {
  const model = parseMedolSources([
    { sourceName: 'library.medol', builtin: true, text: 'domain Shared { context Records {} }' },
    { sourceName: '<memory>', text: 'domain Business { context Work {} }' }
  ]);
  assert.deepEqual(canvasBoards(model).map((board) => board.name), ['Business', 'Built-in capabilities']);
  const records = model.contexts.find((context) => context.name === 'Records')!;
  assert.equal(isBuiltinDefinition(records), true);
  assert.equal(resolveCanvasBoard(model, { contextId: records.id })?.id, builtinCanvasId);
});

test('a source name resembling a built-in import is not an authority flag', () => {
  const model = parseMedolSources([{ sourceName: '<builtin:imaginary>', text: 'domain Normal { context Normal {} }' }]);
  assert.equal(isBuiltinDefinition(model.contexts[0]), false);
  assert.equal(canvasBoards(model)[0].kind, 'domain');
});

test('mixed context fragments preserve local extensions and all source identities', () => {
  const model = parseMedolSources([
    { sourceName: 'library.medol', builtin: true, text: 'domain Shared { context Records { slice LibraryAction { command LibraryAction { recordId: UUID } } } }' },
    { sourceName: '<memory>', text: 'domain Shared { context Records { slice LocalAction { command LocalAction { recordId: UUID } } } }' }
  ]);
  assert.deepEqual(model.diagnostics, []);
  const context = model.contexts[0];
  assert.equal(hasBuiltinSource(context), true);
  assert.equal(isBuiltinDefinition(context), false);
  assert.deepEqual(new Set(context.sources?.map((source) => source.sourceName)), new Set(['<memory>', 'library.medol']));
  assert.equal(canvasBoards(model)[0].kind, 'domain');
  assert.equal(context.slices.length, 2);
  assert.equal(canLocateInEditor(context.slices.find((slice) => slice.name === 'LocalAction')!.sourceRange), true);
  assert.equal(canLocateInEditor(context.slices.find((slice) => slice.name === 'LibraryAction')!.sourceRange), false);
});

test('plain imported contexts do not disappear from the unassigned viewing scope', () => {
  const model = parseMedolSources([
    { sourceName: 'imported.medol', text: 'context Imported {}' },
    { sourceName: '<memory>', text: 'domain Business { context Work {} }' }
  ]);
  assert.deepEqual(canvasBoards(model).map((board) => board.name), ['Business', 'Unassigned contexts']);
});

test('one built-in context can serve multiple aliases and deployments without duplicating the canvas', () => {
  const model = parseMedol(`import identity-access-management as First deploy FirstService
    import identity-access-management as Second deploy SecondService
    domain Business { context Work {} }`);
  assert.deepEqual(model.diagnostics, []);
  const library = canvasBoards(model).find((board) => board.id === builtinCanvasId)!;
  assert.equal(library.contexts.length, 1);
  assert.equal(library.contexts[0].sources?.length, 1);
  assert.equal(model.deployments.filter((deployment) => deployment.contexts.includes(library.contexts[0].name)).length, 2);
  assert.equal(model.capabilityImports?.length, 2);
  const baseline = structuredClone(model);
  for (const context of baseline.contexts) delete context.sources;
  for (const domain of baseline.domains) delete domain.sources;
  assert.deepEqual(modelToCodegenModel(model), modelToCodegenModel(baseline));
});

test('imported file coordinates cannot be used to locate a declaration in the active editor', () => {
  const range = { start: { line: 10, column: 1 }, end: { line: 12, column: 1 } };
  assert.equal(canLocateInEditor({ ...range, sourceName: 'library.medol' }), false);
  assert.equal(canLocateInEditor({ ...range, sourceName: '<memory>' }), true);
  assert.equal(canLocateInEditor(range), true);
});
