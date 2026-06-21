# Axon Backend Skill

Use this skill when generating or modifying Kotlin/Spring Boot/Axon backend code from MEDOL.

## Responsibilities

- Commands represent user or system intent.
- Events represent accepted business facts.
- Aggregates/concepts enforce lifecycle and consistency decisions.
- Read models project events into queryable state.
- Processors react to events or read model changes and issue follow-up commands.
- Specifications and scenarios should guide command handler behavior.

## Generation Guidance

- Prefer value types generated from MEDOL value type definitions.
- Keep package names derived from context and root package.
- Preserve generated code boundaries where templates own the file.
- Business rejection examples should become explicit validation paths or command handler branches.
- Unique and cross-entity checks usually require a read model, repository lookup, or DCB query rather than aggregate-local state alone.

## Verification

Run the narrowest available verification first:

- Kotlin compile.
- Unit tests for command handlers and projections.
- Scenario/specification tests when present.

