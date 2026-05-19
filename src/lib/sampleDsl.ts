export const sampleDsl = `context FederationLearning {
  aggregate Federation {
    state Draft
    state Active

    slice CreateFederation {
      createsAggregate
      actor Admin
      ui CreateFederationScreen

      command CreateFederation {
        federationId: UUID id generated technical
        federationName: String
        description: String
        governancePolicyId: UUID
        minimumParticipantCount: Int
      }

      event FederationCreated {
        federationId: UUID id technical
        federationName: String
        description: String
        governancePolicyId: UUID
        minimumParticipantCount: Int
      }

      specification "Create federation with valid governance" {
        when CreateFederation
        then FederationCreated
      }

      specification "Reject federation below participant minimum" {
        when CreateFederation {
          minimumParticipantCount = 1
        }
        then FederationCreated
      }
    }

    slice FederationOverview {
      reactsTo FederationCreated
      projection FederationList {
        federationId: UUID id
        federationName: String
        status: String
        subscribe FederationCreated
      }
    }

    slice AutoActivateFederation {
      actor Admin
      ui FederationDetailScreen
      reactsTo FederationCreated

      automation ActivateNewFederation {
        condition status == "Draft"
        emits ActivateFederation
      }

      command ActivateFederation {
        federationId: UUID id
        activateReason: String?
      }

      event FederationActivated {
        federationId: UUID id
        activateReason: String?
        status: String
      }
    }
  }
}`;
