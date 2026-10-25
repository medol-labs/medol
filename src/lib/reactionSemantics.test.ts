import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMedol } from './dslParser';
import { medolToCodegenModel, modelToCodegenModel } from './dslToConfig';

const source = 'slice Source { event Happened { itemId: UUID } event OtherEvent { itemId: UUID } }';
const targets = (text: string) => {
  const model = parseMedol(`context Demo { ${source} ${text} }`);
  assert.deepEqual(model.diagnostics, []);
  const names = new Map(model.contexts[0].slices.flatMap((slice) => slice.elements.map((element) => [element.id, element.name] as const)));
  return model.edges.filter((edge) => edge.label === 'reactsTo').map((edge) => [names.get(edge.source), names.get(edge.target)]).sort();
};

test('a single response target retains the simple reactsTo form', () => {
  assert.deepEqual(targets('slice Respond { reactsTo Happened command Respond { itemId: UUID } }'), [['Happened', 'Respond']]);
});

test('explicit automation event bindings win independent of declaration order', () => {
  const command = 'command Respond { itemId: UUID }';
  const automation = 'automation RespondWhenHappened { on Happened emits Respond }';
  for (const declarations of [`${command} ${automation}`, `${automation} ${command}`]) {
    assert.deepEqual(targets(`slice Respond { reactsTo Happened ${declarations} }`), [['Happened', 'RespondWhenHappened']]);
  }
});

test('explicit subscriptions bind the projection rather than whichever node appears first', () => {
  assert.deepEqual(targets(`slice Observe {
    reactsTo Happened
    command Respond { itemId: UUID }
    projection Snapshot { itemId: UUID subscribe Happened }
  }`), [['Happened', 'Snapshot']]);
});

test('explicit independent responders are retained rather than selecting only one', () => {
  assert.deepEqual(targets(`slice Respond {
    reactsTo Happened
    command Respond { itemId: UUID }
    automation One { on Happened emits Respond }
    automation Two { on Happened emits Respond }
  }`), [['Happened', 'One'], ['Happened', 'Two']]);
});

test('a responder explicitly bound to another event is not a fallback candidate', () => {
  assert.deepEqual(targets(`slice Respond {
    reactsTo Happened
    automation RespondOnOtherEvent { on OtherEvent emits Respond }
    command Respond { itemId: UUID }
  }`), [['Happened', 'Respond']]);
});

test('unbound command and projection are ambiguous and cannot be exported', () => {
  const text = `context Demo { ${source} slice Respond {
    reactsTo Happened command Respond { itemId: UUID } projection Snapshot { itemId: UUID }
  } }`;
  const model = parseMedol(text);
  assert(model.diagnostics.some((message) => message.includes('no unambiguous response target')));
  assert(!model.edges.some((edge) => edge.label === 'reactsTo'));
  assert(model.diagnosticDetails.some((diagnostic) => diagnostic.message.includes('no unambiguous response target') && diagnostic.range));
  assert.throws(() => medolToCodegenModel(text), /no unambiguous response target/);
  assert.throws(() => modelToCodegenModel(model), /no unambiguous response target/);
});

test('a reactsTo without a response target is not silently discarded', () => {
  const model = parseMedol(`context Demo { ${source} slice Empty { reactsTo Happened } }`);
  assert(model.diagnostics.some((message) => message.includes('no unambiguous response target')));
});

test('unresolved events still produce reference diagnostics', () => {
  const model = parseMedol('context Demo { slice Respond { reactsTo Missing command Respond { itemId: UUID } } }');
  assert(model.diagnostics.some((message) => message.includes('Unresolved reactsTo reference event Missing')));
});

test('an event-only state-bearing slice expresses a source state without name inference', () => {
  const text = `context Demo {
    concept Work { state Open state Held state Retried slice Create slice RecordOutcome slice Retry }
    slice Create { startsLifecycle command Create { workId: UUID } event Created { workId: UUID } state Open }
    slice RecordOutcome { event SurprisinglySuccessfulName { workId: UUID } state Held }
    slice Retry { reactsTo SurprisinglySuccessfulName command Retry { workId: UUID } event Retried { workId: UUID } state Retried }
  }`;
  const model = medolToCodegenModel(text);
  assert.equal(model.transitions.find((transition) => transition.command?.name === 'Retry')?.from, 'Held');
  assert.equal(model.transitions.find((transition) => transition.event?.name === 'SurprisinglySuccessfulName')?.to, 'Held');
});

test('partial known history does not permit export when another same-owner outcome is ambiguous', () => {
  const text = `context Demo {
    concept Work { state Open state Held state Retried slice Create slice Retry }
    slice Create { startsLifecycle command Create { workId: UUID }
      event Created { workId: UUID } event Held { workId: UUID } state Open }
    slice Retry { reactsTo Created reactsTo Held command Retry { workId: UUID } event Retried { workId: UUID } state Retried }
  }`;
  const model = parseMedol(text);
  assert(model.diagnostics.some((message) => message.includes('reactsTo Held cannot establish a lifecycle guard')));
  assert.throws(() => modelToCodegenModel(model), /no explicit state association/);
});

test('explicit responders do not duplicate or remove an existing lifecycle guard', () => {
  const text = `context Demo {
    concept Work { state Open state Ready slice Create slice Prepare }
    slice Create { startsLifecycle command Create { workId: UUID } event Created { workId: UUID } state Open }
    slice Prepare {
      reactsTo Created
      command Prepare { workId: UUID }
      automation First { on Created emits Prepare }
      automation Second { on Created emits Prepare }
      event Prepared { workId: UUID }
      state Ready
    }
  }`;
  const model = medolToCodegenModel(text);
  const transition = model.transitions.find((item) => item.command?.name === 'Prepare')!;
  assert.equal(transition.from, 'Open');
  assert.equal(transition.fromStates, undefined);
  assert.equal(transition.trigger?.name, 'Created');
  assert.equal(transition.triggers, undefined);
});
