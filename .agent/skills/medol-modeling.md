# MEDOL Modeling Skill

Use this skill when helping users create, review, or change MEDOL models.

## Purpose

MEDOL is a Domain Design Language for modeling business domains as executable specifications. A useful MEDOL change should preserve traceability from domain intent to documentation, validation, and code generation.

## Modeling Principles

- Model business language first. Prefer domain terms over implementation terms.
- Organize behavior by timeline-oriented slices before grouping into concepts or aggregates.
- Use commands for intent, events for facts, read models for decisions and views, processors for automation, and specifications for executable examples.
- Use concepts to group lifecycle and consistency boundaries without forcing every slice to start from an aggregate-first design.
- Use `startsLifecycle` on the command that creates a lifecycle instance.
- Use tags to describe dynamic consistency identity and lookup dimensions when a slice participates in a DCB-style boundary.
- Keep field-level data shape in value types and fields; keep cross-entity or business outcome rules in specifications.
- Prefer `then reject "reason"` for business rejection examples.
- Preserve existing user wording unless a rename improves domain clarity.

## Expected Output

When proposing changes, return a focused MEDOL patch proposal with:

- Natural language summary.
- Changed MEDOL block or unified diff.
- Reasoning tied to domain semantics.
- Any unresolved questions.
- Validation risks, if any.

