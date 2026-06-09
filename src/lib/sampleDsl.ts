export const sampleDsl = `domain FederationLearningPlatform {
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
      }

      event OrganizationRegistered {
        organizationId: UUID id technical
        organizationName: String
        organizationType: String
        contactEmail: String
        legalEntityId: String
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
      ui OrganizationDirectory

      readmodel OrganizationDirectory[] {
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
      ui FederationSetupScreen form

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

    slice FederationOverview {
      reactsTo ParticipantJoined

      readmodel FederationOverview[] {
        federationId: UUID id
        federationName: String
        state: String
        activeMemberCount: Int
        pendingInvitationCount: Int
        trustedNodeCount: Int
        activeTrainingJobCount: Int
        subscribe FederationCreated
        subscribe ParticipantInvited
        subscribe ParticipantJoined
        subscribe ParticipantRejected
        subscribe ParticipantInvitationRevoked
        subscribe ParticipantSuspended
        subscribe ParticipantRemoved
        subscribe ComputeNodeTrusted
        subscribe ComputeNodeSuspended
        subscribe TrainingJobSubmitted
      }
    }

    slice InviteParticipant {
      actor FederationOwner
      ui ParticipantInvitationScreen dialog
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
      ui MembershipReviewScreen dialog
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

    slice RejectParticipant {
      actor GovernanceReviewer
      ui MembershipReviewScreen dialog
      reactsTo ParticipantInvited

      command RejectParticipant {
        federationId: UUID id technical
        organizationId: UUID
        rejectionReason: String
      }

      event ParticipantRejected {
        federationId: UUID id technical
        organizationId: UUID
        rejectionReason: String
      }
    }

    slice RevokeParticipantInvitation {
      actor FederationOwner
      ui ParticipantInvitationScreen confirm
      reactsTo ParticipantInvited

      command RevokeParticipantInvitation {
        federationId: UUID id technical
        organizationId: UUID
        revokeReason: String
      }

      event ParticipantInvitationRevoked {
        federationId: UUID id technical
        organizationId: UUID
        revokeReason: String
      }
    }

    slice SuspendParticipant {
      actor GovernanceReviewer
      ui MembershipReviewScreen dialog
      reactsTo ParticipantJoined

      command SuspendParticipant {
        federationId: UUID id technical
        organizationId: UUID
        suspensionReason: String
      }

      event ParticipantSuspended {
        federationId: UUID id technical
        organizationId: UUID
        suspensionReason: String
      }
    }

    slice RemoveParticipant {
      actor GovernanceReviewer
      ui MembershipReviewScreen confirm
      reactsTo ParticipantSuspended

      command RemoveParticipant {
        federationId: UUID id technical
        organizationId: UUID
        removalReason: String
      }

      event ParticipantRemoved {
        federationId: UUID id technical
        organizationId: UUID
        removalReason: String
      }
    }

    slice FederationMembershipDirectory {
      reactsTo ParticipantInvited

      readmodel FederationMembershipDirectory[] {
        federationId: UUID id
        organizationId: UUID id
        organizationName: String
        membershipStatus: String
        invitationNote: String?
        approvalNote: String?
        subscribe ParticipantInvited
        subscribe ParticipantJoined
        subscribe ParticipantRejected
        subscribe ParticipantInvitationRevoked
        subscribe ParticipantSuspended
        subscribe ParticipantRemoved
        subscribe OrganizationRegistered
        subscribe OrganizationActivated
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

    slice ComputeNodeCatalog {
      readmodel ComputeNodeCatalog[] {
        nodeId: UUID id
        organizationId: UUID
        nodeName: String
        nodeType: String
        hardwareProfile: String
        runtimeProfile: String
        confidentialComputeSupported: Boolean
        gpuCount: Int
        cpuCoreCount: Int
        memoryGb: Int
        storageGb: Int
        supportedFrameworks: String[]
        maxConcurrentJobs: Int
        trustLevel: String?
        attestationExpiresAt: DateTime?
        nodeStatus: String
        suspensionReason: String?
        subscribe ComputeNodeRegistered
        subscribe NodeCapabilityUpdated
        subscribe ComputeNodeTrusted
        subscribe ComputeNodeSuspended
      }
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

    slice FeatureSchemaCatalog {
      readmodel FeatureSchemaCatalog[] {
        featureSchemaId: UUID id
        domain: String
        version: Int
        featureCount: Int
        schemaStatus: String
        subscribe FeatureSchemaPublished
      }
    }
  }

  aggregate Dataset {
    state Registered
    state ContractValidated
    state Approved
    state Rejected
    state ApprovalExpired
    state ApprovalRevoked

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
        schemaCompatible: Boolean derived {
          from Dataset.featureSchemaId, ValidateDatasetContract.featureSchemaId
          rule "Validate dataset feature schema compatibility."
        }
        labelCompatible: Boolean derived {
          from Dataset.labelSchema, FeatureSchema
          rule "Validate dataset label compatibility."
        }
        qualityScore: Decimal derived {
          from Dataset.statistics, ValidationProfile
          rule "Score dataset quality against the validation profile."
          example "0.86"
        }
        nonIidScore: Decimal derived {
          from Dataset.statistics, ValidationProfile
          rule "Score dataset distribution skew for training selection."
        }
      }

      state ContractValidated
    }

    slice RejectDatasetForTraining {
      actor ComplianceOfficer
      ui DatasetApprovalScreen
      reactsTo DatasetContractValidated

      command RejectDatasetForTraining {
        datasetId: UUID id technical
        rejectionReason: String
      }

      event DatasetRejectedForTraining {
        datasetId: UUID id technical
        rejectionReason: String
      }

      state Rejected
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

    slice ExpireDatasetTrainingApproval {
      reactsTo DatasetApprovedForTraining

      automation ExpireDatasetApprovalWhenPastExpiry {
        condition expiresAt < now
        emits ExpireDatasetTrainingApproval
      }

      command ExpireDatasetTrainingApproval {
        datasetId: UUID id technical
        expiredAt: DateTime
      }

      event DatasetTrainingApprovalExpired {
        datasetId: UUID id technical
        expiredAt: DateTime
      }

      state ApprovalExpired
    }

    slice RevokeDatasetTrainingApproval {
      actor ComplianceOfficer
      ui DatasetApprovalScreen
      reactsTo DatasetApprovedForTraining

      command RevokeDatasetTrainingApproval {
        datasetId: UUID id technical
        revokeReason: String
      }

      event DatasetTrainingApprovalRevoked {
        datasetId: UUID id technical
        revokeReason: String
      }

      state ApprovalRevoked
    }

    slice DatasetCapability {
      readmodel DatasetCapability[] {
        datasetId: UUID id
        organizationId: UUID
        featureSchemaId: UUID
        datasetUsage: String
        sampleCount: Int
        qualityScore: Decimal
        approvalStatus: String
        expiresAt: DateTime?
        approved: Boolean
        subscribe DatasetRegistered
        subscribe DatasetContractValidated
        subscribe DatasetRejectedForTraining
        subscribe DatasetApprovedForTraining
        subscribe DatasetTrainingApprovalExpired
        subscribe DatasetTrainingApprovalRevoked
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
      readmodel DatasetRuntimeAccessCatalog[] {
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
      readmodel TrainingEvaluationDatasetCatalog[] {
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

  aggregate TrainingRunConfiguration {
    state Draft
    state Validated
    state Locked

    slice DefineTrainingRunConfiguration {
      createsAggregate
      actor MLOpsEngineer
      ui TrainingRunConfigurationScreen
      reactsTo TrainingEvaluationDatasetsDeclared

      command DefineTrainingRunConfiguration {
        trainingRunConfigurationId: UUID id generated technical
        federationId: UUID
        featureSchemaId: UUID
        strategyName: String
        aggregationAlgorithm: String
        maxRounds: Int
        minimumNodesPerRound: Int
        roundTimeoutSeconds: Int
        nodeResponseTimeoutSeconds: Int
        localEpochs: Int
        batchSize: Int
        learningRate: Decimal
        optimizer: String
        lossFunction: String
        gradientClippingNorm: Decimal?
        secureAggregationRequired: Boolean
        differentialPrivacyEnabled: Boolean
        dpNoiseMultiplier: Decimal?
        dpClipNorm: Decimal?
        minimumAccuracy: Decimal
        minimumFairnessScore: Decimal?
        failureToleranceRatio: Decimal
      }

      event TrainingRunConfigurationDefined {
        trainingRunConfigurationId: UUID id technical
        federationId: UUID
        featureSchemaId: UUID
        strategyName: String
        aggregationAlgorithm: String
        maxRounds: Int
        minimumNodesPerRound: Int
        roundTimeoutSeconds: Int
        nodeResponseTimeoutSeconds: Int
        localEpochs: Int
        batchSize: Int
        learningRate: Decimal
        optimizer: String
        lossFunction: String
        gradientClippingNorm: Decimal?
        secureAggregationRequired: Boolean
        differentialPrivacyEnabled: Boolean
        dpNoiseMultiplier: Decimal?
        dpClipNorm: Decimal?
        minimumAccuracy: Decimal
        minimumFairnessScore: Decimal?
        failureToleranceRatio: Decimal
      }

      state Draft
    }

    slice ValidateTrainingRunConfiguration {
      reactsTo TrainingRunConfigurationDefined

      automation ValidateTrainingRunConfigurationAutomatically {
        condition maxRounds > 0
        emits ValidateTrainingRunConfiguration
      }

      command ValidateTrainingRunConfiguration {
        trainingRunConfigurationId: UUID id technical
        validationProfile: String
      }

      event TrainingRunConfigurationValidated {
        trainingRunConfigurationId: UUID id technical
        valid: Boolean
        validationReportId: UUID
        effectiveMinimumNodesPerRound: Int derived {
          from TrainingRunConfiguration.minimumNodesPerRound, TrainingRunConfiguration.failureToleranceRatio
          rule "Derive the effective node quorum from the selected strategy and failure tolerance."
        }
      }

      state Validated
    }

    slice LockTrainingRunConfiguration {
      reactsTo TrainingJobSubmitted

      policy LockConfigurationWhenTrainingSubmitted {
        on TrainingJobSubmitted
        issue LockTrainingRunConfiguration
      }

      command LockTrainingRunConfiguration {
        trainingRunConfigurationId: UUID id technical
        trainingJobId: UUID
        lockedBy: String
      }

      event TrainingRunConfigurationLocked {
        trainingRunConfigurationId: UUID id technical
        trainingJobId: UUID
        lockedBy: String
      }

      state Locked
    }

    slice TrainingRunConfigurationCatalog {
      readmodel TrainingRunConfigurationCatalog[] {
        trainingRunConfigurationId: UUID id
        federationId: UUID
        featureSchemaId: UUID
        strategyName: String
        aggregationAlgorithm: String
        maxRounds: Int
        minimumNodesPerRound: Int
        secureAggregationRequired: Boolean
        differentialPrivacyEnabled: Boolean
        minimumAccuracy: Decimal
        state: String
        subscribe TrainingRunConfigurationDefined
        subscribe TrainingRunConfigurationValidated
        subscribe TrainingRunConfigurationLocked
      }
    }
  }

  aggregate TrainingJob {
    state Draft
    state StrategyConfigured
    state Submitted
    state RecruitingNodes
    state Running
    state Paused
    state Canceled
    state Completed

    slice CreateTrainingJob {
      createsAggregate
      actor ResearchLead
      ui TrainingJobCreationScreen
      reactsTo TrainingRunConfigurationValidated

      command CreateTrainingJob {
        trainingJobId: UUID id generated technical
        federationId: UUID
        featureSchemaId: UUID
        trainingRunConfigurationId: UUID
        aggregatorDatasetBundleId: UUID
        aggregatorTrainingDatasetId: UUID
        aggregatorTrainingDatasetAccessProfileId: UUID
        aggregatorEvaluationDatasetId: UUID
        aggregatorEvaluationDatasetAccessProfileId: UUID
        objective: String
        targetMetric: String
      }

      event TrainingJobCreated {
        trainingJobId: UUID id technical
        federationId: UUID
        featureSchemaId: UUID
        trainingRunConfigurationId: UUID
        aggregatorDatasetBundleId: UUID
        aggregatorTrainingDatasetId: UUID
        aggregatorTrainingDatasetAccessProfileId: UUID
        aggregatorEvaluationDatasetId: UUID
        aggregatorEvaluationDatasetAccessProfileId: UUID
        objective: String
        targetMetric: String
      }

      state Draft
    }

    slice ConfigureTrainingStrategy {
      actor MLOpsEngineer
      ui TrainingStrategyScreen
      reactsTo TrainingJobCreated

      command ConfigureTrainingStrategy {
        trainingJobId: UUID id technical
        trainingRunConfigurationId: UUID
        strategyName: String
        maxRounds: Int derived {
          from TrainingRunConfiguration.maxRounds
          rule "Copy the locked training run configuration round budget onto the training job strategy."
        }
        minimumNodesPerRound: Int derived {
          from TrainingRunConfiguration.minimumNodesPerRound
          rule "Copy the configured minimum node quorum onto the training job strategy."
        }
        secureAggregationRequired: Boolean derived {
          from TrainingRunConfiguration.secureAggregationRequired
          rule "Copy the secure aggregation requirement onto the training job strategy."
        }
      }

      event TrainingStrategyConfigured {
        trainingJobId: UUID id technical
        trainingRunConfigurationId: UUID
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
        trainingRunConfigurationId: UUID
      }

      event TrainingJobSubmitted {
        trainingJobId: UUID id technical
        trainingRunConfigurationId: UUID
        minimumNodesPerRound: Int derived {
          from TrainingJob.trainingStrategy
          rule "Derive the minimum selected nodes from the configured training strategy."
        }
        maxRounds: Int derived {
          from TrainingRunConfiguration.maxRounds
          rule "Snapshot the configured round budget when the training job is submitted."
        }
        minimumAccuracy: Decimal derived {
          from TrainingRunConfiguration.minimumAccuracy
          rule "Snapshot the configured target accuracy when the training job is submitted."
        }
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
        trainingRunConfigurationId: UUID
        nodeId: UUID
        participantDatasetBundleId: UUID
        trainingDatasetAccessProfileId: UUID
        evaluationDatasetAccessProfileId: UUID
      }

      event NodeParticipationRequested {
        trainingJobId: UUID id technical
        trainingRunConfigurationId: UUID
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
        trainingRunConfigurationId: UUID
        nodeId: UUID
        participantDatasetBundleId: UUID
        availableGpuCount: Int
      }

      event NodeReadyForTraining {
        trainingJobId: UUID id technical
        trainingRunConfigurationId: UUID
        nodeId: UUID
        participantDatasetBundleId: UUID
        availableGpuCount: Int
      }
    }

    slice TrainingParticipantEligibility {
      reactsTo TrainingJobSubmitted

      readmodel TrainingParticipantEligibility[] {
        trainingJobId: UUID id
        federationId: UUID
        organizationId: UUID
        nodeId: UUID
        participantDatasetBundleId: UUID
        trainingDatasetAccessProfileId: UUID
        evaluationDatasetAccessProfileId: UUID
        trustedNode: Boolean
        runtimeReadable: Boolean
        nodeHealthy: Boolean
        eligible: Boolean
        eligibilityReason: String?
        subscribe TrainingJobSubmitted
        subscribe ParticipantJoined
        subscribe ParticipantSuspended
        subscribe ParticipantRemoved
        subscribe ComputeNodeTrusted
        subscribe ComputeNodeSuspended
        subscribe TrainingEvaluationDatasetsDeclared
        subscribe RuntimeDatasetAccessValidated
        subscribe RuntimeHeartbeatRecorded
        subscribe NodeParticipationRequested
        subscribe NodeReadyForTraining
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
        trainingRunConfigurationId: UUID
        roundId: UUID
        roundNumber: Int
      }

      event TrainingJobRunning {
        trainingJobId: UUID id technical
        trainingRunConfigurationId: UUID
        roundId: UUID
        roundNumber: Int
      }

      state Running
    }

    slice PauseTrainingJob {
      actor MLOpsEngineer
      ui TrainingOperationsScreen
      reactsTo TrainingJobRunning

      command PauseTrainingJob {
        trainingJobId: UUID id technical
        trainingRunConfigurationId: UUID
        pauseReason: String
        requestedBy: String
      }

      event TrainingJobPaused {
        trainingJobId: UUID id technical
        trainingRunConfigurationId: UUID
        pauseReason: String
        requestedBy: String
      }

      state Paused
    }

    slice ResumeTrainingJob {
      actor MLOpsEngineer
      ui TrainingOperationsScreen
      reactsTo TrainingJobPaused

      command ResumeTrainingJob {
        trainingJobId: UUID id technical
        trainingRunConfigurationId: UUID
        resumeReason: String?
        requestedBy: String
      }

      event TrainingJobResumed {
        trainingJobId: UUID id technical
        trainingRunConfigurationId: UUID
        resumeReason: String?
        requestedBy: String
      }

      state Running
    }

    slice CancelTrainingJob {
      actor MLOpsEngineer
      ui TrainingOperationsScreen

      command CancelTrainingJob {
        trainingJobId: UUID id technical
        trainingRunConfigurationId: UUID
        cancelReason: String?
      }

      event TrainingJobCanceled {
        trainingJobId: UUID id technical
        trainingRunConfigurationId: UUID
        cancelReason: String?
      }

      state Canceled
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
        trainingRunConfigurationId: UUID
        finalRoundId: UUID
        finalModelVersionId: UUID
        stopReason: String
      }

      event TrainingJobCompleted {
        trainingJobId: UUID id technical
        trainingRunConfigurationId: UUID
        finalRoundId: UUID
        finalModelVersionId: UUID
        stopReason: String
      }

      state Completed
    }

    slice TrainingJobDashboard {
      readmodel TrainingJobDashboard[] {
        trainingJobId: UUID id
        federationId: UUID
        trainingRunConfigurationId: UUID
        featureSchemaId: UUID
        objective: String
        targetMetric: String
        state: String
        currentRoundNumber: Int
        readyNodeCount: Int
        minimumNodesPerRound: Int
        maxRounds: Int
        globalAccuracy: Decimal?
        finalModelVersionId: UUID?
        stopReason: String?
        subscribe TrainingJobCreated
        subscribe TrainingStrategyConfigured
        subscribe TrainingJobSubmitted
        subscribe NodeParticipationRequested
        subscribe NodeReadyForTraining
        subscribe TrainingJobRunning
        subscribe TrainingJobPaused
        subscribe TrainingJobResumed
        subscribe TrainingJobCanceled
        subscribe TrainingRoundStarted
        subscribe TrainingRoundCompleted
        subscribe TrainingJobCompleted
      }
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
        trainingRunConfigurationId: UUID
        roundId: UUID generated technical
        roundNumber: Int
        readyNodeCount: Int
      }

      event TrainingRoundStarted {
        trainingJobId: UUID id technical
        trainingRunConfigurationId: UUID
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
        trainingRunConfigurationId: UUID
        roundId: UUID
        modelVersionId: UUID
        targetNodeCount: Int
      }

      event GlobalModelDistributed {
        trainingJobId: UUID id technical
        trainingRunConfigurationId: UUID
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
        trainingRunConfigurationId: UUID
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
        trainingRunConfigurationId: UUID
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
        trainingRunConfigurationId: UUID
        roundId: UUID
        nodeId: UUID
        localModelVersionId: UUID
        evaluationDatasetAccessProfileId: UUID
        localAccuracy: Decimal
        localFairnessScore: Decimal
      }

      event LocalModelEvaluationSubmitted {
        trainingJobId: UUID id technical
        trainingRunConfigurationId: UUID
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
        trainingRunConfigurationId: UUID
        roundId: UUID
        evaluatedUpdateCount: Int
        aggregationProvider: String
      }

      event SecureAggregationRequested {
        trainingJobId: UUID id technical
        trainingRunConfigurationId: UUID
        roundId: UUID
        evaluatedUpdateCount: Int
        aggregationProvider: String
      }

      state Aggregating
    }

    slice CompleteSecureAggregation {
      command CompleteSecureAggregation {
        trainingJobId: UUID id technical
        trainingRunConfigurationId: UUID
        roundId: UUID
        requestId: UUID
        aggregatedModelVersionId: UUID
      }

      event GlobalModelUpdated {
        trainingJobId: UUID id technical
        trainingRunConfigurationId: UUID
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
        trainingRunConfigurationId: UUID
        roundId: UUID
        aggregatedModelVersionId: UUID
        aggregatorEvaluationDatasetAccessProfileId: UUID
        globalAccuracy: Decimal
        globalFairnessScore: Decimal
      }

      event GlobalModelEvaluationSubmitted {
        trainingJobId: UUID id technical
        trainingRunConfigurationId: UUID
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
        trainingRunConfigurationId: UUID
        roundId: UUID
        aggregatedModelVersionId: UUID
        globalAccuracy: Decimal
      }

      event TrainingRoundCompleted {
        trainingJobId: UUID id technical
        trainingRunConfigurationId: UUID
        roundId: UUID
        aggregatedModelVersionId: UUID
        globalAccuracy: Decimal
      }

      state Completed
    }

    slice TrainingRoundProgress {
      readmodel TrainingRoundProgress[] {
        trainingJobId: UUID id
        trainingRunConfigurationId: UUID
        roundId: UUID id
        roundNumber: Int
        state: String
        readyNodeCount: Int
        targetNodeCount: Int
        submittedUpdateCount: Int
        evaluatedUpdateCount: Int
        aggregationProvider: String?
        aggregatedModelVersionId: UUID?
        globalAccuracy: Decimal?
        globalFairnessScore: Decimal?
        subscribe TrainingRoundStarted
        subscribe GlobalModelDistributed
        subscribe LocalModelUpdateSubmitted
        subscribe LocalModelEvaluationSubmitted
        subscribe SecureAggregationRequested
        subscribe GlobalModelUpdated
        subscribe GlobalModelEvaluationSubmitted
        subscribe TrainingRoundCompleted
      }
    }
  }
}

context ModelLifecycle {
  note "Model lifecycle starts after training has produced a final evaluated candidate."

  aggregate ModelVersion {
    state Candidate
    state Approved
    state Production
    state RolledBack
    state Retired

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
        modelArtifactId: UUID
        modelHash: String
        evaluationReportId: UUID
        lineageRef: String
        finalGlobalAccuracy: Decimal
      }

      event ModelCandidateRegistered {
        modelVersionId: UUID id technical
        trainingJobId: UUID
        finalRoundId: UUID
        modelArtifactId: UUID
        modelHash: String
        evaluationReportId: UUID
        lineageRef: String
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
        deploymentTarget: String
      }

      event ModelPromotedToProduction {
        modelVersionId: UUID id technical
        releaseChannel: String
        deploymentTarget: String
      }

      state Production
    }

    slice RollbackModelVersion {
      actor ReleaseManager
      ui ModelReleaseScreen
      reactsTo ModelPromotedToProduction

      command RollbackModelVersion {
        modelVersionId: UUID id technical
        previousModelVersionId: UUID
        rollbackReason: String
        requestedBy: String
      }

      event ModelVersionRolledBack {
        modelVersionId: UUID id technical
        previousModelVersionId: UUID
        rollbackReason: String
        requestedBy: String
      }

      state RolledBack
    }

    slice RetireModelVersion {
      actor ReleaseManager
      ui ModelReleaseScreen
      reactsTo ModelPromotedToProduction

      command RetireModelVersion {
        modelVersionId: UUID id technical
        retirementReason: String
        requestedBy: String
      }

      event ModelVersionRetired {
        modelVersionId: UUID id technical
        retirementReason: String
        requestedBy: String
      }

      state Retired
    }

    slice ModelVersionCatalog {
      readmodel ModelVersionCatalog[] {
        modelVersionId: UUID id
        trainingJobId: UUID
        finalRoundId: UUID
        modelArtifactId: UUID
        modelHash: String
        evaluationReportId: UUID
        lineageRef: String
        finalGlobalAccuracy: Decimal
        state: String
        releaseChannel: String?
        deploymentTarget: String?
        previousModelVersionId: UUID?
        subscribe ModelCandidateRegistered
        subscribe ModelApproved
        subscribe ModelPromotedToProduction
        subscribe ModelVersionRolledBack
        subscribe ModelVersionRetired
      }
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

    slice RuntimeHealthDashboard {
      readmodel RuntimeHealthDashboard[] {
        nodeId: UUID id
        federationId: UUID
        cpuLoad: Decimal
        gpuLoad: Decimal
        memoryLoad: Decimal
        healthStatus: String
        lastHeartbeatAt: DateTime
        subscribe RuntimeHeartbeatRecorded
        subscribe TrainingAlertRaised
      }
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

    slice TrainingAlertCatalog {
      readmodel TrainingAlertCatalog[] {
        alertId: UUID id
        nodeId: UUID
        trainingJobId: UUID?
        severity: String
        message: String
        state: String
        subscribe TrainingAlertRaised
      }
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

      policy AuditParticipantJoined {
        on ParticipantJoined
        issue AppendAuditTrail
      }

      policy AuditParticipantSuspended {
        on ParticipantSuspended
        issue AppendAuditTrail
      }

      policy AuditDatasetApproval {
        on DatasetApprovedForTraining
        issue AppendAuditTrail
      }

      policy AuditDatasetApprovalRevoked {
        on DatasetTrainingApprovalRevoked
        issue AppendAuditTrail
      }

      policy AuditTrainingJobSubmitted {
        on TrainingJobSubmitted
        issue AppendAuditTrail
      }

      policy AuditModelPromotedToProduction {
        on ModelPromotedToProduction
        issue AppendAuditTrail
      }

      policy AuditNodeTrustChanged {
        on ComputeNodeTrusted
        issue AppendAuditTrail
      }

      command AppendAuditTrail {
        auditRecordId: UUID id generated technical
        sourceEventName: String
        sourceEntityId: UUID?
        severity: String
        payloadHash: String
      }

      event AuditTrailAppended {
        auditRecordId: UUID id technical
        sourceEventName: String
        sourceEntityId: UUID?
        severity: String
        payloadHash: String
      }

      state Appended
    }

    slice AuditRecordLog {
      readmodel AuditRecordLog[] {
        auditRecordId: UUID id
        sourceEventName: String
        sourceEntityId: UUID?
        severity: String
        payloadHash: String
        subscribe AuditTrailAppended
      }
    }
  }
}
}
`;
