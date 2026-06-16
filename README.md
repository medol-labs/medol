# MEDOL

MEDOL is a Domain Design Language for describing business domains, bounded contexts, aggregates, event-modeling timelines, read models, rules, UI interactions, and code-generation intent.

The project provides a Langium language implementation, Monaco editor, React Flow visual model, agentic modeling workflow, design-document generation, and adapters for application code generation. Each `slice` is rendered as a timeline column in the order it appears in MEDOL.

## Project Vision

MEDOL treats domain design as a versionable, executable specification rather than a collection of disconnected diagrams and documents. The same model can drive collaborative Event Modeling, acceptance specifications, product and software documentation, UI layout previews, and application code generation.

The project combines two development ideas:

- **Agentic development**: a modeling agent understands MEDOL syntax, the current domain model, the selected modeling element, and project-specific knowledge. It can discuss requirements, identify missing decisions, and propose focused MEDOL patches. Changes remain reviewable in the editor before they are applied.
- **Spec-driven development**: MEDOL is the source of truth for business behavior and implementation intent. Commands, events, business rejections, read models, business concepts, UI interactions, examples, and Given-When-Then specifications are captured before downstream documents or code are generated.

The intended delivery loop is:

```text
domain conversation and uploaded knowledge
  -> agent-assisted MEDOL modeling
  -> semantic validation and visual review
  -> executable specifications and design documents
  -> frontend and backend generation
  -> implementation feedback returned to the model
```

AI is used as a collaborator around the specification, not as an opaque replacement for it. Deterministic parsing, semantic models, validation, previews, and generators keep generated results traceable to reviewed MEDOL source.

## Development Model

MEDOL connects discovery and implementation through a shared semantic model:

```text
MEDOL source
  -> EmModel
  -> Event Canvas / Domain Map / Layout Preview
  -> documentation and acceptance material
  -> CodegenModel
  -> frontend and backend generators
```

This supports an agentic, spec-driven workflow in which:

1. People and agents clarify the domain through conversation and Event Modeling.
2. The agent proposes explicit MEDOL changes instead of silently rewriting the application.
3. The editor previews the patch and keeps the human in control of applying it.
4. Semantic validation checks model structure and relationships.
5. Product requirements, software design, database design, processes, and acceptance material are derived from the reviewed model.
6. Code generators consume a normalized `CodegenModel`, keeping technical generation concerns separate from domain design.
7. New implementation knowledge can be recorded back into MEDOL as rules, examples, mappings, concepts, or hotspots.

The current modeling flow is designed around this structure:

```text
slice 1 { command, event, GWT business rules }
  -> slice 2 { read model }
  -> slice 3 { automation, command, event }
```

## Features

- Custom Langium grammar for domain design and Event Modeling concepts.
- React Flow rendering for slices, lanes, nodes, and relationships.
- Slice columns arranged left to right by timeline/order.
- Lane-based rendering for UI, command, event, GWT, read model, automation, policy, and hotspot elements.
- Agentic conversation with persisted history, project knowledge, MEDOL patch proposals, editor diff preview, and explicit apply.
- Spec-driven generation of PRD, software design, database design, process, and acceptance material.
- Editable Markdown document workspace with live preview and workspace-scoped SQLite persistence.
- MEDOL to `EmModel` JSON export for code generation.
- MEDOL to normalized `CodegenModel` export for frontend and backend generators.
- `config.json` to MEDOL conversion.
- MEDOL to `config.json` conversion.
- Browser UI for editing MEDOL and exporting `EmModel` JSON or `config.json`.

## Project Structure

```text
medol/
  examples/
    federation.medol              Example MEDOL model
  src/
    language/medol.langium        Langium grammar
    lib/configToDsl.ts           config.json -> MEDOL converter
    lib/dslToConfig.ts           MEDOL -> config.json converter
    lib/emModelExport.ts         MEDOL/EmModel JSON export helpers
    lib/dslParser.ts             MEDOL parser and semantic-model adapter
    lib/flow.ts                  Domain model -> React Flow nodes and edges
    App.tsx                      Editor and canvas UI
  langium-config.json            Langium generator config
```

## Install

```bash
npm install
```

## Run The App

```bash
npm run dev
```

Open:

```text
http://localhost:5173/
```

The left panel is the MEDOL editor. The right panel is the React Flow event modeling canvas.

Use `Export EmModel` in the UI to download the current MEDOL as `em-model.json`. Use `Export config` only when an older `config.json` consumer still needs it.

## Agent Provider

The modeling assistant defaults to the local mock provider:

```bash
AGENT_PROVIDER=mock
```

To route structured agent responses through the TanStack AI OpenAI adapter on the server:

```bash
AGENT_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.2
```

To use MiniMax M3 through the domestic Responses API:

```bash
AGENT_PROVIDER=minimax
MINIMAX_API_KEY=...
MINIMAX_MODEL=MiniMax-M3
MINIMAX_BASE_URL=https://api.minimaxi.com/v1
```

The runtime uses TanStack AI adapters for model access. The provider must return one structured response: `answer`, `clarification`, or `medol_patch_proposal`.

Chat messages are cached in browser `localStorage` and mirrored to SQLite through the TanStack Start `/api/agent/history` route. Modeling workspaces are managed through the REST-style `/api/modeling/workspaces` API. Each workspace stores its own MEDOL document, which can contain one or more domains. Both use the same embedded SQLite database and require no separate backend service. The default database path is `data/medol.sqlite`; override it with:

```bash
MEDOL_DB_PATH=./data/medol.sqlite
```

`EVENT_MODELING_DB_PATH` and `AGENT_CHAT_DB_PATH` remain supported for existing installations.

Generated and edited Markdown documents use a separate SQLite database at
`data/medol-documents.sqlite`. Override it independently with:

```bash
MEDOL_DOCUMENT_DB_PATH=./data/medol-documents.sqlite
```

Choose a document generation action from the toolbar to save and open the result in the
Documents preview. The document workspace supports Markdown editing, live rendered preview,
explicit save, Markdown/Word download, deletion, and reopening documents associated with the active modeling
workspace. Generated sections retain stable MEDOL source references. The Explorer shows a
document-location action for referenced domains, contexts, aggregates, concepts, and slices;
document sections can navigate back to the corresponding MEDOL element. A source hash also marks
whether a document still represents the current MEDOL content or needs regeneration. The Markdown
editor and rendered preview scroll together in both directions. Regenerating the same document kind
and language updates the existing document section by section: unchanged generated sections are
refreshed, new and removed MEDOL sections are reconciled, and manually edited sections are preserved
for review.

Word export uses Pandoc on the server/runtime that runs the TanStack Start API. Local development
therefore needs `pandoc` on the PATH; a deployed server or Docker image should install it in the
runtime image. If Pandoc is unavailable, the export API returns a clear error while Markdown export
continues to work.

The editor depends on the `ModelingWorkspaceClient` interface rather than TanStack Start directly. To move workspace management to another backend later, implement the same API contract and set:

```bash
VITE_WORKSPACE_API_BASE_URL=https://modeling-api.example.com
```

The workspace API contract is:

```text
GET    /workspaces
POST   /workspaces
GET    /workspaces/:workspaceId
PUT    /workspaces/:workspaceId
DELETE /workspaces/:workspaceId
```

Workspace is the persistence boundary. A workspace owns one MEDOL document and its assistant conversation; the MEDOL document may declare multiple `domain` blocks.

## Build

```bash
npm run build
```

## Generate Langium Artifacts

Run this after changing `src/language/medol.langium`:

```bash
npm run langium:generate
```

Generated files are written to:

```text
src/language/generated/
syntaxes/medol.tmLanguage.json
```

## Convert config.json To MEDOL

```bash
npm run config:to-medol -- ../b-config.json
```

This prints MEDOL to stdout.

## Convert MEDOL To config.json

```bash
npm run medol:to-config -- examples/federation.medol
```

This prints `config.json` content to stdout.

To save it:

```bash
npm run medol:to-config -- examples/federation.medol > config.json
```

## Export MEDOL As EmModel JSON

```bash
npm run medol:to-model -- examples/federation.medol
```

This prints the parsed `EmModel` JSON used by the renderer and newer generators.

To save it:

```bash
npm run medol:to-model -- examples/federation.medol > em-model.json
```

## Codegen Model

The toolkit now uses an internal `CodegenModel` between `EmModel` and the Martin-compatible `config.json` adapter:

```text
.medol -> EmModel -> CodegenModel -> config.json
```

`EmModel` remains the source-of-truth semantic model for the design language. `CodegenModel` is the normalized code generation view of that model. It keeps codegen-oriented information in a stable shape before it is projected into the current `config.json` format consumed by the Axon/refine generator.

`CodegenModel` covers:

- code generation metadata: `rootPackage` and optional top-level `domain`; the config adapter derives `codeGen.application` from `domain`
- contexts: id, name, title, notes, risks, decisions, metrics, and aggregate references
- aggregates: id, name, title, owning context, states, and aggregate fields placeholder
- slices: id, index, name, title, `chapter`, context, aggregate reference, hotspots, actors, and optional state change
- elements: commands, events, readmodels, screens, processors, and specifications
- element codegen data: id, name, title, type, model context, slice, aggregate, fields, dependencies, `startsLifecycle`, and `listElement`
- fields: name, type, cardinality, optional/id/generated/technical/query flags, field-level `example`, and optional source metadata
- field source metadata: direct mappings and derived mappings with source paths and optional rule text
- dependencies: inbound/outbound element links with generated ids, titles, and element types
- specifications: GWT-style given/when/then data, inline business rejections, and field examples from specification examples

The existing `dslToConfig` API remains as a compatibility alias. Internally, conversion calls:

```text
modelToCodegenModel(model) -> codegenModelToConfig(codegenModel)
```

To inspect the codegen view directly:

```bash
npm run medol:to-codegen-model -- examples/fl/federation-learning.medol
```

## Generate PRD Markdown

```bash
npm run prd:generate -- examples/federation.medol
```

To save it:

```bash
npm run prd:generate -- examples/federation.medol > prd.md
```

To inspect the MEDOL-to-PRD source map:

```bash
npm run prd:generate -- examples/federation.medol --trace
```

The PRD generator emits stable Markdown section markers and a trace JSON shape so generated sections can be mapped back to source MEDOL nodes.

## Generate Design Documents

The documentation generator builds a deterministic documentation model from `EmModel`, then renders:

- PRD and functional requirements
- software architecture and application flow design
- read-model-oriented database design, including fields, keys, query candidates, source events, and mappings
- end-to-end business process documentation with Mermaid overviews

Generate one document:

```bash
npm run docs:generate -- examples/fl/federation-learning.medol --kind=database-design
```

Generate a Simplified Chinese document:

```bash
npm run docs:generate -- examples/fl/federation-learning.medol --kind=prd --language=zh-CN
```

Generate all document types:

```bash
npm run docs:generate -- examples/fl/federation-learning.medol --kind=all
```

Use `--json` to inspect the normalized documentation bundle together with the rendered Markdown. In the web toolkit, choose a document action and confirm it to save and open the result in Documents preview. For Simplified Chinese output, English domain vocabulary and business narratives are translated as a controlled terminology map before the deterministic document templates run. Identifiers remain traceable to their MEDOL source, and missing information is presented as notes or open questions rather than invented facts.

The server endpoint is:

```text
POST /api/modeling/documents
```

It accepts `medol`, `kind`, optional `language` (`en` or `zh-CN`), and optional `enhanceWithAi`. The legacy request field `dsl` remains accepted for compatibility. Supported kinds are `prd`, `software-design`, `database-design`, and `process`. PRD output is organized as routine product and delivery material: feature/CRUD inventory, UI entry points, input constraints, business outcomes, acceptance matrix, delivery checklist, and open questions.

## MEDOL Example

```medol
domain FederationLearningPlatform {
context FederationLearning {
  aggregate Federation {
    state Draft
    state Active

    slice CreateFederation {
      startsLifecycle
      actor Admin
      ui CreateFederationScreen

      command CreateFederation {
        federationId: UUID id generated technical
        federationName: String
        description: String
        governancePolicyId: UUID
        minimumParticipantCount: Int
      }

      event FederationCreated {
        federationId: UUID id technical
        federationName: String
        description: String
        governancePolicyId: UUID
        minimumParticipantCount: Int
      }

      specification "Create federation with valid governance" {
        when CreateFederation
        then FederationCreated
      }
    }

    slice FederationOverview {
      reactsTo FederationCreated

      readmodel FederationList[] {
        federationId: UUID id
        federationName: String
        status: String
        subscribe FederationCreated
      }
    }

    slice AutoActivateFederation {
      reactsTo FederationCreated

      automation ActivateNewFederation {
        condition status == "Draft"
        emits ActivateFederation
      }

      command ActivateFederation {
        federationId: UUID id
        activateReason: String?
      }

      event FederationActivated {
        federationId: UUID id
        activateReason: String?
        status: String
      }
    }
  }
}
}
```

## MEDOL Concepts

- `domain`: A top-level domain that groups one or more modeling contexts.
- `context`: A bounded modeling context inside a domain. Legacy files may still start with `context`.
- `type`: A reusable context-level value type. It carries field-level `format`, `length`, `range`, `matches`, or `oneOf` constraints.
- `aggregate`: A domain aggregate containing states and slices.
- `concept`: A named business concept shared by context-level slices. It declares the concept's states and groups related behavior through slice references without prescribing aggregate or consistency-boundary implementation.
- `slice`: A timeline column in the event modeling board.
- `state`: Inside an aggregate or concept, declares an allowed lifecycle state; inside a slice, declares that slice's resulting state.
- `tags`: Selection values used to identify the concept instance involved in a slice. Tag expressions may normalize or derive values.
- `startsLifecycle`: Marks the entry slice that begins a business concept lifecycle without choosing Aggregate or DCB implementation.
- `ui`: A screen or view reference.
- `command`: A user or automation intent.
- `event`: A domain fact produced by a command.
- `specification`: GWT-style business rule node.
- `rule """..."""`: Optional multi-line domain meaning for a specification.
- `expression`: Optional machine-readable business invariants for a specification: `unique` and `assert`.
- `scenario`: A concrete Given-When-Then example that verifies its containing specification.
- `then reject "description"`: An expected business rejection for a specification. Rejections are inline outcomes, not separately declared domain elements.
- `readmodel`: A read model updated by events. Use `readmodel Name[]` to export it as a collection read model with `listElement: true`. The legacy `projection` keyword is accepted only for migration.
- `automation`: A process that reacts to events and emits commands.
- `reactsTo`: Declares that a slice starts from a prior event.
- `subscribe`: Declares that a read model subscribes to an event.
- `emits`: Declares that an automation emits a command.

## Field Syntax

```text
import "./shared-types.medol"

type Email = String {
  format email
}

type OrganizationName = String {
  length 2..100
  matches "^[A-Za-z ]+$"
}

type OrganizationType = String {
  oneOf "Company", "University"
}

enum OrganizationStatus {
  Active
  Suspended
}

value Address {
  street: String
  city: String
  postalCode: String
}

fieldName: Type
fieldName: Type?
fieldName: Type[]
fieldName: Type id generated technical query
fieldName: Type { example "A readable sample value." }
copiedName: Type from UpstreamElement.sourceName
computedName: Type derived
computedName: Type derived from Aggregate.policy
computedName: Type derived { from Aggregate.state, Command.input rule "Explain the domain rule." example "42" }
```

Fields without `?` are required. `type` defines constrained scalar values, `enum` defines a closed business vocabulary, and `value` defines a structured value object without identity. Reusable value types carry intrinsic field validity; specifications carry business invariants that depend on domain meaning, state, or other instances.

Imports are resolved relative to the importing file by the MEDOL CLI. Files may contribute fragments to the same domain and context; the compiler merges them before semantic validation. Generated IDs use fully qualified semantic paths, so moving a declaration between imported files or changing file order does not change its ID.

## Semantic Validation

MEDOL validates the parsed model before preview, documentation, or code generation. Diagnostics cover:

- duplicate domains, contexts, types, aggregates, concepts, slices, states, tags, elements, fields, scenarios, and assignments
- unknown field types, unknown value-type base types, cyclic scalar or structured value definitions, invalid enum examples, and incompatible `oneOf` literals
- invalid constraint bounds, invalid regular expressions, and constraints applied to incompatible base types
- invalid Concept/Aggregate lifecycle starts and resulting states that were not declared
- missing or ambiguous Concept Slice references and Slices assigned to multiple Concepts
- unknown Tag fields and Tag expressions that reference missing fields
- unresolved command/event relationships such as `reactsTo`, `subscribe`, policy, automation, and GWT references
- invalid `unique` targets, incompatible `assert` operands, unknown example fields, and incompatible example literals

String, numeric, Boolean, and `null` literals are type checked. `null` is accepted only for fields declared with `?`.
The `medol:to-codegen-model` and `medol:to-config` commands stop with a validation error instead of exporting an invalid generation model.

Supported field attributes:

- `id`
- `generated`
- `technical`
- `query`

Field mappings:

- `from`: Maps a field directly from one or more upstream element or field paths.
- `derived`: Marks a field produced from a domain rule or aggregate state rather than copied input.
- `{ example "..." }`: Stores a field-level example value apart from specification examples.
- `derived { from ... rule "..." example "..." }`: Keeps derivation metadata with the field. MEDOL-to-config writes sources and rules as field `mappings`.

Cardinality:

- no suffix: single value
- `?`: optional value
- `[]`: list value
