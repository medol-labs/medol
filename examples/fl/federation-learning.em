context FederationLearningPlatform {
  note "Federation learning is modeled as a distributed collaborative state machine."
  decision "Keep secure aggregation as an integration boundary so third-party cryptographic services can evolve independently."
  risk "Dataset contracts and label semantics are the highest-risk source of silent model quality failure."

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
  }

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

      specification "Register organization with legal identity" {
        when RegisterOrganization
        then OrganizationRegistered
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

      specification "Create federation with valid governance policy" {
        when CreateFederation
        then FederationCreated
      }

      specification "Reject federation below minimum participant threshold" {
        when CreateFederation {
          minimumParticipantCount = 1
        }
        then FederationCreated
      }
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

      specification "Invite only active verified organizations" {
        given OrganizationActivated
        when InviteParticipant
        then ParticipantInvited
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

      projection FederationMembership {
        federationId: UUID id
        federationName: String
        organizationId: UUID
        state: String
        subscribe ParticipantInvited
        subscribe ParticipantJoined
      }
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
        subscribe OrganizationActivated
        subscribe OrganizationDeactivated
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

    slice NodeInventory {
      reactsTo ComputeNodeTrusted

      projection ComputeNodeInventory {
        nodeId: UUID id
        organizationId: UUID
        nodeName: String
        nodeType: String
        trustLevel: String
        gpuCount: Int
        cpuCoreCount: Int
        memoryGb: Int
        maxConcurrentJobs: Int
        state: String
        subscribe ComputeNodeRegistered
        subscribe NodeCapabilityUpdated
        subscribe ComputeNodeTrusted
        subscribe ComputeNodeSuspended
        subscribe RuntimeHeartbeatRecorded
      }
    }
  }

  aggregate DatasetGovernance {
    state DraftSchema
    state PublishedSchema
    state DatasetRegistered
    state DatasetApproved

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

      state PublishedSchema
    }

    slice RegisterDataset {
      actor DataOwner
      ui DatasetRegistrationScreen
      reactsTo FeatureSchemaPublished

      command RegisterDataset {
        datasetId: UUID id generated technical
        organizationId: UUID
        featureSchemaId: UUID
        datasetType: String
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
        sampleCount: Int
        sensitivityLevel: String
        containsPII: Boolean
        region: String
        usagePolicyId: UUID
      }

      state DatasetRegistered
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

      hotspot "Validation must catch feature unit mismatches and inverted labels before training."
    }

    slice ApproveDatasetForTraining {
      actor ComplianceOfficer
      ui DatasetApprovalScreen
      reactsTo DatasetContractValidated

      command ApproveDatasetForTraining {
        datasetId: UUID id technical
        allowedTrainingPurpose: String
        expiresAt: DateTime
      }

      event DatasetApprovedForTraining {
        datasetId: UUID id technical
        allowedTrainingPurpose: String
        expiresAt: DateTime
      }

      state DatasetApproved

      projection DatasetCapability {
        datasetId: UUID id
        organizationId: UUID
        featureSchemaId: UUID
        sampleCount: Int
        sensitivityLevel: String
        region: String
        approved: Boolean
        subscribe DatasetRegistered
        subscribe DatasetContractValidated
        subscribe DatasetApprovedForTraining
      }
    }
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
      reactsTo DatasetApprovedForTraining

      command CreateTrainingJob {
        trainingJobId: UUID id generated technical
        federationId: UUID
        featureSchemaId: UUID
        objective: String
        targetMetric: String
        minimumAccuracy: Decimal
      }

      event TrainingJobCreated {
        trainingJobId: UUID id technical
        federationId: UUID
        featureSchemaId: UUID
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
        differentialPrivacyEnabled: Boolean
        secureAggregationRequired: Boolean
      }

      event TrainingStrategyConfigured {
        trainingJobId: UUID id technical
        strategyName: String
        maxRounds: Int
        minimumNodesPerRound: Int
        differentialPrivacyEnabled: Boolean
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

      projection TrainingJobBoard {
        trainingJobId: UUID id
        federationId: UUID
        state: String
        currentRoundNumber: Int
        readyNodeCount: Int
        subscribe TrainingJobCreated
        subscribe TrainingStrategyConfigured
        subscribe TrainingJobSubmitted
        subscribe NodeReadyForTraining
        subscribe TrainingRoundStarted
        subscribe TrainingJobRunning
        subscribe TrainingJobCompleted
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
        nodeId: UUID
        datasetId: UUID
        participationDeadline: DateTime
      }

      event NodeParticipationRequested {
        trainingJobId: UUID id technical
        nodeId: UUID
        datasetId: UUID
        participationDeadline: DateTime
      }

      state RecruitingNodes
      projection TrainingJobNodeBoard {
        trainingJobId: UUID
        nodeId: UUID id technical
        datasetId: UUID
        subscribe NodeParticipationRequested
        subscribe NodeReadyForTraining
      }
    }

    slice AcceptNodeParticipation {
      actor NodeOperator
      ui NodeParticipationScreen
      reactsTo NodeParticipationRequested

      command AcceptNodeParticipation {
        trainingJobId: UUID id technical
        nodeId: UUID
        datasetId: UUID
        availableGpuCount: Int
        localEpochLimit: Int
      }

      event NodeReadyForTraining {
        trainingJobId: UUID id technical
        nodeId: UUID
        datasetId: UUID
        availableGpuCount: Int
        localEpochLimit: Int
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

      automation StartNextRoundWhileRoundBudgetRemains {
        condition currentRoundNumber < maxRounds
        emits StartTrainingRound
      }
    }

    slice CompleteTrainingJob {
      reactsTo TrainingRoundCompleted

      automation CompleteJobWhenRoundBudgetExhausted {
        condition currentRoundNumber >= maxRounds
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
      ui EdgeRuntimeConsole
      reactsTo GlobalModelDistributed

      command SubmitLocalModelUpdate {
        trainingJobId: UUID id technical
        roundId: UUID
        nodeId: UUID
        updateArtifactId: UUID
        sampleCount: Int
        trainingLoss: Decimal
      }

      event LocalModelUpdateSubmitted {
        trainingJobId: UUID id technical
        roundId: UUID
        nodeId: UUID
        updateArtifactId: UUID
        sampleCount: Int
        trainingLoss: Decimal
      }
    }

    slice RequestSecureAggregation {
      reactsTo LocalModelUpdateSubmitted

      automation RequestAggregationWhenUpdatesComplete {
        condition submittedUpdateCount >= 3
        emits RequestSecureAggregation
      }

      command RequestSecureAggregation {
        trainingJobId: UUID id technical
        roundId: UUID
        submittedUpdateCount: Int
        aggregationProvider: String
      }

      event SecureAggregationRequested {
        trainingJobId: UUID id technical
        roundId: UUID
        submittedUpdateCount: Int
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
    }

    slice CompleteTrainingRound {
      reactsTo GlobalModelUpdated

      policy FinishRoundAfterGlobalModelUpdated {
        on GlobalModelUpdated
        issue CompleteTrainingRound
      }

      command CompleteTrainingRound {
        trainingJobId: UUID id technical
        roundId: UUID
        aggregatedModelVersionId: UUID
        validationMetric: Decimal
      }

      event TrainingRoundCompleted {
        trainingJobId: UUID id technical
        roundId: UUID
        aggregatedModelVersionId: UUID
        validationMetric: Decimal
      }

      state Completed

      projection RoundProgress {
        trainingJobId: UUID id
        roundId: UUID
        roundNumber: Int
        submittedUpdateCount: Int
        aggregationState: String
        validationMetric: Decimal
        subscribe TrainingRoundStarted
        subscribe LocalModelUpdateSubmitted
        subscribe SecureAggregationRequested
        subscribe GlobalModelUpdated
        subscribe TrainingRoundCompleted
      }
    }
  }

  aggregate ModelRegistry {
    state Candidate
    state Approved
    state Production

    slice EvaluateModel {
      createsAggregate
      actor ModelEvaluator
      ui ModelEvaluationScreen
      reactsTo TrainingRoundCompleted

      command EvaluateModel {
        modelVersionId: UUID id technical
        trainingJobId: UUID
        roundId: UUID
        evaluationDatasetId: UUID
        fairnessProfileId: UUID
      }

      event ModelEvaluationCompleted {
        modelVersionId: UUID id technical
        trainingJobId: UUID
        roundId: UUID
        accuracy: Decimal
        fairnessScore: Decimal
        privacyBudgetSpent: Decimal
      }

      state Candidate
    }

    slice ApproveModel {
      actor GovernanceReviewer
      ui ModelApprovalScreen
      reactsTo ModelEvaluationCompleted

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

      projection ModelCatalog {
        modelVersionId: UUID id
        trainingJobId: UUID
        state: String
        accuracy: Decimal
        fairnessScore: Decimal
        releaseChannel: String
        subscribe ModelEvaluationCompleted
        subscribe ModelApproved
        subscribe ModelPromotedToProduction
      }
    }
  }

  aggregate MonitoringAudit {
    state Healthy
    state Degraded
    state Investigating

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

      projection NodeRuntimeState {
        nodeId: UUID id
        federationId: UUID
        state: String
        cpuLoad: Decimal
        gpuLoad: Decimal
        memoryLoad: Decimal
        subscribe RuntimeHeartbeatRecorded
        subscribe ComputeNodeTrusted
      }
    }

    slice RaiseTrainingAlert {
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

      state Degraded
    }

    slice AppendAuditTrail {
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

      state Investigating

      projection ComplianceAuditLog {
        auditRecordId: UUID id
        sourceEventName: String
        actorId: UUID?
        severity: String
        appendedAt: DateTime
        subscribe AuditTrailAppended
      }
    }
  }
}
