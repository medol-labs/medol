import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMedol} from './dslParser';
import {modelToCodegenModel} from './dslToConfig';
const source=`import agent-assistance as Agent deploy Support
context Sales { slice Create { command Create { id: UUID id } event Created { id: UUID id } } }
extend Agent {
 provider assistant { name SalesHelper mode operator }
 provider agentCommand from Sales.Create { assistant SalesHelper confirmation required }
}`;
test('assistant policy is exported from modeling declarations',()=>{
 const parsed=parseMedol(source);assert.deepEqual(parsed.diagnostics,[]);
 const c=modelToCodegenModel(parsed).agentAssistance!;
 assert.equal(c.assistants[0].bindings[0].element,'Create');
 assert.equal(c.assistants[0].bindings[0].confirmation,'required');
});
test('undeclared, read-only and unconfirmed writes fail closed',()=>{
 for(const s of [source.replace('mode operator','mode chat'),source.replace('confirmation required','confirmation none'),source.replace('from Sales.Create','from Sales.Missing')])assert.throws(()=>modelToCodegenModel(parseMedol(s)));
 assert.equal(modelToCodegenModel(parseMedol('context AgentAssistance {}')).agentAssistance,undefined);
});

test('assistant boundaries reject duplicate declarations, unknown policy and query-as-command', () => {
  for (const invalid of [
    source.replace('provider agentCommand', 'provider assistant { name SalesHelper mode operator } provider agentCommand'),
    source.replace('confirmation required', 'confirmation required arbitraryPolicy enabled'),
    source.replace('provider agentCommand from Sales.Create', 'provider agentQuery from Sales.Create'),
    source.replace('assistant SalesHelper confirmation', 'assistant Undeclared confirmation'),
    source.replace('provider agentCommand', 'provider unsupported'),
  ]) assert.throws(() => modelToCodegenModel(parseMedol(invalid)));
});
test('export retains actual field semantics consumed by Agent tools', () => {
  const parsed = parseMedol(source.replace('command Create { id: UUID id }', `command Create {
    id: UUID id generated technical
    name: String
    internal: String technical
    copied: String derived from Input.label by id
  }`).replace('context Sales {', 'context Sales { slice Inputs { readmodel Input[] { id: UUID id label: String } }'));
  assert.deepEqual(parsed.diagnostics, []);
  const exported = modelToCodegenModel(parsed);
  const command = exported.slices.flatMap(slice => slice.commands).find(c => c.name === 'Create')!;
  assert.equal(command.fields.find(f => f.name === 'internal')!.technicalAttribute, true);
  assert.equal(command.fields.find(f => f.name === 'copied')!.source!.kind, 'derived');
});

test('invalid assistant policies are surfaced in editor diagnostics before export', () => {
  const invalid = parseMedol(source.replace('mode operator', 'mode chat'));
  assert(invalid.diagnostics.some(message => message.includes('AgentAssistance') && message.includes('mandatory confirmation')));
});
