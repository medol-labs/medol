import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseMedol } from './dslParser';
import { buildBehaviorReviews } from './behaviorSemantics';
import { analyzeModel, scopeAnalysis } from '../features/model-analysis/modelAnalysis';

const library = `context Library {
  concept Loan {
    state Requested
    state Approved
    state Declined
    slice RequestLoan
    slice DecideLoan
  }
  slice RequestLoan {
    startsLifecycle
    command RequestLoan { loanId: UUID id generated }
    event LoanRequested { loanId: UUID id }
    state Requested
  }
  slice DecideLoan {
    reactsTo LoanRequested
    command DecideLoan { loanId: UUID id availableCopies: Int }
    event LoanApproved { loanId: UUID id }
    event LoanDeclined { loanId: UUID id }
    specification "Availability" {
      rule """Approve when copies are available; otherwise decline."""
      scenario "Copies Available" {
        given LoanRequested { loanId = "loan-1" }
        when DecideLoan { loanId = "loan-1" availableCopies = 1 }
        then LoanApproved
      }
      scenario "No Copies" {
        given LoanRequested { loanId = "loan-1" }
        when DecideLoan { loanId = "loan-1" availableCopies = 0 }
        then LoanDeclined
      }
    }
  }
}`;

function analyze(text: string) {
  const model = parseMedol(text);
  assert.deepEqual(model.diagnostics, []);
  return { reviews: buildBehaviorReviews(model) };
}

test('distinguishable scenarios with bound results need no review', () => {
  const { reviews } = analyze(library);
  assert.equal(reviews.length, 0);
});

test('same modeled Given/When with different results needs facts, not a guessed contradiction', () => {
  const { reviews } = analyze(library.replace('availableCopies = 0', 'availableCopies = 1'));
  assert.equal(reviews.filter((review) => review.code === 'indistinguishable-scenarios').length, 2);
  assert(reviews.every((review) => review.message.includes('not proof of a contradiction')));
  assert(reviews.every((review) => review.source.range?.start.line));
});

test('assignment order does not provide different business evidence', () => {
  const { reviews } = analyze(library.replace('loanId = "loan-1" availableCopies = 0', 'availableCopies = 1 loanId = "loan-1"'));
  assert.equal(reviews.filter((review) => review.code === 'indistinguishable-scenarios').length, 2);
});

test('Given history order remains significant', () => {
  const text = library.replace('when DecideLoan { loanId = "loan-1" availableCopies = 1 }',
    'given LoanRequested { loanId = "loan-2" } when DecideLoan { loanId = "loan-1" availableCopies = 1 }')
    .replace('given LoanRequested { loanId = "loan-1" }\n        when DecideLoan { loanId = "loan-1" availableCopies = 0 }',
      'given LoanRequested { loanId = "loan-2" } given LoanRequested { loanId = "loan-1" } when DecideLoan { loanId = "loan-1" availableCopies = 1 }');
  const { reviews } = analyze(text);
  assert(!reviews.some((review) => review.code === 'indistinguishable-scenarios'));
});

test('identical rejection results are not treated as different outcomes because scenario IDs differ', () => {
  const { reviews } = analyze(library.replaceAll('then LoanApproved', 'then reject "Unavailable"')
    .replaceAll('then LoanDeclined', 'then reject "Unavailable"').replace('availableCopies = 0', 'availableCopies = 1'));
  assert(!reviews.some((review) => review.code === 'indistinguishable-scenarios'));
});

test('business refusal, execution error and recorded events remain different result kinds', () => {
  const { reviews } = analyze(library.replace('then LoanApproved', 'then reject "Unavailable"')
    .replace('then LoanDeclined', 'then error "Unavailable"').replace('availableCopies = 0', 'availableCopies = 1'));
  assert(reviews.some((review) => review.code === 'indistinguishable-scenarios'));
});

test('same command names in different contexts do not share scenario groups', () => {
  const { reviews } = analyze(library + library.replace('context Library', 'context Warehouse')
    .replace('availableCopies = 0', 'availableCopies = 1'));
  assert.equal(reviews.filter((review) => review.code === 'indistinguishable-scenarios').length, 2);
  assert(reviews.every((review) => review.contextId.includes('Warehouse')));
});

test('only derived fields without sources are flagged as unmapped facts', () => {
  const { reviews } = analyze(`context Shipping {
    slice Catalog { projection AddressCatalog[] { addressId: UUID id } }
    slice Dispatch {
      command Dispatch {
        shipmentId: UUID id generated
        addressId: UUID from AddressCatalog.addressId
        label: String derived { rule "Calculate a label." }
      }
      event Dispatched { shipmentId: UUID id }
    }
  }`);
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].code, 'unmapped-fact');
  assert(reviews[0].message.includes('label'));
});

test('reviews remain scoped by object without exposing duplicate contracts', () => {
  const analysis = analyzeModel(parseMedol(library.replace('availableCopies = 0', 'availableCopies = 1')
    + library.replace('context Library', 'context Warehouse')));
  const scoped = scopeAnalysis(analysis, { ownerId: analysis.owners[0].id });
  assert.equal(scoped.issues.filter((issue) => issue.code === 'indistinguishable-scenarios').length, 2);
  assert(!('contracts' in analysis));
  assert(!('contracts' in scoped));
});

test('implicit first-event edges do not establish a binding for all results in a multi-event slice', () => {
  const { reviews } = analyze(`context Commerce { slice Attempt {
    command Attempt { orderId: UUID }
    event Accepted { orderId: UUID }
    event Declined { orderId: UUID }
    state Accepted
  } }`);
  assert.equal(reviews.filter((review) => review.code === 'unbound-outcome').length, 2);
});

test('a scenario may explicitly bind an outcome declared in another slice', () => {
  const { reviews } = analyze(`context Commerce {
    slice Outcomes { event Accepted { orderId: UUID } }
    slice Attempt {
      command Attempt { orderId: UUID }
      specification "Accept" { when Attempt { orderId = "order-1" } then Accepted }
    }
  }`);
  assert.deepEqual(reviews, []);
});

test('event names do not determine state effects', () => {
  const { reviews } = analyze(`context Demo {
    concept Task { state Open slice Begin }
    slice Begin { startsLifecycle command Begin { taskId: UUID } event LooksFailed { taskId: UUID } state Open }
  }`);
  assert.deepEqual(reviews, []);
});

test('default eligibility replacement is explicitly surfaced without changing composition', () => {
  const model = parseMedol(`context Demo {
    slice Catalog {
      projection Catalog[] { itemId: UUID id active: Boolean
        eligible when { Catalog.active == true }
        eligible for Choose when { Catalog.active == false }
      }
    }
    slice Choose { command Choose { itemId: UUID from Catalog.itemId } }
  }`);
  assert.deepEqual(model.diagnostics, []);
  const analysis = analyzeModel(model);
  assert.equal(analysis.references[0].selected?.profile, 'Choose');
  assert.equal(analysis.references[0].selected?.conditions.length, 1);
  assert(analysis.issues.some((issue) => issue.code === 'profile-replaces-default'));
});

test('documented modeling examples remain syntactically and semantically valid', () => {
  const guide = readFileSync(new URL('../../docs/modeling-semantics.md', import.meta.url), 'utf8');
  for (const block of guide.matchAll(/```medol\n([\s\S]*?)```/g)) assert.deepEqual(parseMedol(block[1]).diagnostics, []);
});

test('optional collections do not produce spurious missing-source reviews', () => {
  const { reviews } = analyze('context Demo { slice Tag { command Tag { labels: String[]? } } }');
  assert.deepEqual(reviews, []);
});
