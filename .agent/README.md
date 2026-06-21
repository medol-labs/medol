# MEDOL Agent Assets

This directory contains runtime-neutral agent knowledge for MEDOL.

The goal is to keep domain-design guidance, task contracts, and runtime-specific execution notes separate:

```text
.agent/
  skills/           Shared MEDOL skills and implementation guidance.
  task-protocols/   Stable JSON task/result contracts for agent runtimes.
  runtimes/         Adapter notes for Codex, Claude Code, OpenCode, and future runtimes.
  examples/         Example task payloads.
```

These files are owned by the MEDOL design platform. The code generator should be treated as a deterministic tool invoked by agent tasks, not as the primary home for modeling skills.

