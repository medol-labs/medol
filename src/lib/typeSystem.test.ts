import assert from 'node:assert/strict';
import test from 'node:test';
import { modelToCodegenModel } from './codegenModel';
import { configToDsl } from './configToDsl';
import { parseMedol } from './dslParser';
import { parseMedolFile, type MedolProjectFileSystem } from './medolProject';

test('parses enums and structured value objects', () => {
  const model = parseMedol(`
    context Orders {
      enum OrderStatus {
        Draft
        Submitted
      }
      value Address {
        street: String
        city: String
      }
      slice SubmitOrder {
        command SubmitOrder {
          status: OrderStatus
          address: Address
        }
      }
    }
  `);

  assert.deepEqual(model.diagnostics, []);
  assert.deepEqual(
    model.contexts[0].valueTypes.map((type) => ({
      name: type.name,
      kind: type.kind,
      values: type.values,
      fields: type.fields.map((field) => field.name)
    })),
    [
      { name: 'OrderStatus', kind: 'enum', values: ['Draft', 'Submitted'], fields: [] },
      { name: 'Address', kind: 'object', values: [], fields: ['street', 'city'] }
    ]
  );
});

test('parses optional list fields and preserves codegen cardinality', () => {
  const model = parseMedol(`
    context Features {
      value FeatureDefinition {
        shape: Int[]?
      }
      slice DefineFeature {
        command DefineFeature {
          shape: Int[]?
        }
      }
    }
  `);

  assert.deepEqual(model.diagnostics, []);
  assert.equal(model.contexts[0].valueTypes[0].fields[0].cardinality, 'OptionalList');

  const codegen = modelToCodegenModel(model);
  assert.equal(codegen.slices[0].commands[0].fields[0].cardinality, 'Multiple');
  assert.equal(codegen.slices[0].commands[0].fields[0].optional, true);

  const roundTripDsl = configToDsl({
    context: 'Features',
    slices: [{
      title: 'DefineFeature',
      commands: [{
        title: 'DefineFeature',
        fields: [{
          name: 'shape',
          type: 'Int',
          cardinality: 'Multiple',
          optional: true
        }]
      }]
    }]
  });
  assert.match(roundTripDsl, /shape: Int\[\]\?/);
});

test('parses display field attribute and preserves it for code generation', () => {
  const model = parseMedol(`
    context Catalogs {
      slice DatasetCatalog {
        readmodel DatasetCapability[] {
          datasetId: UUID id technical
          organizationName: String
          datasetName: String display
        }
      }
    }
  `);

  assert.deepEqual(model.diagnostics, []);
  const field = model.contexts[0].slices[0].elements[0].fields.find((item) => item.name === 'datasetName');
  assert(field);
  assert(field.attributes.includes('display'));

  const codegen = modelToCodegenModel(model);
  const codegenField = codegen.slices[0].readmodels[0].fields.find((item) => item.name === 'datasetName');
  assert.equal(codegenField?.display, true);

  const roundTripDsl = configToDsl({
    context: 'Catalogs',
    slices: [{
      title: 'DatasetCatalog',
      readmodels: [{
        title: 'DatasetCapability',
        fields: [{
          name: 'datasetName',
          type: 'String',
          cardinality: 'Single',
          optional: false,
          display: true
        }]
      }]
    }]
  });
  assert.match(roundTripDsl, /datasetName: String display/);
});

test('parses slice port marker and preserves it for code generation', () => {
  const model = parseMedol(`
    context Runtime {
      slice VerifyRuntimeInfrastructure {
        port
        command VerifyRuntimeInfrastructure {
          runtimeInfrastructureId: UUID id technical
          port: Int
        }
        event RuntimeInfrastructureVerified {
          runtimeInfrastructureId: UUID id technical
        }
      }
    }
  `);

  assert.deepEqual(model.diagnostics, []);
  const slice = model.contexts[0].slices[0];
  assert.equal(slice.port, true);
  const command = model.contexts[0].slices[0].elements.find((element) => element.kind === 'command');
  assert.equal(command?.fields.find((field) => field.name === 'port')?.type, 'Int');

  const codegen = modelToCodegenModel(model);
  assert.equal(codegen.slices[0].port, true);
  assert.equal(codegen.slices[0].commands[0].port, true);

  const roundTripDsl = configToDsl({
    context: 'Runtime',
    slices: [{
      title: 'VerifyRuntimeInfrastructure',
      port: true,
      commands: [{
        title: 'VerifyRuntimeInfrastructure',
        fields: []
      }]
    }]
  });
  assert.match(roundTripDsl, /slice VerifyRuntimeInfrastructure \{\n\s+port\n\s+command VerifyRuntimeInfrastructure \{/);
});

test('uses concept lifecycle states as qualified enum field types', () => {
  const model = parseMedol(`
    context Training {
      slice CreateTrainingJob {
        startsLifecycle
        command CreateTrainingJob {
          trainingJobId: UUID
        }
        event TrainingJobCreated {
          trainingJobId: UUID
        }
        state Draft
      }

      slice TrainingJobDashboard {
        readmodel TrainingJobDashboard[] {
          trainingJobId: UUID id
          currentStatus: TrainingJob.State
          subscribe TrainingJobCreated
        }
      }

      concept TrainingJob {
        state Draft
        state Running
        state Completed
        slice CreateTrainingJob
        slice TrainingJobDashboard
      }
    }
  `);

  assert.deepEqual(model.diagnostics, []);
  const codegen = modelToCodegenModel(model);
  assert.deepEqual(codegen.concepts[0].states, ['Draft', 'Running', 'Completed']);
  assert.equal(
    codegen.slices.find((slice) => slice.name === 'TrainingJobDashboard')
      ?.readmodels[0].fields.find((field) => field.name === 'currentStatus')?.type,
    'TrainingJob.State'
  );

  const roundTripDsl = configToDsl({
    context: 'Training',
    aggregates: [{
      name: 'TrainingJob',
      states: ['Draft', 'Running', 'Completed']
    }],
    slices: [{
      title: 'TrainingJobDashboard',
      aggregates: [{ name: 'TrainingJob' }],
      readmodels: [{
        title: 'TrainingJobDashboard',
        fields: [{
          name: 'currentStatus',
          type: 'TrainingJob.State'
        }]
      }]
    }]
  });
  assert.match(roundTripDsl, /currentStatus: TrainingJob\.State/);
  assert.doesNotMatch(roundTripDsl, /\baggregate\b/);
  assert.match(roundTripDsl, /concept TrainingJob/);
});

test('exports concept lifecycle states and qualified readmodel field types', () => {
  const model = parseMedol(`
    context Training {
      slice CreateTrainingJob {
        startsLifecycle
        command CreateTrainingJob {
          trainingJobId: UUID
        }
        event TrainingJobCreated {
          trainingJobId: UUID
        }
        state Draft
      }

      slice TrainingJobDashboard {
        readmodel TrainingJobDashboard[] {
          trainingJobId: UUID id
          state: TrainingJob.State
          subscribe TrainingJobCreated
        }
      }

      concept TrainingJob {
        state Draft
        state Running
        state Completed
        slice CreateTrainingJob
        slice TrainingJobDashboard
      }
    }
  `);

  assert.deepEqual(model.diagnostics, []);
  const codegen = modelToCodegenModel(model);
  assert.deepEqual(codegen.concepts, [{
    id: codegen.concepts[0].id,
    name: 'TrainingJob',
    title: 'Training Job',
    context: 'Training',
    states: ['Draft', 'Running', 'Completed'],
    slices: [
      {
        id: codegen.slices[0].id,
        name: 'CreateTrainingJob',
        title: 'Create Training Job'
      },
      {
        id: codegen.slices[1].id,
        name: 'TrainingJobDashboard',
        title: 'Training Job Dashboard'
      }
    ]
  }]);
  assert.deepEqual(codegen.contexts[0].concepts[0], {
    id: codegen.concepts[0].id,
    name: 'TrainingJob',
    title: 'Training Job',
    states: ['Draft', 'Running', 'Completed']
  });
  assert.deepEqual(codegen.slices.map((slice) => slice.concepts), [
    ['TrainingJob'],
    ['TrainingJob']
  ]);
  assert.equal(
    codegen.slices[1].readmodels[0].fields.find((field) => field.name === 'state')?.type,
    'TrainingJob.State'
  );
});

test('derives codegen transitions from lifecycle state changes and reactsTo', () => {
  const model = parseMedol(`
    context Federation {
      slice RegisterOrganization {
        startsLifecycle
        command RegisterOrganization {
          organizationId: UUID id generated technical
        }
        event OrganizationRegistered {
          organizationId: UUID id technical
        }
        state Registered
      }

      slice VerifyOrganizationIdentity {
        reactsTo OrganizationRegistered
        command VerifyOrganizationIdentity {
          organizationId: UUID id technical
        }
        event OrganizationIdentityVerified {
          organizationId: UUID id technical
        }
        state IdentityVerified
      }

      concept Organization {
        state Registered
        state IdentityVerified
        slice RegisterOrganization
        slice VerifyOrganizationIdentity
      }
    }
  `);

  assert.deepEqual(model.diagnostics, []);
  const codegen = modelToCodegenModel(model);

  assert.deepEqual(
    codegen.transitions.map((transition) => ({
      owner: transition.owner.name,
      command: transition.command?.name,
      event: transition.event?.name,
      trigger: transition.trigger?.name,
      from: transition.from,
      to: transition.to,
      startsLifecycle: transition.startsLifecycle
    })),
    [
      {
        owner: 'Organization',
        command: 'RegisterOrganization',
        event: 'OrganizationRegistered',
        trigger: undefined,
        from: undefined,
        to: 'Registered',
        startsLifecycle: true
      },
      {
        owner: 'Organization',
        command: 'VerifyOrganizationIdentity',
        event: 'OrganizationIdentityVerified',
        trigger: 'OrganizationRegistered',
        from: 'Registered',
        to: 'IdentityVerified',
        startsLifecycle: false
      }
    ]
  );
});

test('does not infer fromState from cross concept reactsTo events', () => {
  const model = parseMedol(`
    context Training {
      slice CreateTrainingJob {
        startsLifecycle
        command CreateTrainingJob {
          trainingJobId: UUID id generated technical
        }
        event TrainingJobCreated {
          trainingJobId: UUID id technical
        }
        state Draft
      }

      slice SubmitTrainingJob {
        reactsTo TrainingJobCreated
        command SubmitTrainingJob {
          trainingJobId: UUID id technical
        }
        event TrainingJobSubmitted {
          trainingJobId: UUID id technical
        }
        state Submitted
      }

      slice DefineTrainingRunConfiguration {
        startsLifecycle
        command DefineTrainingRunConfiguration {
          trainingRunConfigurationId: UUID id generated technical
        }
        event TrainingRunConfigurationDefined {
          trainingRunConfigurationId: UUID id technical
        }
        state Draft
      }

      slice LockTrainingRunConfiguration {
        reactsTo TrainingJobSubmitted
        command LockTrainingRunConfiguration {
          trainingRunConfigurationId: UUID id technical
        }
        event TrainingRunConfigurationLocked {
          trainingRunConfigurationId: UUID id technical
        }
        state Locked
      }

      concept TrainingJob {
        state Draft
        state Submitted
        slice CreateTrainingJob
        slice SubmitTrainingJob
      }

      concept TrainingRunConfiguration {
        state Draft
        state Locked
        slice DefineTrainingRunConfiguration
        slice LockTrainingRunConfiguration
      }
    }
  `);

  assert.deepEqual(model.diagnostics, []);
  const codegen = modelToCodegenModel(model);
  const lockTransition = codegen.transitions.find((transition) =>
    transition.owner.name === 'TrainingRunConfiguration' && transition.command?.name === 'LockTrainingRunConfiguration'
  );

  assert.equal(lockTransition?.trigger?.name, 'TrainingJobSubmitted');
  assert.equal(lockTransition?.from, undefined);
  assert.equal(lockTransition?.to, 'Locked');
});

test('rejects unknown lifecycle state owners and owners without states', () => {
  const model = parseMedol(`
    context Training {
      slice Dashboard {
        readmodel Dashboard {
          emptyStatus: EmptyJob.State
          missingStatus: MissingJob.State
        }
      }
      concept EmptyJob {
        slice Dashboard
      }
    }
  `);

  assert(model.diagnostics.some((message) => message.includes('unknown type EmptyJob.State')));
  assert(model.diagnostics.some((message) => message.includes('unknown type MissingJob.State')));
});

test('validates enum examples and structured value fields', () => {
  const model = parseMedol(`
    context Orders {
      enum Empty {}
      enum OrderStatus { Draft Submitted }
      value Address {
        city: MissingType
        city: String
      }
      value Recursive {
        child: Recursive
        id: UUID id
      }
      slice SubmitOrder {
        command SubmitOrder {
          status: OrderStatus
        }
        specification "Status" {
          when SubmitOrder {
            status = "Unknown"
          }
          then reject "Invalid status"
        }
      }
    }
  `);

  assert(model.diagnostics.some((message) => message.includes('enum Empty must declare at least one value')));
  assert(model.diagnostics.some((message) => message.includes('duplicate field city')));
  assert(model.diagnostics.some((message) => message.includes('unknown type MissingType')));
  assert(model.diagnostics.some((message) => message.includes('cyclic structured value Recursive -> Recursive')));
  assert(model.diagnostics.some((message) => message.includes('cannot declare identity or generated attributes')));
  assert(model.diagnostics.some((message) => message.includes('is not a member of enum OrderStatus')));
});

test('loads imports, merges context fragments, and keeps qualified IDs stable', () => {
  const files = new Map<string, string>([
    ['/workspace/types.medol', `
      domain Commerce {
        context Orders {
          enum OrderStatus { Draft Submitted }
          value Address {
            city: String
          }
        }
      }
    `],
    ['/workspace/main.medol', `
      import "./types.medol"
      domain Commerce {
        context Orders {
          slice SubmitOrder {
            command SubmitOrder {
              status: OrderStatus
              address: Address
            }
          }
          concept Order {
            slice SubmitOrder
          }
        }
      }
    `]
  ]);
  const fileSystem: MedolProjectFileSystem = {
    readFile: (path) => {
      const text = files.get(path);
      if (text === undefined) throw new Error('not found');
      return text;
    },
    resolveImport: (_importer, imported) => `/workspace/${imported.replace('./', '')}`
  };

  const model = parseMedolFile('/workspace/main.medol', fileSystem);
  assert.deepEqual(model.diagnostics, []);
  assert.equal(model.contexts.length, 1);
  assert.deepEqual(model.contexts[0].valueTypes.map((type) => type.name), ['OrderStatus', 'Address']);

  const first = modelToCodegenModel(model);
  const second = modelToCodegenModel(parseMedolFile('/workspace/main.medol', fileSystem));
  const inline = modelToCodegenModel(parseMedol(`
    domain Commerce {
      context Orders {
        enum OrderStatus { Draft Submitted }
        value Address {
          city: String
        }
        slice SubmitOrder {
          command SubmitOrder {
            status: OrderStatus
            address: Address
          }
        }
        concept Order {
          slice SubmitOrder
        }
      }
    }
  `));
  assert.equal(first.concepts[0].id, second.concepts[0].id);
  assert.equal(first.slices[0].id, second.slices[0].id);
  assert.equal(first.valueTypes[0].id, second.valueTypes[0].id);
  assert.equal(first.concepts[0].id, inline.concepts[0].id);
  assert.equal(first.slices[0].id, inline.slices[0].id);
  assert.equal(first.valueTypes[0].id, inline.valueTypes[0].id);
});

test('reports circular imports and keeps same concept names distinct across contexts', () => {
  const files = new Map<string, string>([
    ['/workspace/a.medol', 'import "./b.medol"\ncontext Sales { concept Item {} }'],
    ['/workspace/b.medol', 'import "./a.medol"\ncontext Catalog { concept Item {} }']
  ]);
  const fileSystem: MedolProjectFileSystem = {
    readFile: (path) => files.get(path) ?? (() => { throw new Error('not found'); })(),
    resolveImport: (_importer, imported) => `/workspace/${imported.replace('./', '')}`
  };

  const model = parseMedolFile('/workspace/a.medol', fileSystem);
  assert(model.diagnostics.some((message) => message.includes('Circular import')));
  const codegen = modelToCodegenModel(model);
  assert.equal(new Set(codegen.concepts.map((concept) => concept.id)).size, 2);
});
