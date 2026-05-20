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
        verifierId: UUID
        verificationProvider: String
        identityEvidenceId: UUID
      }

      event OrganizationIdentityVerified {
        organizationId: UUID id technical
        verifierId: UUID
        verificationProvider: String
        identityEvidenceId: UUID
        verifiedAt: DateTime
      }

      state IdentityVerified
    }

    slice ActivateOrganization {
      actor PlatformAdmin
      ui OrganizationAdminScreen
      reactsTo OrganizationIdentityVerified

      command ActivateOrganization {
        organizationId: UUID id technical
        activatedBy: UUID
        activationNote: String?
      }

      event OrganizationActivated {
        organizationId: UUID id technical
        activatedBy: UUID
        activationNote: String?
      }

      state Active

      projection OrganizationDirectory {
        organizationId: UUID id
        organizationName: String
        organizationType: String
        countryCode: String
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

    slice DeactivateOrganization {
      actor PlatformAdmin
      ui OrganizationAdminScreen
      reactsTo OrganizationActivated

      command DeactivateOrganization {
        organizationId: UUID id technical
        deactivatedBy: UUID
        deactivationReason: String
      }

      event OrganizationDeactivated {
        organizationId: UUID id technical
        deactivatedBy: UUID
        deactivationReason: String
      }

      state Deactivated
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
        state: String
      }

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
        invitedBy: UUID
        invitationReason: String
      }

      event ParticipantInvited {
        federationId: UUID id technical
        organizationId: UUID
        invitedBy: UUID
        invitationReason: String
        invitationState: String
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
        reviewerId: UUID
        approvalNote: String?
      }

      event ParticipantJoined {
        federationId: UUID id technical
        organizationId: UUID
        reviewerId: UUID
        memberState: String
      }

      projection FederationMembership {
        federationId: UUID id
        activeMemberCount: Int
        pendingInvitationCount: Int
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
        activeOrganizationCount: Int
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
        trustState: String
      }
    }

    slice UpdateNodeCapability {
      actor NodeOperator
      ui NodeCapabilityScreen
      reactsTo ComputeNodeRegistered

      command UpdateNodeCapability {
        nodeId: UUID id technical
        organizationId: UUID
        gpuCount: Int
        cpuCoreCount: Int
        memoryGb: Int
        storageGb: Int
        supportedFrameworks: String[]
        maxConcurrentJobs: Int
      }

      event NodeCapabilityUpdated {
        nodeId: UUID id technical
        organizationId: UUID
        gpuCount: Int
        cpuCoreCount: Int
        memoryGb: Int
        storageGb: Int
        supportedFrameworks: String[]
        maxConcurrentJobs: Int
        updatedAt: DateTime
      }
    }

    slice TrustComputeNode {
      actor SecurityReviewer
      ui NodeTrustScreen
      reactsTo NodeCapabilityUpdated

      command TrustComputeNode {
        nodeId: UUID id technical
        organizationId: UUID
        trustLevel: String
        attestationReportId: UUID
        attestationExpiresAt: DateTime
      }

      event ComputeNodeTrusted {
        nodeId: UUID id technical
        organizationId: UUID
        trustLevel: String
        attestationReportId: UUID
        attestationExpiresAt: DateTime
        trustedAt: DateTime
      }
    }

    slice SuspendComputeNode {
      actor SecurityReviewer
      ui NodeTrustScreen
      reactsTo RuntimeHeartbeatRecorded

      command SuspendComputeNode {
        nodeId: UUID id technical
        organizationId: UUID
        suspendedBy: UUID
        suspensionReason: String
      }

      event ComputeNodeSuspended {
        nodeId: UUID id technical
        organizationId: UUID
        suspendedBy: UUID
        suspensionReason: String
        state: String
      }
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
        definedBy: UUID
      }

      event FeatureSchemaPublished {
        featureSchemaId: UUID id technical
        domain: String
        version: Int
        featureCount: Int
        publishedBy: UUID
      }
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
        approvedBy: UUID
        allowedTrainingPurpose: String
        expiresAt: DateTime
      }

      event DatasetApprovedForTraining {
        datasetId: UUID id technical
        organizationId: UUID
        featureSchemaId: UUID
        allowedTrainingPurpose: String
        expiresAt: DateTime
      }

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
    state ReadyToTrain

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
        : String
      }
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
    }

    slice SubmitTrainingJob {
      actor ResearchLead
      ui TrainingSubmissionScreen
      reactsTo TrainingStrategyConfigured

      command SubmitTrainingJob {
        trainingJobId: UUID id technical
        submittedBy: UUID
      }

      event TrainingJobSubmitted {
        trainingJobId: UUID id technical
        federationId: UUID
        minimumNodesPerRound: Int
        submittedBy: UUID
        : String
      }

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
  }

  aggregate TrainingRound {
    state WaitingForNodes
    state Running
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
        startedAt: DateTime
      }
    }

    slice DistributeGlobalModel {
      reactsTo TrainingRoundStarted

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
        distributedAt: DateTime
      }
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
        requestId: UUID
      }
    }

    slice CompleteSecureAggregation {
      reactsTo SecureAggregationRequested

      command CompleteSecureAggregation {
        trainingJobId: UUID id technical
        roundId: UUID
        requestId: UUID
        aggregatedModelVersionId: UUID
        aggregationState: String
      }

      event GlobalModelUpdated {
        trainingJobId: UUID id technical
        roundId: UUID
        requestId: UUID
        aggregatedModelVersionId: UUID
        aggregationState: String
      }
    }

    slice CompleteTrainingRound {
      reactsTo GlobalModelUpdated

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
        completedAt: DateTime
      }

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
    }

    slice ApproveModel {
      actor GovernanceReviewer
      ui ModelApprovalScreen
      reactsTo ModelEvaluationCompleted

      command ApproveModel {
        modelVersionId: UUID id technical
        approvedBy: UUID
        approvalNote: String?
      }

      event ModelApproved {
        modelVersionId: UUID id technical
        approvedBy: UUID
        approvalNote: String?
        approvedAt: DateTime
      }
    }

    slice PromoteModelToProduction {
      actor ReleaseManager
      ui ModelReleaseScreen
      reactsTo ModelApproved

      command PromoteModelToProduction {
        modelVersionId: UUID id technical
        releaseChannel: String
        promotedBy: UUID
      }

      event ModelPromotedToProduction {
        modelVersionId: UUID id technical
        releaseChannel: String
        promotedBy: UUID
        promotedAt: DateTime
      }

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
        lastSeenAt: DateTime
      }

      event RuntimeHeartbeatRecorded {
        nodeId: UUID id technical
        federationId: UUID
        cpuLoad: Decimal
        gpuLoad: Decimal
        memoryLoad: Decimal
        lastSeenAt: DateTime
      }

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
        raisedAt: DateTime
      }
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
        actorId: UUID?
        severity: String
        payloadHash: String
      }

      event AuditTrailAppended {
        auditRecordId: UUID id technical
        sourceEventName: String
        actorId: UUID?
        severity: String
        payloadHash: String
        appendedAt: DateTime
      }

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
