# Build Automation

Use this skill for slices with processors, policies, scheduled work, or event-driven follow-up commands.

## Steps

1. Identify trigger: event, read model condition, schedule, or external signal.
2. Identify command emitted by the automation.
3. Check idempotency and duplicate-trigger behavior.
4. Implement processor or workflow.
5. Add tests for trigger, condition, emitted command, and no-op cases.
6. Run verification.

## Rules

- Automation should explain why it reacts, not only what it calls.
- Avoid hidden coupling to UI commands.
- If the automation depends on a read model condition, make the read model dependency explicit in the generation plan or task context.
