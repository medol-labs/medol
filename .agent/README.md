# MEDOL Agent Assets

This directory contains runtime-neutral agent knowledge for MEDOL.

The goal is to keep domain-design guidance, task contracts, and runtime-specific execution notes separate:

```text
.agent/
  skills/           Runtime-neutral MEDOL skills. Each skill is a directory with SKILL.md.
  task-protocols/   Stable JSON task/result contracts for agent runtimes.
  runtimes/         Adapter notes for Codex, Claude Code, OpenCode, and future runtimes.
  examples/         Example task payloads.
```

These files are owned by the MEDOL design platform. The code generator should be treated as a deterministic tool invoked by agent tasks, not as the primary home for modeling skills.

## Skill Levels

- Foundation skills describe MEDOL modeling, documentation, validation, and stack conventions.
- Execution skills describe how an agent should load context, propose patches, run codegen, implement slices, fix generation errors, and report task status.
- Runtime files describe how Codex, Claude Code, OpenCode, or future runtimes adapt the same skills and task protocols.
