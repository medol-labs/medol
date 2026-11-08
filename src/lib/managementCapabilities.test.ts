import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMedol} from './dslParser';
import {modelToCodegenModel} from './dslToConfig';
import {analyzeFieldLineage} from './fieldLineage';
import {configToDsl} from './configToDsl';
test('organization and configuration imports have explicit runtime contracts and sourced events',()=>{
 const parsed=parseMedol('import organization-management as Org deploy App\nimport system-configuration as Settings deploy App');
 assert.deepEqual(parsed.diagnostics,[]);assert.deepEqual(analyzeFieldLineage(parsed).diagnostics,[]);
 const model=modelToCodegenModel(parsed);
 assert.deepEqual(model.organizationManagement,{context:'OrganizationManagement'});
 assert.deepEqual(model.systemConfiguration,{context:'SystemConfiguration'});
 assert(model.slices.some(s=>s.commands.some(c=>c.name==='TransferPositionAssignment')));
 assert(model.slices.some(s=>s.events.some(e=>e.name==='PositionAssignmentTransferredIn')));
 assert(model.transitions.some(t=>t.command?.name==='DeactivateOrganizationUnit' && t.to==='Inactive'));
 assert.throws(()=>configToDsl(model),/cannot restore/);
});
test('ordinary context names do not enable capabilities and unsafe tenant combinations fail closed',()=>{
 const plain=modelToCodegenModel(parseMedol('context OrganizationManagement {}\ncontext SystemConfiguration {}'));
 assert.equal(plain.organizationManagement,undefined);assert.equal(plain.systemConfiguration,undefined);
 assert.throws(()=>modelToCodegenModel(parseMedol('import organization-management\nimport tenant-management')),/does not support tenancy/);
 const tenant=modelToCodegenModel(parseMedol('import system-configuration\nimport tenant-management'));
 assert(tenant.systemConfiguration);assert(tenant.tenancy);
});
