# Axon Command Handler Guidance

- Command handlers validate intent and emit events.
- Events should contain facts accepted by the domain, not raw UI form state unless those facts are truly part of the business record.
- `startsLifecycle` commands usually create a new lifecycle instance and must establish the identity field.
- Business rejections should be explicit and covered by scenario tests.
- Derived event fields should be computed from command input, existing state, read model lookup, or domain services.
- Do not implement cross-instance uniqueness using only one aggregate instance unless the identity boundary actually contains all competing values.
