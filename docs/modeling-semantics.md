# Business Modeling Semantics

Medol models business facts, operations, rules, results, and state changes.
Business Analysis presents those declarations without inventing missing policy.
The same semantics apply across domains; no particular business system defines
the meaning of a keyword or relationship.

## Operation Semantics

Read each operation through this chain:

```text
existing facts and command inputs
  -> operation prerequisites
  -> business decision
  -> recorded event, business refusal, or execution error
  -> state effect on an identified object
  -> subsequent business behavior
```

These are review questions, not mandatory boilerplate or additional keywords.
Simple single-result slices retain their existing short form.

| Concern | Meaning | Do not substitute |
| --- | --- | --- |
| Input | A value carried by the command | Every command field is not necessarily user-entered. |
| Fact dependency | A value referenced or derived from another modeled fact | A source reference does not state when it was observed or make it immutable. |
| Trigger | An event relationship that leads to subsequent behavior | An event in history is not proof of the current object state or permission to act. |
| Precondition | A requirement for an operation to begin | A lifecycle trigger, actor, or projection filter is not automatically a precondition. |
| Decision | A rule using relevant facts to determine the result | A prose rule does not structurally declare every dependency or branch. |
| Outcome | An event, an explicit refusal, or an execution error | An event named Failed remains an event, not an implicit rejection or error. |
| State effect | A change associated with a particular outcome and object | Multiple events in a slice do not automatically share its declared state. |
| Follow-up | Subsequent business behavior or recovery | An event name does not define retry, cancellation, or compensation policy. |

## Current Language Boundaries

The language already provides commands, events, concepts, slice states, field
mappings, specification expressions, scenarios, and automations. Analysis must
distinguish explicit declarations from inferences and unresolved meaning:

- `startsLifecycle` explicitly marks an entry. It does not prove an object does
  not already exist in a particular scenario.
- `reactsTo` supplies trigger history. Same-object source states may be displayed
  as related history, never as a declared current-state guard.
- A single-event slice with one owning concept and a valid declared state has an
  unambiguous short-form state association.
- A multi-event slice does not specify independent state effects for each event.
  Analysis reports Unknown instead of assigning the first event the slice state
  or guessing other states from event names.
- Missing state declarations do not mean unchanged state.
- Specification assertions remain declared constraints. Analysis does not turn
  every assertion into an operation precondition or execute natural-language rules.
- A derived field without a source is an incomplete fact dependency even when a
  prose derivation rule is present.

Outcome-specific state associations, separately declared operation preconditions,
external decision snapshots, and structured/list scenario assignments remain
expression boundaries. This iteration does not add syntax for them or claim
that analysis resolves those missing declarations.

Analysis does not certify downstream implementations. The lifecycle compatibility
rules below describe what the exporter still supports and where it now refuses
an unsafe inference.

## Reaction Binding

`reactsTo` identifies an event response, not an independently declared permission
to execute a command. The parser no longer attaches it to the first declaration:

- Matching `automation on` and projection `subscribe` declarations identify the
  response targets, regardless of source order. Multiple explicit responders remain
  distinct; none is selected arbitrarily.
- A node explicitly subscribed to a different event is not a fallback target.
- Without a matching explicit binding, a single unbound command, projection, or
  automation can use the existing slice-level shorthand.
- Zero or multiple unbound candidates produce a source-linked diagnostic and
  block export, including direct EmModel-to-CodegenModel export.

```medol
context Orders {
  slice Record {
    event Recorded { orderId: UUID }
  }
  slice Notify {
    reactsTo Recorded
    command Notify { orderId: UUID }
    automation NotifyWhenRecorded {
      on Recorded
      emits Notify
    }
  }
}
```

Here Recorded triggers the automation; the automation emits Notify. Moving the
command above or below the automation does not change the response relationship.
No additional keyword is needed.

## Lifecycle Compatibility

The existing export contract still uses same-owner reaction history to populate
transition `from` / `fromStates`. Removing that convention before an explicit
precondition migration would remove generated guards, so it remains a compatibility
behavior, not the definition of `reactsTo`.

For compatibility, a slice's existing `state` remains associated with its primary
(first) event for export. This does not declare every outcome's state or make
event reordering a safe edit. Analysis continues to flag multi-event mappings as
unclear. Cross-owner reactions never supply the current object's source state.

The exporter no longer uses event names, substrings, synonyms, or a fallback to the
primary event state for a secondary event. When a same-owner reaction would need
such a state to construct its guard, validation and export fail instead of omitting
the guard or guessing a state. A partially known set of source states also fails.

An existing-language migration is a separate state-bearing slice containing the
outcome event and its declared state, referenced by the same owning concept:

```medol
context Processing {
  concept Work {
    state Open
    state Held
    state Retried
    slice Create
    slice RecordHold
    slice Retry
  }
  slice Create {
    startsLifecycle
    command Create { workId: UUID }
    event Created { workId: UUID }
    state Open
  }
  slice RecordHold {
    event HoldRecorded { workId: UUID }
    state Held
  }
  slice Retry {
    reactsTo HoldRecorded
    command Retry { workId: UUID }
    event Retried { workId: UUID }
    state Retried
  }
}
```

This example makes the source state Held independent of event spelling. Moving an
existing event between slices changes its model identity and may require migration
of specifications, generated artifacts, and persisted event compatibility. It is
not an automatic repair of an existing business model. Retain the original
command-to-outcome relationship and verify downstream generation before adopting
such a migration; a syntactically valid split alone does not prove that a command
will still emit that outcome. Dedicated operation
preconditions and per-outcome state syntax remain future modeling work.

## Eligibility Composition

Projection eligibility determines business selection or use, not visibility,
actor authorization, or a complete lifecycle rule.

The existing composition convention remains compatible: choose a matching
business profile first, otherwise use the default. The two conditions are not
implicitly conjoined. Business Analysis flags a selected profile that replaces
a declared default so a modeler can check whether the complete intended
requirement is stated. No automatic migration or reinterpretation is performed.

A common baseline plus additional use-specific constraints is a distinct
composition requirement. Its future expression must be explicit; it cannot be
introduced by silently changing the meaning of existing profiles.

## Scenario Evidence

A scenario name is a description, not a decision fact. Compare scenarios by
their referenced command, specification, ordered Given history, and assigned
input values. Assignment order does not matter; event history order does.

When the same declared Given/When facts lead to different expected results,
analysis marks the scenarios as under-specified. Additional business facts or
policy may explain the alternatives, so the result is not proof of a contradiction.

```medol
context Lending {
  slice Decide {
    command Decide { requestId: UUID availableCopies: Int }
    event Approved { requestId: UUID }
    event Declined { requestId: UUID }

    specification "Availability" {
      rule """Approve when copies are available; otherwise decline."""
      scenario "Copies Available" {
        when Decide { requestId = "request-1" availableCopies = 1 }
        then Approved
      }
      scenario "No Copies" {
        when Decide { requestId = "request-1" availableCopies = 0 }
        then Declined
      }
    }
  }
}
```

The different copy counts distinguish the declared examples. They do not prove
that the prose rule has been executed, nor do they declare the resulting state.
Removing those counts would leave the choice of result unexplained.

## Analysis Results

| Result | Meaning |
| --- | --- |
| Declared | A source declaration or relationship exists; this is not a correctness verdict. |
| Inferred | A relationship suggests historical information without declaring an operation guard. |
| Decision facts insufficient | Identical modeled evidence has alternative results requiring more facts or policy. |
| Source not declared | A derived value does not identify its supporting facts. |
| Relationship not declared | An event is a slice candidate, not a bound outcome for this operation. |
| Unknown | Available declarations do not establish the meaning; do not substitute success, permission, or unchanged state. |

Issue checks also cover commands outside lifecycle concepts and retain source
locations. Filtering by context, object, or slice must not mix identically named
operations from different contexts.

## Modeling Completeness

Review purpose and boundaries; roles and trust; object and fact ownership;
lifecycle; decisions; business eligibility; user tasks; asynchronous business
meaning; exceptions and recovery; external responsibilities; business evolution;
and acceptance evidence. Not all of these belong in new language constructs.
Deployment mechanisms, application implementation, and runtime certification are
outside this modeling review.

New syntax should address a demonstrated expression boundary with the smallest
compatible declaration. Existing short forms and reviewed business policy must
not be silently rewritten.
