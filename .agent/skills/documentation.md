# Documentation Skill

Use this skill when generating or updating documents from MEDOL.

## Document Types

- Product requirements.
- Software design.
- Database/read model design.
- Process documentation.
- Acceptance material.

## Rules

- Documents should be deliverable artifacts and should not mention that AI generated them.
- Chinese output should translate prose while preserving MEDOL identifiers, code names, field names, and technical terms where translation would reduce traceability.
- Each section should retain a stable MEDOL source reference when possible.
- Manual edits should be preserved during incremental regeneration unless the user asks for full regeneration.

## Expected Output

Produce clear Markdown with stable headings, acceptance-oriented language, and explicit links back to MEDOL concepts, contexts, slices, read models, and specifications.

