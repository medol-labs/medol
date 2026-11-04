import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMedol } from './dslParser';
import { modelToCodegenModel } from './dslToConfig';

function builtin(name: string) {
  const model = parseMedol(`import ${name} as CustomCapability deploy Support`);
  assert.deepEqual(model.diagnostics, []);
  return modelToCodegenModel(model);
}

test('account role assignment preserves lifecycle and only active accounts are selectable', () => {
  const model = builtin('identity-access-management');
  const transitions = model.transitions;
  assert.equal(transitions.find(t => t.command?.name === 'ReactivateUserAccount')?.from, 'Deactivated');
  assert.equal(transitions.find(t => t.command?.name === 'DeactivateUserAccount')?.from, 'Active');
  const assignment = transitions.find(t => t.command?.name === 'AssignRoleToUser')!;
  assert.equal(assignment.from, 'Active');
  assert.equal(assignment.to, undefined);
  assert.equal(assignment.event, undefined);
  const catalog = model.slices.flatMap(s => s.readmodels).find(r => r.name === 'UserAccountCatalog')!;
  assert.deepEqual(catalog.eligibility?.[0].conditions, [{left: 'UserAccount.state', operator: '==', right: 'Active'}]);
  for (const name of ['RegisterUserAccount', 'RegisterRole', 'RegisterPermission']) {
    assert(model.slices.find(s => s.name === name)!.specifications.some(spec => spec.expressions?.some(e => e.startsWith('unique '))));
  }
});

test('dictionary creation selects a usable parent and values have independent eligibility', () => {
  const model = builtin('dictionary-maintenance');
  const catalog = model.slices.flatMap(s => s.readmodels).find(r => r.name === 'DictionaryValueCatalog')!;
  assert.deepEqual(catalog.eligibility?.[0].conditions.map(c => c.right), ['Active']);
  const add = model.slices.find(s => s.name === 'AddDictionaryValue')!;
  assert(add.commands[0].fields.find(f => f.name === 'dictionaryId')?.source);
  assert(add.specifications.length > 0);
});

test('download accepts available and referenced files without allowing discard after reference', () => {
  const model = builtin('file-upload');
  const download = model.slices.find(s => s.name === 'DownloadFile')!.commands[0];
  assert.deepEqual(download.dependencies.filter(d => d.direction === 'INBOUND' && d.elementType === 'EVENT').map(d => d.title).sort(), ['File Referenced', 'File Uploaded']);
  const guard = model.transitions.find(t => t.command?.name === 'DownloadFile')!;
  assert.deepEqual(guard.fromStates, ['Available', 'Referenced']);
  assert.equal(guard.to, undefined);
  const discard = model.transitions.find(t => t.command?.name === 'DiscardFile');
  assert.equal(discard?.from, 'Available');
});

test('data exchange has explicit guards for each job phase and independent aliases', () => {
  const model = builtin('data-exchange');
  for (const kind of ['Import', 'Export']) {
    assert.equal(model.transitions.find(t => t.command?.name === `RequestData${kind}`)?.startsLifecycle, true);
    assert.equal(model.transitions.find(t => t.command?.name === `MarkData${kind}Processing`)?.from, 'Requested');
    assert.equal(model.transitions.find(t => t.command?.name === `CompleteData${kind}`)?.from, 'Processing');
    assert.deepEqual(model.transitions.find(t => t.command?.name === `FailData${kind}`)?.fromStates, ['Requested', 'Processing']);
    const job = model.slices.find(s => s.name === `Data${kind}Job`)!;
    assert.equal(job.commands.length, 1);
    assert.equal(job.processors[0].metadata?.uses, `DataExchange.${kind.toLowerCase()}`);
  }
});

test('batch notification acknowledgement does not guard a notification by recipient id', () => {
  const model = builtin('system-notification');
  const batch = model.slices.find(s => s.name === 'MarkAllSystemNotificationsRead')!;
  assert.deepEqual(batch.concepts, ['RecipientNotificationAcknowledgement']);
  assert(!batch.commands[0].dependencies.some(d => d.direction === 'INBOUND'));
  assert(!model.valueTypes.find(t => t.name === 'NotificationCategory')?.values?.includes('TRAINING'));
});


test('state-preserving guards do not infer secondary outcomes or automation command preconditions', () => {
  const text = `context Example {
    slice Start {
      startsLifecycle
      command Start { id: UUID id }
      event Started { id: UUID id }
      event StartFailed { id: UUID id }
      state Ready
    }
    slice React {
      reactsTo Started
      reactsTo StartFailed
      command React { id: UUID id }
      event Reacted { id: UUID id }
    }
    slice Schedule {
      reactsTo Started
      automation ScheduleOnStart { on Started emits Continue }
      command Continue { id: UUID id }
      event Continued { id: UUID id }
    }
    concept Work { state Ready slice Start slice React slice Schedule }
  }`;
  const parsed = parseMedol(text);
  assert.deepEqual(parsed.diagnostics, []);
  const model = modelToCodegenModel(parsed);
  assert(!model.transitions.some(t => ['React', 'Continue'].includes(t.command?.name ?? '')));
});
