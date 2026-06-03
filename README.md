# Event Modeling Toolkit

A Langium-based event modeling DSL tool with a React Flow renderer.

The toolkit lets you describe an event modeling board as text, then renders it as a slice-oriented flow. Each `slice` becomes one vertical column, and slices are arranged from left to right in the order they appear in the DSL.

The current modeling flow is designed around this structure:

```text
slice 1 { command, event, GWT business rules }
  -> slice 2 { projection }
  -> slice 3 { automation, command, event }
```

## Features

- Custom Langium grammar for event modeling concepts.
- React Flow rendering for slices, lanes, nodes, and relationships.
- Slice columns arranged left to right by timeline/order.
- Lane-based rendering for UI, command, event, GWT, projection, automation, policy, and hotspot elements.
- DSL to `EmModel` JSON export for code generation.
- `config.json` to DSL conversion.
- DSL to `config.json` conversion.
- Browser UI for editing DSL and exporting `EmModel` JSON or `config.json`.

## Project Structure

```text
event-modeling-toolkit/
  examples/
    federation.em              Example DSL model
  src/
    language/em.langium        Langium grammar
    lib/configToDsl.ts         config.json -> DSL converter
    lib/dslToConfig.ts         DSL -> config.json converter
    lib/emModelExport.ts       DSL/EmModel JSON export helpers
    lib/dslParser.ts           Lightweight DSL model parser for the UI
    lib/flow.ts                Event model -> React Flow nodes and edges
    App.tsx                    Editor and canvas UI
  langium-config.json          Langium generator config
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

The left panel is the DSL editor. The right panel is the React Flow event modeling canvas.

Use `Export EmModel` in the UI to download the current DSL as `em-model.json`. Use `Export config` only when an older `config.json` consumer still needs it.

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

The runtime uses TanStack AI adapters for model access. The provider must return one structured response: `answer`, `clarification`, or `dsl_patch_proposal`.

## Build

```bash
npm run build
```

## Generate Langium Artifacts

Run this after changing `src/language/em.langium`:

```bash
npm run langium:generate
```

Generated files are written to:

```text
src/language/generated/
syntaxes/event-modeling.tmLanguage.json
```

## Convert config.json To DSL

```bash
npm run config:to-dsl -- ../b-config.json
```

This prints DSL to stdout.

## Convert DSL To config.json

```bash
npm run dsl:to-config -- examples/federation.em
```

This prints `config.json` content to stdout.

To save it:

```bash
npm run dsl:to-config -- examples/federation.em > config.json
```

## Export DSL As EmModel JSON

```bash
npm run dsl:to-model -- examples/federation.em
```

This prints the parsed `EmModel` JSON used by the renderer and newer generators.

To save it:

```bash
npm run dsl:to-model -- examples/federation.em > em-model.json
```

## Codegen Model

The toolkit now uses an internal `CodegenModel` between `EmModel` and the Martin-compatible `config.json` adapter:

```text
.em DSL -> EmModel -> CodegenModel -> config.json
```

`EmModel` remains the source-of-truth semantic model for the design language. `CodegenModel` is the normalized code generation view of that model. It keeps codegen-oriented information in a stable shape before it is projected into the current `config.json` format consumed by the Axon/refine generator.

`CodegenModel` covers:

- code generation metadata: `rootPackage` and optional top-level `domain`; the config adapter derives `codeGen.application` from `domain`
- contexts: id, name, title, notes, risks, decisions, metrics, and aggregate references
- aggregates: id, name, title, owning context, states, and aggregate fields placeholder
- slices: id, index, name, title, `chapter`, context, aggregate reference, hotspots, actors, and optional state change
- elements: commands, events, readmodels, screens, processors, and specifications
- element codegen data: id, name, title, type, model context, slice, aggregate, fields, dependencies, `createsAggregate`, and `listElement`
- fields: name, type, cardinality, optional/id/generated/technical/query flags, field-level `example`, and optional source metadata
- field source metadata: direct mappings and derived mappings with source paths and optional rule text
- dependencies: inbound/outbound element links with generated ids, titles, and element types
- specifications: GWT-style given/when/then data plus field examples from specification examples

The existing `dslToConfig` API is preserved. Internally, it now calls:

```text
modelToCodegenModel(model) -> codegenModelToConfig(codegenModel)
```

To inspect the codegen view directly:

```bash
npm run dsl:to-codegen-model -- examples/fl/federation-learning.em
```

## Generate PRD Markdown

```bash
npm run prd:generate -- examples/federation.em
```

To save it:

```bash
npm run prd:generate -- examples/federation.em > prd.md
```

To inspect the DSL-to-PRD source map:

```bash
npm run prd:generate -- examples/federation.em --trace
```

The PRD generator emits stable Markdown section markers and a trace JSON shape so generated sections can be mapped back to source DSL nodes.

## DSL Example

```eventmodeling
domain FederationLearningPlatform {
context FederationLearning {
  aggregate Federation {
    state Draft
    state Active

    slice CreateFederation {
      createsAggregate
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

      projection FederationList[] {
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

## DSL Concepts

- `domain`: A top-level domain that groups one or more modeling contexts.
- `context`: A bounded modeling context inside a domain. Legacy files may still start with `context`.
- `aggregate`: A domain aggregate containing states and slices.
- `slice`: A timeline column in the event modeling board.
- `createsAggregate`: Marks a slice whose command creates a new aggregate instance.
- `ui`: A screen or view reference.
- `command`: A user or automation intent.
- `event`: A domain fact produced by a command.
- `specification`: GWT-style business rule node.
- `projection`: A read model updated by events. Use `projection Name[]` to export it as a list readmodel with `listElement: true`.
- `automation`: A process that reacts to events and emits commands.
- `reactsTo`: Declares that a slice starts from a prior event.
- `subscribe`: Declares that a projection subscribes to an event.
- `emits`: Declares that an automation emits a command.

## Field Syntax

```text
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

Supported field attributes:

- `id`
- `generated`
- `technical`
- `query`

Field mappings:

- `from`: Maps a field directly from one or more upstream element or field paths.
- `derived`: Marks a field produced from a domain rule or aggregate state rather than copied input.
- `{ example "..." }`: Stores a field-level example value apart from specification examples.
- `derived { from ... rule "..." example "..." }`: Keeps derivation metadata with the field. DSL-to-config writes sources and rules as field `mappings`.

Cardinality:

- no suffix: single value
- `?`: optional value
- `[]`: list value
