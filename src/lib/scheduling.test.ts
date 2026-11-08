import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMedol} from './dslParser';
import {modelToCodegenModel} from './dslToConfig';
import {analyzeFieldLineage} from './fieldLineage';
const source=`import scheduling as Schedules deploy Support
context Reports { slice RunReport { startsLifecycle command RunReport { runId: UUID id requestedAt: DateTime reportCode: String } event ReportRequested { runId: UUID id requestedAt: DateTime reportCode: String } state Requested } concept ReportRun { state Requested slice RunReport } }
extend Schedules { provider scheduledCommand from Reports.RunReport { occurrenceId runId scheduledAt requestedAt } }`;
test('scheduling exports closed typed command bindings and complete lifecycle',()=>{
 const model=parseMedol(source);assert.deepEqual(model.diagnostics,[]);assert.deepEqual(analyzeFieldLineage(model).diagnostics,[]);
 const codegen=modelToCodegenModel(model);
 assert.deepEqual(codegen.scheduling,{context:'Scheduling',targets:[{key:'Reports.RunReport',context:'Reports',command:'RunReport',occurrenceField:'runId',scheduledAtField:'requestedAt'}]});
 assert.equal(codegen.transitions.find(t=>t.command?.name==='PauseSchedule')?.from,'Active');
 assert.equal(codegen.transitions.find(t=>t.command?.name==='ResumeSchedule')?.from,'Paused');
});
test('scheduling rejects unresolved and incompatible command bindings',()=>{
 for(const text of [source.replace('from Reports.RunReport','from Reports.Missing'),source.replace('occurrenceId runId','occurrenceId reportCode'),source.replace('scheduledAt requestedAt','scheduledAt reportCode'),source.replace('occurrenceId runId','unknown runId')]) {
  const parsed=parseMedol(text);assert.deepEqual(parsed.diagnostics,[]);assert.throws(()=>modelToCodegenModel(parsed),/Scheduling/);
 }
});
test('builtin opt-in and tenant control-plane ownership',()=>{
 assert.equal(modelToCodegenModel(parseMedol('context Scheduling {}')).scheduling,undefined);
 const model=modelToCodegenModel(parseMedol('import scheduling deploy Support\nimport tenant-management deploy Support'));
 assert(model.tenancy?.managementContexts.includes('Scheduling'));
});
