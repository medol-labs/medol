# Build State Change

Use this skill for a slice that contains a command and one or more resulting events or rejections.

## Steps

1. Load command fields, event fields, mappings, derived fields, value types, and examples.
2. Identify lifecycle owner: command with `startsLifecycle`, concept/aggregate, id field, and tags.
3. Read specifications: `given`, `when`, `then Event`, and `then reject "reason"`.
4. Decide validation location: value type, command handler, read model lookup, DCB query, or external service.
5. Implement command handling, event emission, and rejection paths.
6. Add or update tests from scenarios.
7. Run backend verification.

## Output

Return changed files, generated behavior, implemented scenarios, and verification result.
