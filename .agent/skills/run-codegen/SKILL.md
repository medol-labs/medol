# Run Codegen

Use this skill when a task needs deterministic generation from `CodegenModel` or `GenerationPlan`.

## Steps

1. Confirm the source model path.
2. Export or locate `codegen-model.json`.
3. Run the appropriate code-generator target: Axon skeleton/slices/aggregates or Refine skeleton/all/resources/router/pages.
4. Keep Axon and Refine output directories separate.
5. Capture prompts, skipped installs, overwritten files, and generator output.
6. Run verification if requested.

## Rules

- Prefer deterministic generation before manual implementation.
- Do not use an LLM to recreate files owned by templates.
- If generation fails, switch to `fix-generation-error`.
