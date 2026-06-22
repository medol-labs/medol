# Build Read Model

Use this skill for a slice that contains a read model, projection, query resource, list view, or detail view.

## Steps

1. Load read model name, fields, id fields, query fields, examples, and source events.
2. Determine whether it is list-oriented, detail-oriented, or both.
3. Map inbound events to projection handlers.
4. Implement persistence entity, repository, query handler, and read-only resource if the backend target is Axon.
5. Implement resource metadata, list page, show page, and action placement if the frontend target is Refine.
6. Verify query shape and generated UI expectations.

## Rules

- A read model is not an aggregate.
- Read models can duplicate data for query convenience.
- If command placement depends on a read model, prefer deriving it from timeline order and explicit generation plan rather than adding UI-only modeling noise.
- Do not hide missing event-to-field mappings; report them as generation risks.
