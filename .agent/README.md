# MEDOL Agent Skills

This directory is the runtime-neutral knowledge source for the MEDOL assistant.

```text
.agent/
  skills/
    medol-modeling/
      SKILL.md
    propose-medol-patch/
      SKILL.md
    ...
```

The MEDOL server reads these files at runtime and injects the relevant skill
content into agent prompts. Keep product and modeling guidance here instead of
hard-coding long instruction blocks in TypeScript.

Runtime adapters such as Claude Code, Codex, or OpenCode can consume these same
skills, but runtime-specific configuration belongs outside this directory.
