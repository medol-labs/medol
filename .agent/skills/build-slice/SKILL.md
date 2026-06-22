# Build Slice

Use this skill when implementing one MEDOL slice in a generated or existing application workspace.

## Inputs

- MEDOL context pack.
- `CodegenModel` or `GenerationPlan`.
- Slice id/name/title.
- Target workspace path.
- Target stack: `axon`, `refine`, or `fullstack`.
- Acceptance criteria.

## Process

1. Load the slice and adjacent timeline context.
2. Identify whether the slice is state change, read model, automation, frontend resource, or mixed.
3. Decide whether deterministic `code-generator` must run first.
4. Inspect existing generated code before editing.
5. Apply the narrowest implementation change.
6. Run relevant build, tests, or type checks.
7. Return `AgentResult`.

## Constraints

- Do not silently change MEDOL source unless the task asks for a modeling patch.
- Do not bypass deterministic generation for foundation files that should come from `code-generator`.
- If generated structure is wrong, report a generator issue instead of patching many generated files by hand.
- Keep domain rules traceable to specification scenarios where possible.
