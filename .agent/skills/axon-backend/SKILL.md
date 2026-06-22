# Axon Backend

Use this skill when generating or modifying Kotlin/Spring Boot/Axon backend code from MEDOL.

## Responsibilities

- Commands represent user or system intent.
- Events represent accepted business facts.
- Concepts/aggregates enforce lifecycle and consistency decisions.
- Read models project events into queryable state.
- Processors react to events or read model changes and issue follow-up commands.
- Specifications and scenarios guide command handler behavior.

## Guidance

- Prefer value types generated from MEDOL value type definitions.
- Keep package names derived from context and root package.
- Preserve generated code boundaries where templates own the file.
- Business rejection examples should become explicit validation paths or command handler branches.
- Unique and cross-entity checks usually require a read model, repository lookup, or DCB query rather than aggregate-local state alone.

## Verification

Run Kotlin compile, unit tests, and scenario/specification tests when available.
