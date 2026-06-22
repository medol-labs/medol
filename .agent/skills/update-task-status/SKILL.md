# Update Task Status

Use this skill after an agent task changes files, generates code, verifies behavior, or gets blocked.

## Status Values

- `planned`
- `in_progress`
- `review`
- `done`
- `blocked`
- `failed`

## Output

Return an `AgentResult` with status, summary, changed files, verification commands, unresolved questions, and recommended next task.

## Rules

- `done` requires successful verification or an explicit user decision to accept unverified work.
- `blocked` requires a concrete missing decision, missing environment, or repeated tool failure.
- `failed` means the attempted implementation did not satisfy the task and needs correction.
