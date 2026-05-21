domain FederationLearningPlatform {
context FederationManagement {
  note "Federation management owns organizations, federations, and trusted compute nodes."

  aggregate Organization {
    state Registered
    state IdentityVerified
    state Active
    state Deactivated

    slice RegisterOrganization {
      createsAggregate
      actor OrganizationAdmin
      ui OrganizationRegistrationScreen

      command RegisterOrganization {
        organizationId: UUID id generated technical
        organizationName: String
        organizationType: String
        contactEmail: String
        legalEntityId: String
        countryCode: String
      }

      event OrganizationRegistered {
        organizationId: UUID id technical
        organizationName: String
        organizationType: String
        contactEmail: String
        legalEntityId: String
        countryCode: String
      }

      state Registered
    }

    slice VerifyOrganizationIdentity {
      actor ComplianceOfficer
      ui OrganizationVerificationScreen
      reactsTo OrganizationRegistered

      command VerifyOrganizationIdentity {
        organizationId: UUID id technical
        verificationProvider: String
        identityEvidenceId: UUID
      }

      event OrganizationIdentityVerified {
        organizationId: UUID id technical
        verificationProvider: String
        identityEvidenceId: UUID
      }

      state IdentityVerified
    }

    slice ActivateOrganization {
      actor PlatformAdmin
      ui OrganizationAdminScreen
      reactsTo OrganizationIdentityVerified

      command ActivateOrganization {
        organizationId: UUID id technical
        activationNote: String?
      }

      event OrganizationActivated {
        organizationId: UUID id technical
        activationNote: String?
      }

      state Active
    }

    slice DeactivateOrganization {
      actor PlatformAdmin
      ui OrganizationAdminScreen
      reactsTo OrganizationActivated

      command DeactivateOrganization {
        organizationId: UUID id technical
        deactivationReason: String
      }

      event OrganizationDeactivated {
        organizationId: UUID id technical
        deactivationReason: String
      }

      state Deactivated
    }

    slice OrganizationDirectory {
      projection OrganizationDirectory {
        organizationId: UUID id
        organizationName: String
        organizationType: String
        state: String
        verified: Boolean
        trustedNodeCount: Int
        approvedDatasetCount: Int
        subscribe OrganizationRegistered
        subscribe OrganizationIdentityVerified
        subscribe OrganizationActivated
        subscribe OrganizationDeactivated
        subscribe ComputeNodeTrusted
        subscribe DatasetApprovedForTraining
      }
    }
  }

  aggregate Federation {
    state Draft
    state Active
    state Suspended

    slice CreateFederation {
      createsAggregate
      actor PlatformAdmin
      ui FederationSetupScreen

      command CreateFederation {
        federationId: UUID id generated technical
        federationName: String
        description: String
        governancePolicyId: UUID
        minimumParticipantCount: Int
        minimumTrustedNodeCount: Int
      }

      event FederationCreated {
        federationId: UUID id technical
        federationName: String
        description: String
        governancePolicyId: UUID
        minimumParticipantCount: Int
        minimumTrustedNodeCount: Int
      }

      state Draft
    }

    slice InviteParticipant {
      actor FederationOwner
      ui ParticipantInvitationScreen
      reactsTo FederationCreated

      command InviteParticipant {
        federationId: UUID id technical
        organizationId: UUID
        invitationNote: String
      }

      event ParticipantInvited {
        federationId: UUID id technical
        organizationId: UUID
        invitationNote: String
      }
    }

    slice ApproveParticipant {
      actor GovernanceReviewer
      ui MembershipReviewScreen
      reactsTo ParticipantInvited

      command ApproveParticipant {
        federationId: UUID id technical
        organizationId: UUID
        approvalNote: String?
      }

      event ParticipantJoined {
        federationId: UUID id technical
        organizationId: UUID
        approvalNote: String?
      }

      state Active
    }

    slice FederationOverview {
      reactsTo ParticipantJoined

      projection FederationOverview {
        federationId: UUID id
        federationName: String
        state: String
        activeMemberCount: Int
        pendingInvitationCount: Int
        trustedNodeCount: Int
        activeTrainingJobCount: Int
        subscribe FederationCreated
        subscribe ParticipantJoined
        subscribe ComputeNodeTrusted
        subscribe ComputeNodeSuspended
        subscribe TrainingJobSubmitted
      }
    }
  }

  aggregate ComputeNode {
    state Registered
    state CapabilityDeclared
    state Trusted
    state Suspended

    slice RegisterComputeNode {
      createsAggregate
      actor NodeOperator
      ui NodeRegistrationScreen
      reactsTo OrganizationActivated

      command RegisterComputeNode {
        nodeId: UUID id generated technical
        organizationId: UUID
        nodeName: String
        nodeType: String
        hardwareProfile: String
        runtimeProfile: String
        confidentialComputeSupported: Boolean
      }

      event ComputeNodeRegistered {
        nodeId: UUID id technical
        organizationId: UUID
        nodeName: String
        nodeType: String
        hardwareProfile: String
        runtimeProfile: String
        confidentialComputeSupported: Boolean
      }

      state Registered
    }

    slice UpdateNodeCapability {
      actor NodeOperator
      ui NodeCapabilityScreen
      reactsTo ComputeNodeRegistered

      command UpdateNodeCapability {
        nodeId: UUID id technical
        gpuCount: Int
        cpuCoreCount: Int
        memoryGb: Int
        storageGb: Int
        supportedFrameworks: String[]
        maxConcurrentJobs: Int
      }

      event NodeCapabilityUpdated {
        nodeId: UUID id technical
        gpuCount: Int
        cpuCoreCount: Int
        memoryGb: Int
        storageGb: Int
        supportedFrameworks: String[]
        maxConcurrentJobs: Int
      }

      state CapabilityDeclared
    }

    slice TrustComputeNode {
      actor SecurityReviewer
      ui NodeTrustScreen
      reactsTo NodeCapabilityUpdated

      command TrustComputeNode {
        nodeId: UUID id technical
        trustLevel: String
        attestationReportId: UUID
        attestationExpiresAt: DateTime
      }

      event ComputeNodeTrusted {
        nodeId: UUID id technical
        trustLevel: String
        attestationReportId: UUID
        attestationExpiresAt: DateTime
      }

      state Trusted
    }

    slice SuspendComputeNode {
      actor SecurityReviewer
      ui NodeTrustScreen
      reactsTo RuntimeHeartbeatRecorded

      command SuspendComputeNode {
        nodeId: UUID id technical
        suspensionReason: String
      }

      event ComputeNodeSuspended {
        nodeId: UUID id technical
        suspensionReason: String
      }

      state Suspended
    }
  }
}

context DatasetGovernance {
  note "Dataset governance separates schema, dataset assets, runtime access profiles, and train evaluation bundles."

  integration DatasetAccessRuntime {
    source DatasetAccessProfile
    target EdgeRuntime
    reactsTo DatasetAccessValidationRequested
    emits CompleteRuntimeDatasetAccessValidation
  }

  aggregate FeatureSchema {
    state Published

    slice DefineFeatureSchema {
      createsAggregate
      actor DataSteward
      ui FeatureSchemaEditor

      command DefineFeatureSchema {
        featureSchemaId: UUID id generated technical
        domain: String
        version: Int
        featureCount: Int
      }

      event FeatureSchemaPublished {
        featureSchemaId: UUID id technical
        domain: String
        version: Int
        featureCount: Int
      }

      state Published
    }
  }

  aggregate Dataset {
    state Registered
    state ContractValidated
    state Approved

    slice RegisterDataset {
      createsAggregate
      actor DataOwner
      ui DatasetRegistrationScreen
      reactsTo FeatureSchemaPublished

      command RegisterDataset {
        datasetId: UUID id generated technical
        organizationId: UUID
        featureSchemaId: UUID
        datasetType: String
        datasetUsage: String
        sampleCount: Int
        sensitivityLevel: String
        containsPII: Boolean
        region: String
        usagePolicyId: UUID
      }

      event DatasetRegistered {
        datasetId: UUID id technical
        organizationId: UUID
        featureSchemaId: UUID
        datasetType: String
        datasetUsage: String
        sampleCount: Int
        sensitivityLevel: String
        containsPII: Boolean
        region: String
        usagePolicyId: UUID
      }

      state Registered
    }

    slice ValidateDatasetContract {
      reactsTo DatasetRegistered

      automation ValidateDatasetContractAutomatically {
        condition sampleCount > 0
        emits ValidateDatasetContract
      }

      command ValidateDatasetContract {
        datasetId: UUID id technical
        featureSchemaId: UUID
        validationProfile: String
      }

      event DatasetContractValidated {
        datasetId: UUID id technical
        featureSchemaId: UUID
        schemaCompatible: Boolean
        labelCompatible: Boolean
        qualityScore: Decimal
        nonIidScore: Decimal
      }

      state ContractValidated
    }

    slice ApproveDatasetForTraining {
      actor ComplianceOfficer
      ui DatasetApprovalScreen
      reactsTo DatasetContractValidated

      command ApproveDatasetForTraining {
        datasetId: UUID id technical
        allowedFederatedUse: String
        expiresAt: DateTime
      }

      event DatasetApprovedForTraining {
        datasetId: UUID id technical
        allowedFederatedUse: String
        expiresAt: DateTime
      }

      state Approved
    }

    slice DatasetCapability {
      projection DatasetCapability {
        datasetId: UUID id
        organizationId: UUID
        featureSchemaId: UUID
        datasetUsage: String
        sampleCount: Int
        approved: Boolean
        subscribe DatasetRegistered
        subscribe DatasetContractValidated
        subscribe DatasetApprovedForTraining
      }
    }
  }

  aggregate DatasetAccessProfile {
    state Configured
    state ValidationRequested
    state Validated

    slice ConfigureDatasetAccessProfile {
      createsAggregate
      actor NodeOperator
      ui DatasetAccessProfileScreen
      reactsTo DatasetApprovedForTraining

      command ConfigureDatasetAccessProfile {
        accessProfileId: UUID id generated technical
        datasetId: UUID
        nodeId: UUID
        runtimeId: UUID
        connectorType: String
        connectionProfileRef: String
        credentialRef: String
        storageLocationRef: String
        dataFormat: String
        readerPlugin: String
        readMode: String
        featureMappingId: UUID?
      }

      event DatasetAccessProfileConfigured {
        accessProfileId: UUID id technical
        datasetId: UUID
        nodeId: UUID
        runtimeId: UUID
        connectorType: String
        connectionProfileRef: String
        credentialRef: String
        storageLocationRef: String
        dataFormat: String
        readerPlugin: String
        readMode: String
        featureMappingId: UUID?
      }

      state Configured
    }

    slice RequestRuntimeDatasetAccessValidation {
      reactsTo DatasetAccessProfileConfigured

      policy ValidateDatasetAccessAfterProfileConfigured {
        on DatasetAccessProfileConfigured
        issue RequestRuntimeDatasetAccessValidation
      }

      command RequestRuntimeDatasetAccessValidation {
        accessProfileId: UUID id technical
        datasetId: UUID
        runtimeId: UUID
        validationMode: String
      }

      event DatasetAccessValidationRequested {
        accessProfileId: UUID id technical
        datasetId: UUID
        runtimeId: UUID
        validationMode: String
      }

      state ValidationRequested
    }

    slice CompleteRuntimeDatasetAccessValidation {
      command CompleteRuntimeDatasetAccessValidation {
        accessProfileId: UUID id technical
        datasetId: UUID
        runtimeId: UUID
        readable: Boolean
        schemaReadable: Boolean
        sampleBatchReadable: Boolean
        validationReportId: UUID
      }

      event RuntimeDatasetAccessValidated {
        accessProfileId: UUID id technical
        datasetId: UUID
        runtimeId: UUID
        readable: Boolean
        schemaReadable: Boolean
        sampleBatchReadable: Boolean
        validationReportId: UUID
      }

      state Validated
    }

    slice DatasetRuntimeAccessCatalog {
      projection DatasetRuntimeAccessCatalog {
        accessProfileId: UUID id
        datasetId: UUID
        nodeId: UUID
        runtimeId: UUID
        connectorType: String
        readerPlugin: String
        readMode: String
        readable: Boolean
        subscribe DatasetAccessProfileConfigured
        subscribe RuntimeDatasetAccessValidated
      }
    }
  }

  aggregate TrainingEvaluationDatasetBundle {
    state Declared

    slice DeclareTrainingEvaluationDatasets {
      createsAggregate
      actor DataOwner
      ui DatasetBundleScreen
      reactsTo RuntimeDatasetAccessValidated

      command DeclareTrainingEvaluationDatasets {
        datasetBundleId: UUID id generated technical
        organizationId: UUID
        nodeId: UUID
        ownerRole: String
        trainingDatasetId: UUID
        trainingDatasetAccessProfileId: UUID
        evaluationDatasetId: UUID
        evaluationDatasetAccessProfileId: UUID
        featureSchemaId: UUID
      }

      event TrainingEvaluationDatasetsDeclared {
        datasetBundleId: UUID id technical
        organizationId: UUID
        nodeId: UUID
        ownerRole: String
        trainingDatasetId: UUID
        trainingDatasetAccessProfileId: UUID
        evaluationDatasetId: UUID
        evaluationDatasetAccessProfileId: UUID
        featureSchemaId: UUID
      }

      state Declared
    }

    slice TrainingEvaluationDatasetCatalog {
      projection TrainingEvaluationDatasetCatalog {
        datasetBundleId: UUID id
        organizationId: UUID
        nodeId: UUID
        ownerRole: String
        trainingDatasetId: UUID
        trainingDatasetAccessProfileId: UUID
        evaluationDatasetId: UUID
        evaluationDatasetAccessProfileId: UUID
        subscribe TrainingEvaluationDatasetsDeclared
      }
    }
  }
}

context TrainingOrchestration {
  note "Training orchestration owns job intent and each round of distributed training and evaluation."

  integration SecureAggregationProvider {
    source TrainingRound
    target SecureAggregationService
    reactsTo SecureAggregationRequested
    emits CompleteSecureAggregation
  }

  integration EdgeTrainingRuntime {
    source TrainingRound
    target EdgeRuntime
    reactsTo GlobalModelDistributed
    emits SubmitLocalModelUpdate
    emits SubmitLocalModelEvaluation
  }

  integration AggregationNodeRuntime {
    source TrainingRound
    target AggregationRuntime
    reactsTo GlobalModelUpdated
    emits SubmitGlobalModelEvaluation
  }

  aggregate TrainingJob {
    state Draft
    state StrategyConfigured
    state Submitted
    state RecruitingNodes
    state Running
    state Completed

    slice CreateTrainingJob {
      createsAggregate
      actor ResearchLead
      ui TrainingJobCreationScreen
      reactsTo TrainingEvaluationDatasetsDeclared

      command CreateTrainingJob {
        trainingJobId: UUID id generated technical
        federationId: UUID
        featureSchemaId: UUID
        aggregatorDatasetBundleId: UUID
        aggregatorTrainingDatasetId: UUID
        aggregatorTrainingDatasetAccessProfileId: UUID
        aggregatorEvaluationDatasetId: UUID
        aggregatorEvaluationDatasetAccessProfileId: UUID
        objective: String
        targetMetric: String
        minimumAccuracy: Decimal
      }

      event TrainingJobCreated {
        trainingJobId: UUID id technical
        federationId: UUID
        featureSchemaId: UUID
        aggregatorDatasetBundleId: UUID
        aggregatorTrainingDatasetId: UUID
        aggregatorTrainingDatasetAccessProfileId: UUID
        aggregatorEvaluationDatasetId: UUID
        aggregatorEvaluationDatasetAccessProfileId: UUID
        objective: String
        targetMetric: String
        minimumAccuracy: Decimal
      }

      state Draft
    }

    slice ConfigureTrainingStrategy {
      actor MLOpsEngineer
      ui TrainingStrategyScreen
      reactsTo TrainingJobCreated

      command ConfigureTrainingStrategy {
        trainingJobId: UUID id technical
        strategyName: String
        maxRounds: Int
        minimumNodesPerRound: Int
        secureAggregationRequired: Boolean
      }

      event TrainingStrategyConfigured {
        trainingJobId: UUID id technical
        strategyName: String
        maxRounds: Int
        minimumNodesPerRound: Int
        secureAggregationRequired: Boolean
      }

      state StrategyConfigured
    }

    slice SubmitTrainingJob {
      actor ResearchLead
      ui TrainingSubmissionScreen
      reactsTo TrainingStrategyConfigured

      command SubmitTrainingJob {
        trainingJobId: UUID id technical
      }

      event TrainingJobSubmitted {
        trainingJobId: UUID id technical
        minimumNodesPerRound: Int
      }

      state Submitted
    }

    slice RequestNodeParticipation {
      reactsTo TrainingJobSubmitted

      policy RequestEligibleNodes {
        on TrainingJobSubmitted
        issue RequestNodeParticipation
      }

      command RequestNodeParticipation {
        trainingJobId: UUID id technical
        nodeId: UUID
        participantDatasetBundleId: UUID
        trainingDatasetAccessProfileId: UUID
        evaluationDatasetAccessProfileId: UUID
      }

      event NodeParticipationRequested {
        trainingJobId: UUID id technical
        nodeId: UUID
        participantDatasetBundleId: UUID
        trainingDatasetAccessProfileId: UUID
        evaluationDatasetAccessProfileId: UUID
      }

      state RecruitingNodes
    }

    slice AcceptNodeParticipation {
      actor NodeOperator
      ui NodeParticipationScreen
      reactsTo NodeParticipationRequested

      command AcceptNodeParticipation {
        trainingJobId: UUID id technical
        nodeId: UUID
        participantDatasetBundleId: UUID
        availableGpuCount: Int
      }

      event NodeReadyForTraining {
        trainingJobId: UUID id technical
        nodeId: UUID
        participantDatasetBundleId: UUID
        availableGpuCount: Int
      }
    }

    slice TrackTrainingJobRunning {
      reactsTo TrainingRoundStarted

      policy MarkTrainingJobRunningWhenRoundStarts {
        on TrainingRoundStarted
        issue MarkTrainingJobRunning
      }

      command MarkTrainingJobRunning {
        trainingJobId: UUID id technical
        roundId: UUID
        roundNumber: Int
      }

      event TrainingJobRunning {
        trainingJobId: UUID id technical
        roundId: UUID
        roundNumber: Int
      }

      state Running
    }

    slice ScheduleNextTrainingRound {
      reactsTo TrainingRoundCompleted

      automation StartNextRoundWhenGlobalMetricNotReached {
        condition globalAccuracy < minimumAccuracy
        emits StartTrainingRound
      }
    }

    slice CompleteTrainingJob {
      reactsTo TrainingRoundCompleted

      automation CompleteJobWhenRoundBudgetExhausted {
        condition currentRoundNumber >= maxRounds
        emits CompleteTrainingJob
      }

      automation CompleteJobWhenGlobalMetricReached {
        condition globalAccuracy >= minimumAccuracy
        emits CompleteTrainingJob
      }

      command CompleteTrainingJob {
        trainingJobId: UUID id technical
        finalRoundId: UUID
        finalModelVersionId: UUID
        stopReason: String
      }

      event TrainingJobCompleted {
        trainingJobId: UUID id technical
        finalRoundId: UUID
        finalModelVersionId: UUID
        stopReason: String
      }

      state Completed
    }
  }

  aggregate TrainingRound {
    state Running
    state CollectingUpdates
    state Aggregating
    state EvaluatingGlobalModel
    state Completed

    slice StartTrainingRound {
      createsAggregate
      reactsTo NodeReadyForTraining

      automation StartRoundWhenEnoughNodesReady {
        condition readyNodeCount >= 3
        emits StartTrainingRound
      }

      command StartTrainingRound {
        trainingJobId: UUID id technical
        roundId: UUID generated technical
        roundNumber: Int
        readyNodeCount: Int
      }

      event TrainingRoundStarted {
        trainingJobId: UUID id technical
        roundId: UUID
        roundNumber: Int
        readyNodeCount: Int
      }

      state Running
    }

    slice DistributeGlobalModel {
      reactsTo TrainingRoundStarted

      policy RequestDistributeGlobalModel {
        on TrainingRoundStarted
        issue DistributeGlobalModel
      }

      command DistributeGlobalModel {
        trainingJobId: UUID id technical
        roundId: UUID
        modelVersionId: UUID
        targetNodeCount: Int
      }

      event GlobalModelDistributed {
        trainingJobId: UUID id technical
        roundId: UUID
        modelVersionId: UUID
        targetNodeCount: Int
      }

      state CollectingUpdates
    }

    slice SubmitLocalModelUpdate {
      actor EdgeRuntime
      reactsTo GlobalModelDistributed

      command SubmitLocalModelUpdate {
        trainingJobId: UUID id technical
        roundId: UUID
        nodeId: UUID
        trainingDatasetAccessProfileId: UUID
        evaluationDatasetAccessProfileId: UUID
        localModelVersionId: UUID
        updateArtifactId: UUID
        trainingLoss: Decimal
      }

      event LocalModelUpdateSubmitted {
        trainingJobId: UUID id technical
        roundId: UUID
        nodeId: UUID
        trainingDatasetAccessProfileId: UUID
        evaluationDatasetAccessProfileId: UUID
        localModelVersionId: UUID
        updateArtifactId: UUID
        trainingLoss: Decimal
      }
    }

    slice SubmitLocalModelEvaluation {
      reactsTo LocalModelUpdateSubmitted

      command SubmitLocalModelEvaluation {
        trainingJobId: UUID id technical
        roundId: UUID
        nodeId: UUID
        localModelVersionId: UUID
        evaluationDatasetAccessProfileId: UUID
        localAccuracy: Decimal
        localFairnessScore: Decimal
      }

      event LocalModelEvaluationSubmitted {
        trainingJobId: UUID id technical
        roundId: UUID
        nodeId: UUID
        localModelVersionId: UUID
        evaluationDatasetAccessProfileId: UUID
        localAccuracy: Decimal
        localFairnessScore: Decimal
      }
    }

    slice RequestSecureAggregation {
      reactsTo LocalModelEvaluationSubmitted

      automation RequestAggregationWhenEvaluatedUpdatesComplete {
        condition evaluatedUpdateCount >= 3
        emits RequestSecureAggregation
      }

      command RequestSecureAggregation {
        trainingJobId: UUID id technical
        roundId: UUID
        evaluatedUpdateCount: Int
        aggregationProvider: String
      }

      event SecureAggregationRequested {
        trainingJobId: UUID id technical
        roundId: UUID
        evaluatedUpdateCount: Int
        aggregationProvider: String
      }

      state Aggregating
    }

    slice CompleteSecureAggregation {
      command CompleteSecureAggregation {
        trainingJobId: UUID id technical
        roundId: UUID
        requestId: UUID
        aggregatedModelVersionId: UUID
      }

      event GlobalModelUpdated {
        trainingJobId: UUID id technical
        roundId: UUID
        requestId: UUID
        aggregatedModelVersionId: UUID
      }

      state EvaluatingGlobalModel
    }

    slice SubmitGlobalModelEvaluation {
      reactsTo GlobalModelUpdated

      command SubmitGlobalModelEvaluation {
        trainingJobId: UUID id technical
        roundId: UUID
        aggregatedModelVersionId: UUID
        aggregatorEvaluationDatasetAccessProfileId: UUID
        globalAccuracy: Decimal
        globalFairnessScore: Decimal
      }

      event GlobalModelEvaluationSubmitted {
        trainingJobId: UUID id technical
        roundId: UUID
        aggregatedModelVersionId: UUID
        aggregatorEvaluationDatasetAccessProfileId: UUID
        globalAccuracy: Decimal
        globalFairnessScore: Decimal
      }
    }

    slice CompleteTrainingRound {
      reactsTo GlobalModelEvaluationSubmitted

      policy FinishRoundAfterGlobalModelEvaluated {
        on GlobalModelEvaluationSubmitted
        issue CompleteTrainingRound
      }

      command CompleteTrainingRound {
        trainingJobId: UUID id technical
        roundId: UUID
        aggregatedModelVersionId: UUID
        globalAccuracy: Decimal
      }

      event TrainingRoundCompleted {
        trainingJobId: UUID id technical
        roundId: UUID
        aggregatedModelVersionId: UUID
        globalAccuracy: Decimal
      }

      state Completed
    }
  }
}

context ModelLifecycle {
  note "Model lifecycle starts after training has produced a final evaluated candidate."

  aggregate ModelVersion {
    state Candidate
    state Approved
    state Production

    slice RegisterCandidateModel {
      createsAggregate
      reactsTo TrainingJobCompleted

      policy RegisterFinalModelWhenTrainingJobCompleted {
        on TrainingJobCompleted
        issue RegisterCandidateModel
      }

      command RegisterCandidateModel {
        modelVersionId: UUID id technical
        trainingJobId: UUID
        finalRoundId: UUID
        finalGlobalAccuracy: Decimal
      }

      event ModelCandidateRegistered {
        modelVersionId: UUID id technical
        trainingJobId: UUID
        finalRoundId: UUID
        finalGlobalAccuracy: Decimal
      }

      state Candidate
    }

    slice ApproveModel {
      actor GovernanceReviewer
      ui ModelApprovalScreen
      reactsTo ModelCandidateRegistered

      command ApproveModel {
        modelVersionId: UUID id technical
        approvalNote: String?
      }

      event ModelApproved {
        modelVersionId: UUID id technical
        approvalNote: String?
      }

      state Approved
    }

    slice PromoteModelToProduction {
      actor ReleaseManager
      ui ModelReleaseScreen
      reactsTo ModelApproved

      command PromoteModelToProduction {
        modelVersionId: UUID id technical
        releaseChannel: String
      }

      event ModelPromotedToProduction {
        modelVersionId: UUID id technical
        releaseChannel: String
      }

      state Production
    }
  }
}

context RuntimeOperations {
  note "Runtime operations separates heartbeat monitoring, training alerts, and append only audit records."

  aggregate NodeRuntimeHealth {
    state Healthy

    slice RecordRuntimeHeartbeat {
      createsAggregate
      actor EdgeRuntime
      ui RuntimeMonitorScreen

      command RecordRuntimeHeartbeat {
        nodeId: UUID id technical
        federationId: UUID
        cpuLoad: Decimal
        gpuLoad: Decimal
        memoryLoad: Decimal
      }

      event RuntimeHeartbeatRecorded {
        nodeId: UUID id technical
        federationId: UUID
        cpuLoad: Decimal
        gpuLoad: Decimal
        memoryLoad: Decimal
      }

      state Healthy
    }
  }

  aggregate TrainingAlert {
    state Raised

    slice RaiseTrainingAlert {
      createsAggregate
      reactsTo RuntimeHeartbeatRecorded

      automation RaiseAlertOnNodeResourcePressure {
        condition gpuLoad > 95
        emits RaiseTrainingAlert
      }

      command RaiseTrainingAlert {
        alertId: UUID id generated technical
        nodeId: UUID
        trainingJobId: UUID?
        severity: String
        message: String
      }

      event TrainingAlertRaised {
        alertId: UUID id technical
        nodeId: UUID
        trainingJobId: UUID?
        severity: String
        message: String
      }

      state Raised
    }
  }

  aggregate AuditRecord {
    state Appended

    slice AppendAuditTrail {
      createsAggregate
      reactsTo TrainingAlertRaised

      policy AuditCriticalTrainingEvents {
        on TrainingAlertRaised
        issue AppendAuditTrail
      }

      command AppendAuditTrail {
        auditRecordId: UUID id generated technical
        sourceEventName: String
        severity: String
        payloadHash: String
      }

      event AuditTrailAppended {
        auditRecordId: UUID id technical
        sourceEventName: String
        severity: String
        payloadHash: String
      }

      state Appended
    }
  }
}
}
