---
name: medol-modeling
description: Model, review, or change MEDOL domain models.
---

# MEDOL Modeling

Use this skill when creating, reviewing, or changing MEDOL models.

## Baseline Behavior

- Treat MEDOL as the source of truth for the domain model.
- Answer direct questions naturally; selected model items are optional focus, not a required scope.
- When no item is selected, reason over the whole MEDOL model and say that the whole model is being used as context.
- Prefer small focused MEDOL patches over broad rewrites.
- Preserve existing names, ordering, indentation, and user-authored comments where possible.
- Do not silently invent domain rules. Ask for clarification or add/update a hotspot when behavior is unclear.
- Command and event fields do not need to be identical. Event fields may be derived from command fields, concept state, read models, policies, or integrations.
- Treat semantic diagnostics as blocking issues before applying a patch.

## Syntax Reference

- `domain Name { context ... }` groups bounded contexts under a business domain.
- `context Name { type | value | enum | slice | concept | policy | integration | readmodel | userJourney | risk | note | decision | metric }` describes a bounded context.
- `import "./shared-types.medol"` loads another MEDOL file. Imported fragments with the same domain and context are merged before semantic validation.
- `type Name = BaseType { format Name | length min..max | range min..max | matches "pattern" | oneOf value1, value2 }` defines constrained scalar types.
- `enum Name { Value... }` defines a closed business vocabulary.
- `value Name { field: Type... }` defines an immutable structured value object without identity.
- `slice Name { tags { ... } actor | startsLifecycle | ui | reactsTo | command | event | state | specification | readmodel | automation | policy | hotspot }` describes one timeline capability and may live directly under a context.
- `tags { methodId methodCode = normalize(code) }` declares event-selection values used to identify a business concept across slices.
- `concept Name { state StateName* slice SliceName* }` groups context slices, lifecycle states, and code-generation consistency boundaries.
- `command Name { fieldName: Type attributes? mapping? details? example? }` represents user or system intent.
- `event Name { fieldName: Type attributes? mapping? details? }` records a fact after command/rule processing.
- `readmodel Name[]? { subscribe EventName? fieldName: Type ... }` represents information available for queries and UI. `[]` marks collection semantics.
- `ui ViewName form/dialog/drawer/confirm/wizard/inline/background` describes command interaction style.
- `ui ViewName list/detail` describes read-model or page-oriented surfaces when explicitly modeled.
- `state StateName` inside a concept declares a lifecycle enum value.
- `state StateName` inside a slice marks the resulting state after that slice.
- `Owner.State` is the generated lifecycle enum for a concept named `Owner`.
- `startsLifecycle` marks the entry slice that begins a business concept lifecycle.
- `specification "Rule name" { rule """..."""? expression { validation* }? scenario "Example" { given* when then }+ }` defines a business rule and executable examples.
- `then reject "description"` models expected business rejection outcomes.
- `automation Name { condition expression emits CommandName }` captures automatic behavior.
- `policy Name { on EventName issue CommandName }` captures event-triggered command policy.
- `hotspot "..."` records unresolved rules or decisions.

## Modeling Conventions

- Use slices to model timeline flow. Command, event, state, read model, automation, and hotspot placement matters.
- Place read model slices where the timeline makes the resulting information visible.
- Use `startsLifecycle` only on the entry command slice that begins a business concept lifecycle.
- Use state in concept for possible lifecycle states and state in slice for the resulting state after that slice.
- Use `reactsTo` when a slice starts from a prior event instead of a direct UI/user command.
- Events should contain important recorded facts, not necessarily every command input.
- Use reusable type definitions for field-level validity.
- Use specification expressions for business invariants such as uniqueness and business assertions.
- Every `unique` or `assert` expression must be covered by a rejecting scenario whose examples demonstrate the violation.
- Use enum for closed business vocabularies and value for immutable structured values without identity.
- Place slices directly under context, declare their selection tags when needed, and reference them from concept blocks.
- Do not use legacy aggregate/container syntax in new MEDOL.

## Field Mapping Rules

- Use `field: Type from Source.field` when the field is copied or mapped from another element.
- Use `field: Type derived` when the value is computed but the rule is not yet clear.
- Use `field: Type derived from Source.field { rule "..." }` when computation inputs and rule are known.
- Use field details `{ example "..." }` to provide representative values without changing field semantics.
- Use attributes `id`, `generated`, `technical`, and `query` to clarify identity, generated values, non-business fields, and query parameters.

## Patch Rules

- Use `medol_patch_proposal` only when a focused MEDOL operation is appropriate.
- Do not output `nextDsl`; the server applies operations to the current MEDOL.
- Patch preview should be short and focused.
- Patch operations should produce MEDOL that parses after server dry-run unless the response explicitly blocks applying it.
- For patch operations, use targets like `slice CreateOrder`, `readmodel OrderList`, `command CreateOrder`, or `specification Reject duplicate order`.
- Insert operations must include the MEDOL fragment in `content`.
- MEDOL syntax must use ASCII punctuation. Never emit full-width punctuation such as `？ ： ， （ ） ［ ］ ｛ ｝` in MEDOL content.
- To add a new slice, target its owning context and reference it from a concept when it belongs to a business concept.
- Never target an existing slice with another complete slice unless the intent is to insert it as a sibling.

## Examples

### Dynamic consistency boundary

```medol
slice RegisterMethod {
  tags {
    methodId
    methodCode = normalize(code)
  }
  command RegisterMethod {
    methodId: UUID id
    code: String
  }
  event MethodRegistered {
    methodId: UUID id
    code: String
  }
}
concept Method {
  slice RegisterMethod
}
```

### Create concept slice

```medol
slice CreateFederation {
  startsLifecycle
  actor Admin
  ui FederationSetupScreen form
  command CreateFederation {
    federationId: UUID id generated technical
    federationName: String
  }
  event FederationCreated {
    federationId: UUID id
    federationName: String
  }
  state Draft
}
```

### Business rejection

```medol
specification "Organization Name Unique" {
  rule """
    Active organization names must be unique.
  """
  expression {
    unique Organization.organizationName
  }
  scenario "Reject Duplicate Organization" {
    given OrganizationRegistered {
      organizationName = "Acme"
    }
    when RegisterOrganization {
      organizationName = "Acme"
    }
    then reject "Organization name already exists"
  }
}
```
