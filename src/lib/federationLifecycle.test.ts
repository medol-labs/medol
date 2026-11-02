import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMedolFile } from './medolProject';
import { modelToCodegenModel } from './codegenModel';

const model = parseMedolFile(new URL('../../examples/fl/federation-learning.medol', import.meta.url).pathname);
const codegen = modelToCodegenModel(model);
const failures = [
  ['ValidateAgentDatasetAccess', 'AgentDatasetAccessValidationFailed', 'Failed'],
  ['ProfileAgentDataset', 'AgentDatasetProfilingFailed', 'Failed'],
  ['ValidateDatasetContract', 'DatasetContractValidationFailed', 'ContractValidationFailed'],
  ['StartRoundExecution', 'RoundExecutionStartFailed', 'StartFailed'],
  ['RetryRoundExecutionAfterStartFailure', 'RoundExecutionStartRetryFailed', 'StartFailed'],
  ['RetryRoundExecutionAfterRuntimeFailure', 'RoundExecutionRuntimeRetryFailed', 'Failed']
];

test('Federation failure outcomes have explicit states and remain command outputs', () => {
  assert.deepEqual(model.diagnostics, []);
  for (const [commandName, eventName, state] of failures) {
    const slice = codegen.slices.find((slice) => slice.commands.some((command) => command.name === commandName))!;
    const command = slice.commands.find((command) => command.name === commandName)!;
    const eventSlice = codegen.slices.find((slice) => slice.events.some((event) => event.name === eventName))!;
    const event = eventSlice.events.find((event) => event.name === eventName)!;
    assert.notEqual(eventSlice.id, slice.id);
    assert.equal(eventSlice.stateChange?.eventId, event.id);
    assert.equal(eventSlice.stateChange?.to, state);
    assert.ok(command.dependencies.some((dependency) => dependency.id === event.id
      && dependency.direction === 'OUTBOUND' && dependency.elementType === 'EVENT'), commandName);
    assert.ok(slice.specifications.some((specification) => specification.then.some((item) => item.id === event.id)), eventName);
  }
});

test('Federation retry and cleanup guards use declared failure states', () => {
  for (const [name, from] of [
    ['RevalidateAgentDatasetAccess', 'Failed'], ['ReprofileAgentDataset', 'Failed'],
    ['RetryDatasetContractValidation', 'ContractValidationFailed'],
    ['RetryRoundExecutionAfterStartFailure', 'StartFailed'],
    ['ReleaseRuntimeEngineJobAfterStartFailure', 'StartFailed'],
    ['ReleaseRuntimeEngineJobAfterRetryFailure', 'StartFailed'],
    ['ReleaseRuntimeEngineJobAfterRuntimeRetryFailure', 'Failed']
  ]) {
    const transition = codegen.transitions.find((transition) => transition.command?.name === name);
    assert.equal(transition?.from, from, name);
    assert.equal(transition?.startsLifecycle, false, name);
  }
});
