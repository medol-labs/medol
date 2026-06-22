# Load MEDOL Context

Use this skill before modeling, code generation, or slice implementation tasks.

## Inputs

- Workspace id or workspace path.
- MEDOL source path or in-memory source.
- Optional selected element id, slice id, or document section reference.
- Optional `CodegenModel` or `GenerationPlan` path.

## Steps

1. Locate the active MEDOL document.
2. Parse the source using the MEDOL parser when available.
3. Identify the active domain, context, concept, slice, command, event, read model, processor, or specification.
4. Collect adjacent timeline context before and after the selected slice.
5. Resolve value type references, field mappings, tags, `startsLifecycle`, dependencies, and specifications.
6. If code generation is involved, load `CodegenModel` and `GenerationPlan` if present; otherwise mark them as missing.

## Output

Return a compact context pack with domain, contexts, selected element, timeline, concepts, value types, specifications, generation inputs, and diagnostics.
