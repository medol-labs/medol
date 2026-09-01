# medol — AGENTS.md

MEDOL is a Domain Design Language (Langium-based) for bounded contexts, event-modeling timelines, read models, rules, UI interactions, and code-generation intent. This package is the editor + exporters: Monaco editor on the left, React Flow canvas on the right, plus CLI converters to `EmModel` and `CodegenModel` JSON.

Default branch: `main`.

## Setup

- Node 22+; uses `tsx` for running TS scripts, `vite` for dev/build, `better-sqlite3` for embedded storage.
- Install: `npm install`
- Dev server (editor + canvas on http://localhost:5173/): `npm run dev`
- Production build: `npm run build`
- Preview the built server: `npm run preview`

## Tests

Tests use Node's built-in test runner (`node --import tsx --test ...`). Run a single suite:

```bash
npm run test:semantic         # src/lib/semanticValidator.test.ts
npm run test:types            # src/lib/typeSystem.test.ts
npm run test:specification    # src/lib/specificationCoverage.test.ts
npm run test:agent            # src/features/agent-chat/dslOperationTools.test.ts
npm run test:search           # src/features/model-search/modelSearch.test.ts
npm run test:documentation    # src/features/documentation/documentationTranslation.test.ts
npm run test:workspace        # src/server/modelingWorkspaceRepository.test.ts
npm run test:documents        # src/server/modelingDocumentRepository.test.ts
```

There is no aggregate `npm test` — pick the suite that covers the changed area and run all of them before opening a PR.

## CLI converters (use these from the project root)

- `npm run medol:to-config -- examples/<file>.medol` — emit `config.json` (legacy Martin format).
- `npm run medol:to-model -- examples/<file>.medol` — emit `em-model.json` (semantic model for renderer/generators).
- `npm run medol:to-codegen-model -- examples/<file>.medol` — emit the **CodegenModel** that `es-code-generator` consumes. This is the canonical input for the generation pipeline.
- `npm run prd:generate -- examples/<file>.medol [--trace]` — emit PRD Markdown + optional source-map trace.
- `npm run docs:generate -- examples/<file>.medol --kind=<prd|software-design|database-design|process|all> [--language=zh-CN] [--json]` — design docs.
- `npm run config:to-medol -- <config.json>` — reverse direction (legacy import).

## Langium grammar

- Grammar file: `src/language/medol.langium`
- After any change to the grammar, regenerate: `npm run langium:generate`
- Generated artifacts land in `src/language/generated/` and `syntaxes/medol.tmLanguage.json`. Do not edit generated files by hand.

## Environment

- `AGENT_PROVIDER` — `mock` (default) / `openai` / `minimax`. The modeling agent uses TanStack AI adapters.
- `OPENAI_API_KEY`, `OPENAI_MODEL` — for `AGENT_PROVIDER=openai` (default model `gpt-5.2`).
- `MINIMAX_API_KEY`, `MINIMAX_MODEL`, `MINIMAX_BASE_URL` — for `AGENT_PROVIDER=minimax` (default `MiniMax-M3`).
- `MEDOL_DB_PATH` (default `data/medol.sqlite`) — modeling workspace + agent chat SQLite.
- `MEDOL_DOCUMENT_DB_PATH` (default `data/medol-documents.sqlite`) — generated/edited Markdown documents.
- `VITE_WORKSPACE_API_BASE_URL` — point the editor at a non-TanStack-Start workspace backend. API contract: `GET/POST /workspaces`, `GET/PUT/DELETE /workspaces/:id`, `GET /codegen-model?workspaceId=<id>`.
- Word export requires `pandoc` on the PATH at runtime; Markdown export always works.

## REST endpoints (TanStack Start)

- `GET /api/modeling/workspaces`, `POST /api/modeling/workspaces`, `GET/PUT/DELETE /api/modeling/workspaces/:id`
- `GET /api/modeling/codegen-model?workspaceId=<id>&locale=<locale>` — the JSON that drives `es-code-generator`. Omit `workspaceId` to export the most recently updated workspace.
- `POST /api/modeling/documents` — body `{ medol, kind, language?, enhanceWithAi? }`. Kinds: `prd`, `software-design`, `database-design`, `process`.
- `GET /api/agent/history` — agent chat history mirror.

## Project layout

- `src/language/` — Langium grammar + generated AST/syntax files.
- `src/lib/` — DSL parsers, semantic validator, type system, EmModel/CodegenModel exporters, generators (PRD, documentation).
- `src/features/` — UI features: `agent-chat/`, `model-search/`, `documentation/`, etc.
- `src/server/` — TanStack Start API routes and SQLite repositories.
- `src/components/`, `src/routes/` — React UI (TanStack Router/Start).
- `examples/` — sample `.medol` files; `examples/federation.medol` and `examples/fl/federation-learning.medol` are the canonical cases.
- `data/` — SQLite databases (gitignored).

## Code style

- TypeScript strict; `tsconfig.json` has `strict: true`.
- Tailwind v4 + shadcn/ui for components; Radix primitives underneath.
- Use `tsx` for one-off scripts; never `ts-node`.
- React 19, TanStack Router/Start, React Flow v12.

## Active task list

The working backlog is in `TODO.md` (medol-only) and `outputs/事件驱动的医学联邦学习平台软著材料/` (downstream material). New features typically start in the TODO list before being implemented.

## Federation Learning model rules

- `examples/fl/federation-learning.medol` is the source of truth for the generated Federation Learning platform.
- When generated backend/frontend behavior is wrong because the domain behavior is wrong, fix this MEDOL file first instead of patching generated code.
- After changing the model, regenerate the codegen model from the `medol/` root:
  ```bash
  npm run medol:to-codegen-model -- examples/fl/federation-learning.medol > examples/fl/codegen-model.json
  ```
- User commands may contain only user-provided identifiers and inputs, but emitted events should contain full snapshots needed by downstream consumers and replay.
- If an event field is derived from another concept state and generation cannot express it, fix the model/generator. Do not accept generated random UUIDs or empty strings as meaningful business data.
- Use explicit MEDOL field keywords for file flow:
  - `uploadFile` means the generated frontend uploads binary content to the support file-upload endpoint and sends the returned reference.
  - `file` means the command carries an existing file reference string.
- Keep `fl/` out of scope. It is an older generated federation-learning project and is currently not maintained.

## Built-in IAM and auth generation rules

- Keep the built-in `IdentityAccessManagement` MEDOL model focused on account, role, permission, and assignment domain behavior.
- Do not model fixed auth infrastructure as ordinary slices unless the user explicitly asks for a domain workflow. Local login, admin setup, Supabase auth bridging, and Portal SSO exchange are generated infrastructure around the IAM model.
- `RegisterUserAccount.userSource` is an optional technical field. Generated forms should not ask operators to fill it. Fixed auth flows set it:
  - local admin setup: `LOCAL`
  - Supabase admin setup: `SUPABASE`
  - Portal SSO: request `systemSource`, falling back to `MEDOL_SECURITY_PORTAL_SSO_USER_SOURCE` / `PORTAL_SSO`
- Portal SSO uses the fixed frontend route `/sso/portal?token=<portal-jwt>&redirect=/target-page&systemSource=<source>` and backend endpoint `POST /api/auth/exchange-portal-jwt`.
- On Portal SSO auto-registration, create the account through the generated `RegisterUserAccount` command with `passwordHash=null` and the resolved `userSource`. Existing users keep their original source.
- Authorization must be driven by role and permission assignments, not by `userSource`. A newly auto-registered portal user should receive a system JWT only for session continuity and should have no protected access until roles are assigned.
