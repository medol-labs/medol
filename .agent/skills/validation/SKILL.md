# MEDOL Validation

Use this skill when checking MEDOL syntax, semantics, and generation readiness.

## Validation Areas

- Syntax validity.
- Stable ids and import references.
- Domain/context/slice hierarchy.
- Concept and lifecycle consistency.
- `startsLifecycle` command placement.
- Command/event/read model dependencies.
- Value type references and constraints.
- Specification scenarios and rejection outcomes.
- Code generation readiness for Axon and Refine.

## Guidance

- Distinguish hard errors from modeling warnings.
- Prefer actionable diagnostics tied to exact MEDOL elements.
- Do not treat command/event field differences as errors by default; event fields may be derived from command input, system state, or rules.
- Ask for missing domain decisions only when generation or validation genuinely depends on them.
