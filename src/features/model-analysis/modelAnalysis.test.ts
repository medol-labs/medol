import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseMedol, parseMedolSources } from '../../lib/dslParser';
import { analyzeModel, scopeAnalysis, selectEligibility } from './modelAnalysis';

const organization = `context Governance {
  concept Organization {
    state Registered
    state Active
    state Deactivated
    slice RegisterOrganization
    slice ActivateOrganization
    slice DeactivateOrganization
    slice ReactivateOrganization
  }
  slice RegisterOrganization {
    startsLifecycle
    command RegisterOrganization { organizationId: UUID id }
    event OrganizationRegistered { organizationId: UUID id }
    state Registered
  }
  slice ActivateOrganization {
    reactsTo OrganizationRegistered
    command ActivateOrganization { organizationId: UUID id }
    event OrganizationActivated { organizationId: UUID id }
    state Active
  }
  slice DeactivateOrganization {
    reactsTo OrganizationActivated
    reactsTo OrganizationReactivated
    command DeactivateOrganization { organizationId: UUID id }
    event OrganizationDeactivated { organizationId: UUID id }
    state Deactivated
  }
  slice ReactivateOrganization {
    reactsTo OrganizationDeactivated
    command ReactivateOrganization { organizationId: UUID id }
    event OrganizationReactivated { organizationId: UUID id }
    state Active
  }
  slice Directory {
    readmodel OrganizationDirectory[] {
      organizationId: UUID id
      state: Organization.State
      eligible when { OrganizationDirectory.state == Active }
      eligible for Invite when { OrganizationDirectory.state != Deactivated }
    }
  }
  slice Invite {
    command Invite { organizationId: UUID from OrganizationDirectory.organizationId }
    event Invited { organizationId: UUID }
  }
  slice Assign {
    command Assign { organizationId: UUID from OrganizationDirectory.organizationId }
    event Assigned { organizationId: UUID }
  }
}`;

test('analysis interface and built-in diagnostics remain English', () => {
  for (const filename of ['ModelAnalysisWorkspace.tsx', 'modelAnalysis.ts']) {
    const source = readFileSync(new URL(filename, import.meta.url), 'utf8');
    assert(!/\p{Script=Han}/u.test(source), `${filename} contains hardcoded Chinese interface text`);
  }
  const toolbar = readFileSync(new URL('../../app/PreviewToolbar.tsx', import.meta.url), 'utf8');
  assert(toolbar.includes('<option value="analysis">Business Analysis</option>'));
  assert(toolbar.includes('<option value="layout">Page Structure (Auxiliary)</option>'));
});

test('explains lifecycle entry, inferred guards and returning to the same state', () => {
  const model = parseMedol(organization);
  assert.deepEqual(model.diagnostics, []);
  const analysis = analyzeModel(model);
  assert.equal(analysis.operations.length, 4);
  const start = analysis.operations.find((operation) => operation.source.name === 'RegisterOrganization')!;
  assert.equal(start.evidence, 'declared');
  assert.equal(start.startsLifecycle, true);
  assert.deepEqual(start.fromStates, []);
  const activate = analysis.operations.find((operation) => operation.source.name === 'ActivateOrganization')!;
  assert.deepEqual(activate.fromStates, ['Registered']);
  assert.equal(activate.evidence, 'inferred');
  assert.equal(activate.to, 'Active');
  assert.equal(activate.outcomeEvidence, 'declared');
  assert(activate.source.range?.start.line);
  assert.deepEqual(analysis.operations.find((operation) => operation.source.name === 'DeactivateOrganization')?.fromStates, ['Active']);
  assert.deepEqual(analysis.operations.find((operation) => operation.source.name === 'ReactivateOrganization')?.fromStates, ['Deactivated']);
});

test('business profile takes precedence over default instead of adding both conditions', () => {
  const analysis = analyzeModel(parseMedol(organization));
  assert.equal(analysis.references.find((reference) => reference.command.name === 'Invite')?.selected?.profile, 'Invite');
  assert.equal(analysis.references.find((reference) => reference.command.name === 'Invite')?.selected?.conditions.length, 1);
  const assign = analysis.references.find((reference) => reference.command.name === 'Assign')!;
  assert.equal(assign.evidence, 'declared');
  assert.equal(assign.selected?.profile, undefined);
  assert.equal(assign.selected?.conditions[0].right, 'Active');
});

test('missing triggers remain unknown, never all states or inferred by operation name', () => {
  const analysis = analyzeModel(parseMedol(organization.replace('reactsTo OrganizationRegistered', '')));
  const activate = analysis.operations.find((operation) => operation.source.name === 'ActivateOrganization')!;
  assert.equal(activate.evidence, 'unknown');
  assert.deepEqual(activate.fromStates, []);
  assert(analysis.issues.some((issue) => issue.message.includes('Precondition state is unknown')));
});

test('multiple events do not assign the first event a state or guess failure state by name', () => {
  const model = parseMedol(organization.replace('event OrganizationRegistered { organizationId: UUID id }',
    'event OrganizationRegistered { organizationId: UUID id } event OrganizationRegistrationFailed { organizationId: UUID id }'));
  const analysis = analyzeModel(model);
  assert.equal(analysis.operations.find((operation) => operation.source.name === 'RegisterOrganization')?.outcomeEvidence, 'unknown');
  assert.equal(analysis.operations.find((operation) => operation.source.name === 'ActivateOrganization')?.evidence, 'unknown');
  assert(analysis.issues.some((issue) => issue.message.includes('without a unique event mapping')));
});

test('unqualified duplicate projections remain ambiguous while qualified sources resolve', () => {
  const text = organization + `context Other {
    slice Directory { readmodel OrganizationDirectory[] { organizationId: UUID id } }
  }`;
  let analysis = analyzeModel(parseMedol(text));
  assert.equal(analysis.references[0].evidence, 'unknown');
  assert.equal(analysis.references[0].selected, undefined);
  assert.equal(analysis.references[0].projectionIds.length, 2);
  assert(analysis.issues.some((issue) => issue.message.includes('ambiguous projection source')));
  analysis = analyzeModel(parseMedol(text.replaceAll('from OrganizationDirectory.organizationId', 'from Governance.OrganizationDirectory.organizationId')));
  assert.equal(analysis.references[0].evidence, 'declared');
  assert.equal(analysis.references[0].projectionIds.length, 1);
});

test('reports orphan profiles and does not apply profiles of unrelated business commands', () => {
  const analysis = analyzeModel(parseMedol(organization.replace('eligible for Invite when', 'eligible for MissingCommand when')));
  assert(analysis.issues.some((issue) => issue.message.includes('MissingCommand matches no')));
  assert.equal(analysis.references.find((reference) => reference.command.name === 'Invite')?.selected?.profile, undefined);
});

test('matches command or slice profile keys with current generator normalization', () => {
  const rules = [{ profile: 'Start_Order', operator: 'AND' as const, conditions: [] }, { operator: 'AND' as const, conditions: [] }];
  assert.equal(selectEligibility(rules, { id: 'c', name: 'Submit' }, { id: 's', name: 'StartOrder' }).selected, rules[0]);
});

test('derived lookups are not reported as selectors and no condition is not business approval', () => {
  const model = parseMedol(organization.replace('organizationId: UUID from OrganizationDirectory.organizationId',
    'organizationId: UUID derived from OrganizationDirectory.organizationId by organizationId'));
  const analysis = analyzeModel(model);
  assert(!analysis.references.some((reference) => reference.command.name === 'Invite'));
  const withoutRules = analyzeModel(parseMedol(organization.replace('eligible when { OrganizationDirectory.state == Active }', '')
    .replace('eligible for Invite when { OrganizationDirectory.state != Deactivated }', '')));
  assert(withoutRules.references.every((reference) => reference.selected === undefined));
});

test('unrelated-domain model works without Federation names', () => {
  const model = parseMedol(`context Lending {
    concept Book {
      state Available
      state Borrowed
      slice AddBook
      slice BorrowBook
    }
      slice AddBook {
        startsLifecycle
        command AddBook { bookId: UUID id }
        event BookAdded { bookId: UUID id }
        state Available
      }
      slice BorrowBook {
        reactsTo BookAdded
        command BorrowBook { bookId: UUID id }
        event BookBorrowed { bookId: UUID id }
        state Borrowed
      }
  }`);
  assert.deepEqual(model.diagnostics, []);
  const analysis = analyzeModel(model);
  assert.equal(analysis.owners[0].name, 'Book');
  assert.deepEqual(analysis.operations[1].fromStates, ['Available']);
});

test('existing semantic diagnostics are preserved with source positions', () => {
  const model = parseMedol(organization.replace('startsLifecycle', ''));
  assert(model.diagnostics.length > 0);
  const analysis = analyzeModel(model);
  for (const diagnostic of model.diagnosticDetails) assert(analysis.issues.some((issue) => issue.message === diagnostic.message));
  assert(analysis.issues.some((issue) => issue.source.range));
  const ownerScope = scopeAnalysis(analysis, { ownerId: analysis.owners[0].id });
  assert(ownerScope.issues.some((issue) => issue.message.includes('startsLifecycle')));
});

test('scope includes consumers of own projections and external projections used by commands', () => {
  const model = parseMedol(organization + `context Work {
    slice Allocate { command Allocate { organizationId: UUID from Governance.OrganizationDirectory.organizationId } }
  }`);
  const analysis = analyzeModel(model);
  const work = model.contexts.find((context) => context.name === 'Work')!;
  const scoped = scopeAnalysis(analysis, { contextId: work.id });
  assert.equal(scoped.projections.length, 1);
  assert.equal(scoped.references.length, 1);
  const governance = scopeAnalysis(analysis, { contextId: model.contexts[0].id });
  assert(governance.references.some((reference) => reference.command.name === 'Allocate'));
  const owner = scopeAnalysis(analysis, { ownerId: analysis.owners[0].id });
  assert.equal(owner.operations.length, 4);
  assert.equal(owner.projections.length, 1);
  assert(owner.references.some((reference) => reference.command.name === 'Allocate'));
});

test('context-level projections are analyzed without inventing a slice', () => {
  const model = parseMedol(`context Library {
    readmodel BookCatalog[] { bookId: UUID id available: Boolean eligible when { BookCatalog.available == true } }
    slice Borrow { command Borrow { bookId: UUID from BookCatalog.bookId } }
  }`);
  assert.deepEqual(model.diagnostics, []);
  const analysis = analyzeModel(model);
  assert.equal(analysis.projections.length, 1);
  assert.equal(analysis.references[0].selected?.conditions[0].right, true);
  assert.equal(analysis.projections[0].sliceId, model.contexts[0].id);
});

test('prefix-compatible generator candidates are reported without losing exact modeled reference', () => {
  const analysis = analyzeModel(parseMedol(organization + `context Other {
    slice Directory { readmodel OrganizationDirectoryArchive[] { organizationId: UUID id } }
  }`));
  assert.equal(analysis.references[0].projectionIds.length, 1);
  assert.equal(analysis.references[0].selected?.profile, 'Invite');
  assert(analysis.issues.some((issue) => issue.message.includes('generator name matching')));
  const scoped = scopeAnalysis(analysis, { ownerId: analysis.owners[0].id });
  assert(scoped.issues.some((issue) => issue.message.includes('generator name matching')));
});

test('cross-object triggers do not supply current-object state', () => {
  const analysis = analyzeModel(parseMedol(organization.replace('reactsTo OrganizationRegistered', 'reactsTo ExternalReady')
    + `context External { slice Ready { event ExternalReady { value: String } state Active } }`));
  const activate = analysis.operations.find((operation) => operation.source.name === 'ActivateOrganization')!;
  assert.equal(activate.evidence, 'unknown');
  assert(activate.reason.includes('another business object'));
});

test('multiple matched profiles are reported instead of quietly combining', () => {
  const analysis = analyzeModel(parseMedol(organization.replace('eligible for Invite when', 'eligible for In_vite when')
    .replace('eligible when { OrganizationDirectory.state == Active }', 'eligible for Invite when { OrganizationDirectory.state == Active }')));
  assert.deepEqual(analysis.references[0].matchingProfiles, ['Invite', 'In_vite']);
  assert(analysis.issues.some((issue) => issue.message.includes('matches multiple')));
});

test('imported source ranges retain file identity and cannot be confused with editor line numbers', () => {
  const model = parseMedolSources([
    { sourceName: 'governance.medol', text: organization },
    { sourceName: '<memory>', text: 'context Local {}' }
  ]);
  const analysis = analyzeModel(model);
  assert.equal(analysis.operations[0].source.range?.sourceName, 'governance.medol');
  assert.equal(analysis.projections[0].range?.sourceName, 'governance.medol');
  assert.equal(parseMedol('context Local {}').contexts[0].sourceRange?.sourceName, '<memory>');
});

test('full Federation model has deterministic analysis and retains exact modeled state literals', () => {
  const model = parseMedol(readFileSync(new URL('../../../examples/fl/federation-learning.medol', import.meta.url), 'utf8'));
  const analysis = analyzeModel(model);
  assert(analysis.owners.length > 10);
  assert(analysis.references.length > 10);
  const invite = analysis.references.find((reference) => reference.command.name === 'InviteParticipant' && reference.field === 'federationId');
  assert(invite?.selected);
  const activated = analysis.operations.find((operation) => operation.source.name === 'ActivateFederation');
  assert(activated?.to);
  assert.notEqual(activated.to, activated.to.toUpperCase());
  assert.deepEqual(analyzeModel(model), analysis);
});
