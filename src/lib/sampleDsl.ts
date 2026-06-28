export const sampleDsl = `domain FederationLearningPlatform {
context FederationManagement {
  
  note "Federation management owns organizations, federations, and trusted compute nodes."
    slice RegisterOrganization {
      startsLifecycle
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

    }

    slice OrganizationDirectory {
      ui OrganizationDirectory

      readmodel OrganizationDirectory[] {
        organizationId: UUID id
        organizationName: String
        organizationType: String
        state: Organization.State
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


  concept Organization {

    state Registered

    state IdentityVerified

    state Active

    state Deactivated

    state Registered

    state IdentityVerified

    state Active

    state Deactivated


    slice RegisterOrganization

    slice VerifyOrganizationIdentity

    slice ActivateOrganization

    slice DeactivateOrganization

    slice OrganizationDirectory

  }
    slice CreateFederation {
      startsLifecycle
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

    }

    slice FederationOverview {
      reactsTo ParticipantJoined

      readmodel FederationOverview[] {
        federationId: UUID id
        federationName: String
        state: Federation.State
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


  concept Federation {

    state Draft

    state Active

    state Suspended

    state Draft

    state Active


    slice CreateFederation

    slice FederationOverview

    slice InviteParticipant

    slice ApproveParticipant

    slice RejectParticipant

    slice RevokeParticipantInvitation

    slice SuspendParticipant

    slice RemoveParticipant

    slice FederationMembershipDirectory

  }
    slice RegisterComputeNode {
      startsLifecycle
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


  concept ComputeNode {

    state Registered

    state CapabilityDeclared

    state Trusted

    state Suspended

    state Registered

    state CapabilityDeclared

    state Trusted

    state Suspended


    slice RegisterComputeNode

    slice UpdateNodeCapability

    slice TrustComputeNode

    slice SuspendComputeNode

    slice ComputeNodeCatalog

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
    slice DefineFeatureSchema {
      startsLifecycle
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


  concept FeatureSchema {

    state Published

    state Published


    slice DefineFeatureSchema

    slice FeatureSchemaCatalog

  }
    slice RegisterDataset {
      startsLifecycle
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


  concept Dataset {

    state Registered

    state ContractValidated

    state Approved

    state Rejected

    state ApprovalExpired

    state ApprovalRevoked

    state Registered

    state ContractValidated

    state Rejected

    state Approved

    state ApprovalExpired

    state ApprovalRevoked


    slice RegisterDataset

    slice ValidateDatasetContract

    slice RejectDatasetForTraining

    slice ApproveDatasetForTraining

    slice ExpireDatasetTrainingApproval

    slice RevokeDatasetTrainingApproval

    slice DatasetCapability

  }
    slice ConfigureDatasetAccessProfile {
      startsLifecycle
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


  concept DatasetAccessProfile {

    state Configured

    state ValidationRequested

    state Validated

    state Configured

    state ValidationRequested

    state Validated


    slice ConfigureDatasetAccessProfile

    slice RequestRuntimeDatasetAccessValidation

    slice CompleteRuntimeDatasetAccessValidation

    slice DatasetRuntimeAccessCatalog

  }
    slice DeclareTrainingEvaluationDatasets {
      startsLifecycle
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


  concept TrainingEvaluationDatasetBundle {

    state Declared

    state Declared


    slice DeclareTrainingEvaluationDatasets

    slice TrainingEvaluationDatasetCatalog

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
    slice DefineTrainingRunConfiguration {
      startsLifecycle
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
        state: TrainingRunConfiguration.State
        subscribe TrainingRunConfigurationDefined
        subscribe TrainingRunConfigurationValidated
        subscribe TrainingRunConfigurationLocked
      }
    }


  concept TrainingRunConfiguration {

    state Draft

    state Validated

    state Locked

    state Draft

    state Validated

    state Locked


    slice DefineTrainingRunConfiguration

    slice ValidateTrainingRunConfiguration

    slice LockTrainingRunConfiguration

    slice TrainingRunConfigurationCatalog

  }
    slice CreateTrainingJob {
      startsLifecycle
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

    }

    slice TrainingJobDashboard {
      readmodel TrainingJobDashboard[] {
        trainingJobId: UUID id
        federationId: UUID
        trainingRunConfigurationId: UUID
        featureSchemaId: UUID
        objective: String
        targetMetric: String
        state: TrainingJob.State
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


  concept TrainingJob {

    state Draft

    state StrategyConfigured

    state Submitted

    state RecruitingNodes

    state Running

    state Paused

    state Canceled

    state Completed

    state Draft

    state StrategyConfigured

    state Submitted

    state RecruitingNodes

    state Running

    state Paused

    state Running

    state Canceled

    state Completed


    slice CreateTrainingJob

    slice ConfigureTrainingStrategy

    slice SubmitTrainingJob

    slice RequestNodeParticipation

    slice AcceptNodeParticipation

    slice TrainingParticipantEligibility

    slice TrackTrainingJobRunning

    slice PauseTrainingJob

    slice ResumeTrainingJob

    slice CancelTrainingJob

    slice ScheduleNextTrainingRound

    slice CompleteTrainingJob

    slice TrainingJobDashboard

  }
    slice StartTrainingRound {
      startsLifecycle
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

    }

    slice TrainingRoundProgress {
      readmodel TrainingRoundProgress[] {
        trainingJobId: UUID id
        trainingRunConfigurationId: UUID
        roundId: UUID id
        roundNumber: Int
        state: TrainingRound.State
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


  concept TrainingRound {

    state Running

    state CollectingUpdates

    state Aggregating

    state EvaluatingGlobalModel

    state Completed

    state Running

    state CollectingUpdates

    state Aggregating

    state EvaluatingGlobalModel

    state Completed


    slice StartTrainingRound

    slice DistributeGlobalModel

    slice SubmitLocalModelUpdate

    slice SubmitLocalModelEvaluation

    slice RequestSecureAggregation

    slice CompleteSecureAggregation

    slice SubmitGlobalModelEvaluation

    slice CompleteTrainingRound

    slice TrainingRoundProgress

  }
}

context ModelLifecycle {
  note "Model lifecycle starts after training has produced a final evaluated candidate."
    slice RegisterCandidateModel {
      startsLifecycle
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
        state: ModelVersion.State
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


  concept ModelVersion {

    state Candidate

    state Approved

    state Production

    state RolledBack

    state Retired

    state Candidate

    state Approved

    state Production

    state RolledBack

    state Retired


    slice RegisterCandidateModel

    slice ApproveModel

    slice PromoteModelToProduction

    slice RollbackModelVersion

    slice RetireModelVersion

    slice ModelVersionCatalog

  }
}

context RuntimeOperations {
  note "Runtime operations separates heartbeat monitoring, training alerts, and append only audit records."
    slice RecordRuntimeHeartbeat {
      startsLifecycle
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


  concept NodeRuntimeHealth {

    state Healthy

    state Healthy


    slice RecordRuntimeHeartbeat

    slice RuntimeHealthDashboard

  }
    slice RaiseTrainingAlert {
      startsLifecycle
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

    }

    slice TrainingAlertCatalog {
      readmodel TrainingAlertCatalog[] {
        alertId: UUID id
        nodeId: UUID
        trainingJobId: UUID?
        severity: String
        message: String
        state: TrainingAlert.State
        subscribe TrainingAlertRaised
      }
    }


  concept TrainingAlert {

    state Raised

    state Raised


    slice RaiseTrainingAlert

    slice TrainingAlertCatalog

  }
    slice AppendAuditTrail {
      startsLifecycle
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


  concept AuditRecord {

    state Appended

    state Appended


    slice AppendAuditTrail

    slice AuditRecordLog

  }
}
}
`;
