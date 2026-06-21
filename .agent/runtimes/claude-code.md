# Claude Code Runtime Adapter

Use Claude Code when running a Martin-style local build kit workflow based on skills, commands, hooks, and project memory.

## Adapter Contract

- Convert MEDOL tasks into Claude Code prompts or slash-command inputs.
- Keep runtime-specific commands outside shared MEDOL skills.
- Use task protocol files as the stable input/output contract.
- Persist useful project conventions in local Claude Code memory only when they are runtime-specific.

## Strengths

- Local coding workflow.
- Skill and hook ecosystem.
- Close fit for Eventmodelers Build Kits style workflows.

