# Version And Release Traceability

| Identity | Example | Meaning |
| --- | --- | --- |
| MEDOL tool version | `0.1.0` | Editor/exporter package version |
| Model checkpoint | `#42`, immutable UUID | Saved source snapshot within a workspace |
| Model release | `v1.0.0` | Named immutable modeling baseline |
| Document revision | `3` | Revision of one document, including manual edits |
| Generated package version | `1.0.0` | Maven/npm baseline for a stable model release |
| Delivery version | `v1.0.0.2` | Implementation revision 2 of model release `v1.0.0` |

## Model Baselines

Draft saves do not allocate releases. Create a version with a release channel and
a three-part label in Version History. Labels normalize to `vX.Y.Z`; a label
cannot be allocated twice in a workspace, including across channels. Existing
historical labels remain readable. New automated stable deliveries require the
three-part format.

CodegenModel JSON includes `metadata.schemaVersion`, `metadata.medolVersion`, and
`metadata.source.sha256`. Workspace exports also include the selected checkpoint
and release identity. SHA-256 covers the exact UTF-8 entry source, including
whitespace. Generation records separately hash the complete CodegenModel,
translations, and configuration, covering imported/built-in model content
represented in that JSON.

Changed drafts do not inherit a previous release. Pin automated exports:

```text
GET /api/modeling/codegen-model?workspaceId=WORKSPACE&versionId=VERSION
```

The generator downloads the model and its matching source together:

```bash
update --workspace-id WORKSPACE --version-id VERSION --locale zh-CN
```

File-based workflows can explicitly identify the exported baseline:

```bash
npm run medol:to-codegen-model -- path/to/system.medol --release v1.0.0
```

Keep the exact entry source beside `.medol/codegen-model.json` as
`.medol/source.medol`. Re-export both files when source changes. File-based labels
must be protected by the project's Git/release process; they do not reserve a
label in the MEDOL workspace database.

## Generation And Delivery

Generated targets record model, generator, configuration, and input hashes under
`.medol/generation/` in each output project. Generation records identify what
produced the code; Git identifies the implementation subsequently packaged,
including hand-written adapters.

For a stable baseline, use a four-part image version with matching first three
parts. Increment the last part for delivered implementation, generator,
dependency, or packaging changes retaining that baseline. A new model baseline
starts at implementation revision zero. API, event, and business contract
changes must be reflected in the model and a new baseline.

```bash
node scripts/build-images.mjs --version v1.0.0.0
node scripts/build-images.mjs --version v1.0.0.1
```

Four-part versions are a project delivery convention, not SemVer. npm versions
remain three-part. Draft/legacy projects retain development defaults and cannot
claim a stable four-part release without matching model provenance.

Image labels and build/release manifests retain source and generation identity.
Keep manifests with exported image archives and preserve registry digests for
deployment. A tag alone does not identify immutable image content.

## Documents

Document revisions advance when content or source association changes, including
manual edits and regeneration under the same model. Unchanged saves do not
create duplicate revisions. Revisions retain their source references; editing
text does not silently rebind it to the latest model. Markdown and Word exports
include the recorded revision history.

A document's own revision differs from the software version it describes.
Installation and usage documents declare their applicable model baseline and,
when validated against a specific delivery, its delivery version. A text
correction may advance document revision without rebuilding images.
