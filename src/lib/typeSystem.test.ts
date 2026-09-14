import assert from 'node:assert/strict';
import test from 'node:test';
import { modelToCodegenModel } from './codegenModel';
import { configToDsl } from './configToDsl';
import { parseMedol, parseMedolSources } from './dslParser';
import { parseMedolFile, type MedolProjectFileSystem } from './medolProject';
import { resolveBuiltinMedolImport } from './builtinMedolModels';

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

test('parses sync read models with source aliases and preserves them for code generation', () => {
  const model = parseMedol(`
    context DatasetGovernance {
      slice FeatureSchemaCatalog {
        readmodel FeatureSchemaCatalog[] {
          featureSchemaId: UUID id
          featureDomain: String display
          version: String
          schemaStatus: String
        }
      }
    }

    context RuntimeAgentOperations {
      slice AgentFeatureSchemaCatalog {
        sync readmodel AgentFeatureSchemaCatalog[] from DatasetGovernance.FeatureSchemaCatalog where organizationId = sync.organizationId {
          featureSchemaId: UUID id
          featureDomain: String display
          featureSchemaVersion: String from version
          schemaStatus: String
          syncedAt: DateTime
        }
      }
    }
  `);

  assert.deepEqual(model.diagnostics, []);
  const runtimeContext = model.contexts.find((context) => context.name === 'RuntimeAgentOperations');
  const readmodel = runtimeContext?.slices[0].elements[0];
  assert(readmodel);
  assert.equal(readmodel.sync, true);
  assert.equal(readmodel.syncSource, 'DatasetGovernance.FeatureSchemaCatalog');
  assert.deepEqual(readmodel.syncFilters, [{ target: 'organizationId', source: 'sync.organizationId' }]);
  assert.equal(readmodel.fields.find((field) => field.name === 'featureSchemaVersion')?.mapping?.sources[0], 'version');
  assert.equal(readmodel.fields.find((field) => field.name === 'syncedAt')?.mapping, undefined);

  const codegen = modelToCodegenModel(model);
  const codegenReadmodel = codegen.slices
    .find((slice) => slice.context === 'RuntimeAgentOperations')
    ?.readmodels[0];
  assert(codegenReadmodel);
  assert.equal(codegenReadmodel.sync, true);
  assert.equal(codegenReadmodel.syncSource, 'DatasetGovernance.FeatureSchemaCatalog');
  assert.deepEqual(codegenReadmodel.syncFilters, [{ target: 'organizationId', source: 'sync.organizationId' }]);
  assert.equal(
    codegenReadmodel.fields.find((field) => field.name === 'featureSchemaVersion')?.source?.from[0],
    'version'
  );
  assert.deepEqual(codegenReadmodel.fields.find((field) => field.name === 'featureDomain')?.source, {
    kind: 'direct',
    from: ['featureDomain']
  });
  assert.equal(codegenReadmodel.fields.find((field) => field.name === 'syncedAt')?.source, undefined);

  const roundTripDsl = configToDsl({
    context: 'RuntimeAgentOperations',
    slices: [{
      title: 'AgentFeatureSchemaCatalog',
      readmodels: [{
        title: 'AgentFeatureSchemaCatalog',
        listElement: true,
        sync: true,
        syncSource: 'DatasetGovernance.FeatureSchemaCatalog',
        syncFilters: [{ target: 'organizationId', source: 'sync.organizationId' }],
        fields: [{
          name: 'featureSchemaId',
          type: 'UUID',
          cardinality: 'Single',
          optional: false,
          idAttribute: true
        }]
      }]
    }]
  });
  assert.match(roundTripDsl, /sync readmodel AgentFeatureSchemaCatalog\[\] from DatasetGovernance\.FeatureSchemaCatalog where organizationId = sync\.organizationId/);
});

test('parses file field attribute and preserves it for code generation', () => {
  const model = parseMedol(`
    context ModelRepository {
      slice RegisterModelArtifact {
        command RegisterModelArtifact {
          sourceLocation: String? file
        }
      }
    }
  `);

  assert.deepEqual(model.diagnostics, []);
  const field = model.contexts[0].slices[0].elements[0].fields.find((item) => item.name === 'sourceLocation');
  assert(field);
  assert(field.attributes.includes('file'));

  const codegen = modelToCodegenModel(model);
  const codegenField = codegen.slices[0].commands[0].fields.find((item) => item.name === 'sourceLocation');
  assert.equal(codegenField?.file, true);

  const roundTripDsl = configToDsl({
    context: 'ModelRepository',
    slices: [{
      title: 'RegisterModelArtifact',
      commands: [{
        title: 'RegisterModelArtifact',
        fields: [{
          name: 'sourceLocation',
          type: 'String',
          cardinality: 'Single',
          optional: true,
          file: true
        }]
      }]
    }]
  });
  assert.match(roundTripDsl, /sourceLocation: String\? file/);
});

test('parses uploadFile field attribute and preserves it for code generation', () => {
  const model = parseMedol(`
    context FileUpload {
      slice StageFileUpload {
        command StageFileUpload {
          uploadedFile: String uploadFile
        }
      }
    }
  `);

  assert.deepEqual(model.diagnostics, []);
  const field = model.contexts[0].slices[0].elements[0].fields.find((item) => item.name === 'uploadedFile');
  assert(field);
  assert(field.attributes.includes('uploadFile'));

  const codegen = modelToCodegenModel(model);
  const codegenField = codegen.slices[0].commands[0].fields.find((item) => item.name === 'uploadedFile');
  assert.equal(codegenField?.uploadFile, true);

  const roundTripDsl = configToDsl({
    context: 'FileUpload',
    slices: [{
      title: 'StageFileUpload',
      commands: [{
        title: 'StageFileUpload',
        fields: [{
          name: 'uploadedFile',
          type: 'String',
          cardinality: 'Single',
          optional: false,
          uploadFile: true
        }]
      }]
    }]
  });
  assert.match(roundTripDsl, /uploadedFile: String uploadFile/);
});

test('parses portOutput field attribute and preserves it for code generation', () => {
  const model = parseMedol(`
    context RuntimeAgentOperations {
      slice StartRoundExecution {
        port
        event RoundExecutionStarted {
          runtimeEngineJobId: String portOutput
        }
      }
    }
  `);

  assert.deepEqual(model.diagnostics, []);
  const field = model.contexts[0].slices[0].elements[0].fields.find((item) => item.name === 'runtimeEngineJobId');
  assert(field);
  assert(field.attributes.includes('portOutput'));

  const codegen = modelToCodegenModel(model);
  const codegenField = codegen.slices[0].events[0].fields.find((item) => item.name === 'runtimeEngineJobId');
  assert.equal(codegenField?.portOutput, true);

  const roundTripDsl = configToDsl({
    context: 'RuntimeAgentOperations',
    slices: [{
      title: 'StartRoundExecution',
      events: [{
        title: 'RoundExecutionStarted',
        fields: [{
          name: 'runtimeEngineJobId',
          type: 'String',
          cardinality: 'Single',
          optional: false,
          portOutput: true
        }]
      }]
    }]
  });
  assert.match(roundTripDsl, /runtimeEngineJobId: String portOutput/);
});

test('parses command result fields separately from command input fields', () => {
  const model = parseMedol(`
    context IdentityAccessManagement {
      slice GenerateUserAccountLoginPassword {
        port
        command GenerateUserAccountLoginPassword {
          userAccountId: UUID id technical
          passwordResetRequired: Boolean

          result {
            temporaryPassword: String technical
          }
        }
        event UserAccountLoginPasswordGenerated {
          userAccountId: UUID id technical
          passwordHash: String portOutput technical
          passwordResetRequired: Boolean
        }
      }
    }
  `);

  assert.deepEqual(model.diagnostics, []);
  const command = model.contexts[0].slices[0].elements.find((item) => item.kind === 'command');
  assert(command);
  assert.deepEqual(command.fields.map((field) => field.name), ['userAccountId', 'passwordResetRequired']);
  assert.deepEqual(command.resultFields?.map((field) => field.name), ['temporaryPassword']);

  const codegen = modelToCodegenModel(model);
  assert.deepEqual(codegen.slices[0].commands[0].fields.map((field) => field.name), ['userAccountId', 'passwordResetRequired']);
  assert.deepEqual(codegen.slices[0].commands[0].resultFields?.map((field) => field.name), ['temporaryPassword']);

  const roundTripDsl = configToDsl({
    context: 'IdentityAccessManagement',
    slices: [{
      title: 'GenerateUserAccountLoginPassword',
      port: true,
      commands: [{
        title: 'GenerateUserAccountLoginPassword',
        fields: [{
          name: 'userAccountId',
          type: 'UUID',
          cardinality: 'Single',
          optional: false,
          idAttribute: true,
          technicalAttribute: true
        }],
        resultFields: [{
          name: 'temporaryPassword',
          type: 'String',
          cardinality: 'Single',
          optional: false,
          technicalAttribute: true
        }]
      }]
    }]
  });
  assert.match(roundTripDsl, /command GenerateUserAccountLoginPassword \{/);
  assert.match(roundTripDsl, /result \{\n\s+temporaryPassword: String technical\n\s+\}/);
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

test('infers transition fromState from specific failure trigger event', () => {
  const model = parseMedol(`
    context Runtime {
      slice StartRoundExecution {
        startsLifecycle
        command StartRoundExecution {
          roundExecutionId: UUID id generated technical
        }
        event RoundExecutionStarted {
          roundExecutionId: UUID id technical
        }
        event RoundExecutionStartFailed {
          roundExecutionId: UUID id technical
          failureReason: String
        }
        state Running
      }

      slice RetryRoundExecutionAfterStartFailure {
        reactsTo RoundExecutionStartFailed
        command RetryRoundExecutionAfterStartFailure {
          roundExecutionId: UUID id technical
        }
        event RoundExecutionStartRetryStarted {
          roundExecutionId: UUID id technical
        }
        event RoundExecutionStartRetryFailed {
          roundExecutionId: UUID id technical
          failureReason: String
        }
        state Retried
      }

      slice ReleaseRuntimeEngineJobAfterStartFailure {
        reactsTo RoundExecutionStartFailed
        command ReleaseRuntimeEngineJobAfterStartFailure {
          roundExecutionId: UUID id technical
        }
        event RuntimeEngineJobReleaseFailedOrSkippedAfterStartFailure {
          roundExecutionId: UUID id technical
        }
        state RuntimeEngineReleaseHandled
      }

      slice ReleaseRuntimeEngineJobAfterRetryFailure {
        reactsTo RoundExecutionStartRetryFailed
        command ReleaseRuntimeEngineJobAfterRetryFailure {
          roundExecutionId: UUID id technical
        }
        event RuntimeEngineJobReleaseFailedOrSkippedAfterRetry {
          roundExecutionId: UUID id technical
        }
        state RuntimeEngineReleaseHandled
      }

      concept RoundExecution {
        state Running
        state StartFailed
        state Retried
        state Failed
        state RuntimeEngineReleaseHandled
        slice StartRoundExecution
        slice RetryRoundExecutionAfterStartFailure
        slice ReleaseRuntimeEngineJobAfterStartFailure
        slice ReleaseRuntimeEngineJobAfterRetryFailure
      }
    }
  `);

  assert.deepEqual(model.diagnostics, []);
  const codegen = modelToCodegenModel(model);
  const transitionByCommand = new Map(codegen.transitions.map((transition) => [transition.command?.name, transition]));

  assert.equal(transitionByCommand.get('RetryRoundExecutionAfterStartFailure')?.from, 'StartFailed');
  assert.equal(transitionByCommand.get('ReleaseRuntimeEngineJobAfterStartFailure')?.from, 'StartFailed');
  assert.equal(transitionByCommand.get('ReleaseRuntimeEngineJobAfterRetryFailure')?.from, 'Failed');
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

test('loads built-in identity access management imports into the selected deployment', () => {
  const model = parseMedol(`
    import identity-access-management as Iam deploy Support

    domain Demo {
      context Support {
        slice KeepAlive {
          command KeepAlive {
            keepAliveId: UUID id generated technical
          }
        }
      }

      deployment Support {
        includes Support
      }
    }
  `);

  assert.deepEqual(model.diagnostics, []);
  const codegen = modelToCodegenModel(model);
  assert.equal(codegen.domain, 'Demo');
  assert(codegen.contexts.some((context) => context.name === 'IdentityAccessManagement'));
  assert.deepEqual(
    codegen.deployments.find((deployment) => deployment.name === 'Support')?.contexts.map((context) => context.name),
    ['Support', 'IdentityAccessManagement']
  );
});

test('loads one built-in identity access management context into multiple deployments', () => {
  const model = parseMedolFile('/workspace/main.medol', {
    readFile: () => `
      import identity-access-management as PlatformIam deploy Support
      import identity-access-management as ParticipantIam deploy RuntimeAgent

      domain Demo {
        context Support {
          slice KeepAlive {
            command KeepAlive {
              keepAliveId: UUID id generated technical
            }
          }
        }

        context RuntimeAgent {
          slice PingRuntime {
            command PingRuntime {
              pingRuntimeId: UUID id generated technical
            }
          }
        }

        deployment Support {
          includes Support
        }

        deployment RuntimeAgent {
          includes RuntimeAgent
        }
      }
    `,
    resolveImport: () => ''
  });

  assert.deepEqual(model.diagnostics, []);
  const codegen = modelToCodegenModel(model);
  assert.equal(
    codegen.contexts.filter((context) => context.name === 'IdentityAccessManagement').length,
    1
  );
  assert.deepEqual(
    codegen.deployments.find((deployment) => deployment.name === 'Support')?.contexts.map((context) => context.name),
    ['Support', 'IdentityAccessManagement']
  );
  assert.deepEqual(
    codegen.deployments.find((deployment) => deployment.name === 'RuntimeAgent')?.contexts.map((context) => context.name),
    ['RuntimeAgent', 'IdentityAccessManagement']
  );
});

test('deduplicates repeated built-in identity access management sources in merged models', () => {
  const supportIam = resolveBuiltinMedolImport({
    module: 'identity-access-management',
    alias: 'PlatformIam',
    deployment: 'Support'
  });
  const runtimeIam = resolveBuiltinMedolImport({
    module: 'identity-access-management',
    alias: 'ParticipantIam',
    deployment: 'RuntimeAgent'
  });
  assert(supportIam);
  assert(runtimeIam);

  const model = parseMedolSources([
    supportIam,
    runtimeIam,
    {
      sourceName: '/workspace/main.medol',
      text: `
        domain Demo {
          deployment Support {
            includes Support
          }

          deployment RuntimeAgent {
            includes RuntimeAgent
          }
        }
      `
    }
  ]);

  assert.deepEqual(model.diagnostics, []);
  const iam = model.contexts.find((context) => context.name === 'IdentityAccessManagement');
  assert(iam);
  assert.equal(iam.concepts.filter((concept) => concept.name === 'UserAccount').length, 1);
  assert.equal(iam.slices.filter((slice) => slice.name === 'RegisterUserAccount').length, 1);
  assert.deepEqual(
    model.deployments.find((deployment) => deployment.name === 'Support')?.contexts,
    ['Support', 'IdentityAccessManagement']
  );
  assert.deepEqual(
    model.deployments.find((deployment) => deployment.name === 'RuntimeAgent')?.contexts,
    ['RuntimeAgent', 'IdentityAccessManagement']
  );
});

test('exports frontend applications independently from backend deployments', () => {
  const model = parseMedol(`
    domain Demo {
      context Orders {
        slice OrderCatalogs {
          readmodel OrderCatalog[] {
            orderId: UUID id
          }
        }
      }

      context RuntimeAgentOperations {
        slice DatasetAccessCatalogs {
          readmodel DatasetAccessCatalog[] {
            datasetAccessId: UUID id
          }
        }
      }

      deployment BackOfficeBackend {
        includes Orders
        includes RuntimeAgentOperations
      }

      frontend ParticipantConsole {
        includes RuntimeAgentOperations from BackOfficeBackend
      }
    }
  `);

  assert.deepEqual(model.diagnostics, []);
  const codegen = modelToCodegenModel(model);
  assert.deepEqual(
    codegen.frontendApplications?.map((application) => ({
      name: application.name,
      contexts: application.contexts.map((context) => ({
        name: context.name,
        backend: context.backend
      }))
    })),
    [{
      name: 'ParticipantConsole',
      contexts: [{
        name: 'RuntimeAgentOperations',
        backend: 'BackOfficeBackend'
      }]
    }]
  );
  assert.deepEqual(
    codegen.deployments?.find((deployment) => deployment.name === 'BackOfficeBackend')?.contexts.map((context) => context.name),
    ['Orders', 'RuntimeAgentOperations']
  );
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
