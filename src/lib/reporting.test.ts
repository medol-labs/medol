import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMedol} from './dslParser';
import {modelToCodegenModel} from './dslToConfig';
import {analyzeFieldLineage} from './fieldLineage';
import {configToDsl} from './configToDsl';
test('reporting models version publication and private execution lifecycle',()=>{
 const parsed=parseMedol('import reporting as Reports deploy Support');
 assert.deepEqual(parsed.diagnostics,[]);assert.deepEqual(analyzeFieldLineage(parsed).diagnostics,[]);
 const model=modelToCodegenModel(parsed);assert.deepEqual(model.reporting,{context:'Reporting'});
 assert.equal(model.transitions.find(t=>t.command?.name==='PublishReportDefinition')?.to,'Published');
 assert.equal(model.transitions.find(t=>t.command?.name==='RetryReportExecution')?.to,'Requested');
 assert(model.slices.flatMap(s=>s.events).every(e=>!e.fields.some(f=>f.name==='parametersJson')));
 assert.equal(model.slices.flatMap(s=>s.readmodels).length,1);
 assert.throws(()=>configToDsl(model),/cannot restore reporting/);
});
test('reporting is explicit and fails closed for tenancy',()=>{
 assert.equal(modelToCodegenModel(parseMedol('context Reporting {}')).reporting,undefined);
 assert.throws(()=>modelToCodegenModel(parseMedol('import reporting\nimport tenant-management')),/does not support tenancy/);
});
