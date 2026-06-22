# Fix Generation Error

Use this skill when generated Axon or Refine code fails to compile, typecheck, or run.

## Steps

1. Capture the failing command and key error lines.
2. Classify the issue: MEDOL model, CodegenModel, GenerationPlan, generator/template, or environment.
3. Prefer fixing the earliest responsible layer.
4. Add or update a minimal reproduction using example models when possible.
5. Re-run generation and verification.

## Rules

- Do not manually patch generated output if the generator will recreate the same bug.
- If a model lacks required information, propose a MEDOL patch.
- If the generator derived the wrong ownership, query shape, or type mapping, fix generator logic.
