# Build Refine Resource

Use this skill for frontend generation or modification from MEDOL read models and commands.

## Steps

1. Load read models and their timeline-near commands.
2. Determine resource route, menu label, list fields, show fields, and actions.
3. Map lifecycle-starting commands to create pages.
4. Map item commands to row or detail actions.
5. Map confirmation commands to compact confirm interactions.
6. Map command value types to form schema.
7. Run TypeScript/build verification when available.

## Rules

- Menus should not list commands directly.
- Prefer resource-oriented UI based on read models.
- Commands belong near the read model that lets the user decide to run them.
- If no read model supports a command, report a modeling/design gap instead of inventing a hidden page.
