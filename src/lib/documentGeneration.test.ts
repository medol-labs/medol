import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMedol} from './dslParser';
import {modelToCodegenModel} from './dslToConfig';
import {analyzeFieldLineage} from './fieldLineage';
import {configToDsl} from './configToDsl';
test('document generation explicitly imports lifecycle, versioned templates and result events',()=>{
 const parsed=parseMedol('import document-generation as Documents deploy Support');
 assert.deepEqual(parsed.diagnostics,[]);assert.deepEqual(analyzeFieldLineage(parsed).diagnostics,[]);
 const model=modelToCodegenModel(parsed);
 assert.deepEqual(model.documentGeneration,{context:'DocumentGeneration'});
 assert.equal(model.transitions.find(t=>t.command?.name==='PublishDocumentTemplateVersion')?.to,'Published');
 assert.equal(model.transitions.find(t=>t.command?.name==='RetireDocumentTemplateVersion')?.from,'Published');
 assert(model.slices.some(s=>s.events.some(e=>e.name==='DocumentGenerationCompleted')));
 assert(!model.slices.flatMap(s=>s.events).flatMap(e=>e.fields).some(f=>f.name==='snapshotJson'));
 assert.throws(()=>configToDsl(model),/cannot restore document-generation/);
});
test('ordinary contexts do not enable document runtime and tenant use fails closed',()=>{
 assert.equal(modelToCodegenModel(parseMedol('context DocumentGeneration {}')).documentGeneration,undefined);
 assert.throws(()=>modelToCodegenModel(parseMedol('import document-generation\nimport tenant-management')),/does not support tenancy/);
});
