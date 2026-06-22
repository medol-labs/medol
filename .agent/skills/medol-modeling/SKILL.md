# MEDOL Modeling

Use this skill when creating, reviewing, or changing MEDOL models.

## Purpose

MEDOL is a Domain Design Language for modeling business domains as executable specifications. A useful MEDOL change must stay traceable from domain intent to validation, documentation, UI previews, and code generation.

## Principles

- Model business language first. Prefer domain terms over implementation terms.
- Organize behavior by timeline-oriented slices before grouping into concepts or aggregates.
- Use commands for intent, events for accepted facts, read models for decisions and views, processors for automation, and specifications for executable examples.
- Use concepts to group lifecycle and consistency boundaries without forcing aggregate-first modeling.
- Use `startsLifecycle` on the command that creates a lifecycle instance.
- Use tags to describe dynamic consistency identity and lookup dimensions.
- Keep field-level shape in value types and fields; keep cross-entity or business outcome rules in specifications.
- Use `then reject "reason"` for business rejection examples.
- Preserve existing user wording unless a rename improves domain clarity.

## Output

When proposing changes, return a natural language summary, focused MEDOL patch, affected elements, validation risks, and open questions only when needed.
