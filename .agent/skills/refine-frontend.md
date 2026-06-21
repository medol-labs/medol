# Refine Frontend Skill

Use this skill when generating or modifying Refine/React frontend code from MEDOL.

## Responsibilities

- Read models become resources, list/detail pages, or decision views.
- Commands become forms, dialogs, drawers, confirmations, wizards, inline edits, or background actions.
- Value types become TypeScript types and form validation schemas.
- Layout should reflect the business workflow rather than expose raw implementation structure.

## UX Guidance

- Menus should focus on read model or workflow entry points, not every command.
- Commands related to a read model should appear near that read model as resource actions.
- Avoid duplicating command entry points unless the model intentionally defines multiple user journeys.
- Generated UI should be usable as a foundation and remain easy to refine manually.

## Verification

Run available TypeScript, lint, or build checks. If generated dependencies are intentionally skipped, state that clearly.

