import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMedol} from './dslParser';
import {modelToCodegenModel} from './dslToConfig';
import {analyzeFieldLineage} from './fieldLineage';
import {configToDsl} from './configToDsl';
test('business calendar exposes explicit lifecycle and complete versioned snapshots',()=>{
 const parsed=parseMedol('import business-calendar as Calendar deploy Support');
 assert.deepEqual(parsed.diagnostics,[]);assert.deepEqual(analyzeFieldLineage(parsed).diagnostics,[]);
 const model=modelToCodegenModel(parsed);
 assert.deepEqual(model.businessCalendar,{context:'BusinessCalendar'});
 assert.equal(model.transitions.find(t=>t.command?.name==='ActivateBusinessCalendar')?.to,'Active');
 assert.equal(model.transitions.find(t=>t.command?.name==='SuspendBusinessCalendar')?.from,'Active');
 for(const event of model.slices.flatMap(s=>s.events)) assert(event.fields.some(f=>f.name==='dateOverridesJson'));
 assert.throws(()=>configToDsl(model),/cannot restore business-calendar/);
});
test('ordinary calendar context does not enable runtime and tenancy is explicitly rejected',()=>{
 assert.equal(modelToCodegenModel(parseMedol('context BusinessCalendar {}')).businessCalendar,undefined);
 assert.throws(()=>modelToCodegenModel(parseMedol('import business-calendar\nimport tenant-management')),/does not support tenancy/);
});
