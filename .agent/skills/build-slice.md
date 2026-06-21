# Build Slice Skill

Use this skill when implementing one MEDOL slice in a generated or existing application workspace.

## Inputs

The task should provide:

- MEDOL source or selected model element.
- `CodegenModel` or `GenerationPlan`.
- Slice id/name/title.
- Target workspace path.
- Target stack: `axon`, `refine`, or `fullstack`.
- Acceptance criteria.

## Process

1. Read the selected slice and its surrounding context.
2. Identify command, event, read model, processor, specification, value types, concept, tags, and dependencies.
3. Inspect existing generated code before editing.
4. Make the smallest implementation change that satisfies the slice.
5. Run relevant build, tests, or type checks.
6. Report changed files and verification results.

## Constraints

- Do not silently change MEDOL source unless the task asks for a modeling patch.
- Do not bypass deterministic generation for foundation files that should come from `code-generator`.
- If the generated structure is wrong, report a generator issue instead of patching many generated files by hand.
- Keep domain rules traceable to specification scenarios where possible.

