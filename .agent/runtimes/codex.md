# Codex Runtime Adapter

Use Codex for repository-aware engineering tasks: reading code, applying patches, running verification, reviewing diffs, and committing changes.

## Adapter Contract

- Translate MEDOL task payloads into concise coding objectives.
- Attach relevant skill files as context.
- Prefer deterministic tools and repository tests over free-form generation.
- Return `AgentResult` after verification.

## Strengths

- Deep repo navigation.
- Patch review and implementation.
- Test/debug loops.
- Git workflow support.

