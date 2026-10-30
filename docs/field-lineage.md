# Field Sources And Generation Checks

Open **Business Analysis > Field Sources** to select a field and trace its
upstream sources or downstream consumers. Context, object, slice, and text
filters restrict the field list; a selected field's trail still crosses those
boundaries. Source and canvas actions locate the associated declaration. Imported
sources retain their file identity and are not mistaken for current-editor lines.
Command result fields are listed as `Command.result.field` with identities
separate from command inputs, even when their names are identical. A result is
never classified as user input merely because it belongs to a command.

**Generation Checks** lists field-source diagnostics with the same filters.
These checks complement parser and semantic diagnostics in **Issues & Review**.

## Evidence

- `input`: an unmapped, non-technical command boundary input without an incoming
  automation. `reactsTo` history alone does not supply command input. This does
  not prove a form or caller supplies it.
- `generated`: explicitly marked `generated`; generation code remains unverified.
- `port`: explicitly marked `portOutput`; the adapter remains unverified.
- `mapping`: an explicit `from` reference.
- `derived`: a declared derivation, optionally with structured dependencies.
  A prose rule alone is not an executable dependency.
- `inferred`: exact same-name, same-type, same-cardinality field candidates along modeled command,
  subscription, synchronization, or automation relationships. No fuzzy matching,
  semantic name guessing, or first-candidate selection occurs. Candidates are not
  proof of an assignment and do not change generation behavior.
- `unknown`: no source is established. A technical attribute, example value, or
  similar field name elsewhere does not supply a value.

Exact references support local and context/domain-qualified element names,
nested object fields, synchronization source-local names, and declared fan-out
aliases. Nested paths are shown on links anchored to the containing field.
Fan-out aliases have lexical precedence over same-named elements. A missing
member of an alias cannot silently fall back to a field on an unrelated element.
Concept/aggregate references show possible event history, not proof that the
current state contains a value. The analysis does not invent a state merge rule,
ordering guarantee, lookup implementation, or external adapter response.

## Generation Gate

CodegenModel export rejects unresolved or ambiguous explicit field references.
The check lives in the shared exporter, so editor, HTTP, CLI and direct EmModel
exports use the same gate. Invalid sources are never replaced with random IDs,
empty strings, or guessed fields by this feature.

Unknown sources, multiple relationship-based candidates, prose-only derivations, state
history, port outputs without a port slice, and dependency cycles are review
warnings, not blockers. A cycle may describe historical feedback; it does not
by itself prove invalid business behavior. Warnings do not certify completeness.
For example, a candidate's own upstream source may still be unknown; follow the
full trail to inspect it.

Run a pre-generation check without generating application code:

```bash
npm run medol:check -- path/to/system.medol
npm run medol:check -- path/to/system.medol --json
```

The JSON report includes fields, evidence links, source locations, and stable
diagnostic codes. Exit status is nonzero for parser/semantic errors or blocking
field references. Warnings keep exit status zero. Ordinary CLI CodegenModel
export writes a review-warning summary to stderr, keeping JSON stdout intact.
HTTP export returns status 400 for blocking field-source diagnostics, with
human-readable `diagnostics` and structured `diagnosticDetails` retaining the
code, field identity and source location.

These checks do not execute commands, ports, business rules or generated code.
There is no new MEDOL syntax and no application-specific generation policy.
