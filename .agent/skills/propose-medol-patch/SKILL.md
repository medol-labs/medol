# Propose MEDOL Patch

Use this skill when the agent should suggest a MEDOL change for human review.

## Rules

- Return a proposal, not an automatic edit, unless the caller explicitly requests application.
- Keep patches small and tied to the selected domain element.
- Preserve formatting and naming style from nearby MEDOL.
- Prefer adding missing rules, scenarios, value types, tags, or read models over rewriting whole contexts.
- If a requested code behavior is not represented in MEDOL, propose the MEDOL change first.

## Patch Types

- Add or update value types.
- Add fields, examples, mappings, `from`, or `derived`.
- Add specifications, `rule`, `expression`, and scenarios.
- Add `startsLifecycle`, concept tags, or lifecycle state.
- Add read model or processor slices when implementation needs observable state or automation.

## Output

Return summary, patch, affected elements, validation notes, and whether code generation should run.
