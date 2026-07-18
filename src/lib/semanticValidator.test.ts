import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMedol } from './dslParser';
import { MedolValidationError, medolToCodegenModel } from './dslToConfig';

const diagnosticsFor = (medol: string): string[] => parseMedol(medol).diagnostics;

test('parses derived read model lookups with composite keys', () => {
  const model = parseMedol(`
    context Demo {
      slice Catalogs {
        readmodel TenantThingDirectory[] {
          tenantId: UUID id
          thingId: UUID id
          displayName: String
        }
        readmodel ThingUsage[] {
          tenantId: UUID id
          thingId: UUID id
          displayName: String? derived from TenantThingDirectory.displayName by tenantId, thingId
        }
      }
    }
  `);
  assert.deepEqual(model.diagnostics, []);
  const field = model.contexts[0].slices[0].elements
    .find((element) => element.name === 'ThingUsage')
    ?.fields.find((item) => item.name === 'displayName');
  assert.deepEqual(field?.mapping?.lookup, {
    key: 'tenantId',
    keys: ['tenantId', 'thingId'],
    cacheProjection: 'TenantThingDirectory',
    sourceField: 'displayName',
    targetField: 'displayName',
    missingValuePolicy: 'keep'
  });
});

test('reports parser and semantic diagnostics at their real source ranges', () => {
  const parserModel = parseMedol(`context Demo {
  value Feature {
    shape: Int[]？
  }
}`);
  const parserDiagnostic = parserModel.diagnosticDetails.find((diagnostic) =>
    diagnostic.message.includes('unexpected character')
  );
  assert.equal(parserDiagnostic?.range?.start.line, 3);
  assert.equal(parserDiagnostic?.range?.start.column, 17);

  const semanticModel = parseMedol(`context Demo {
  value Feature {
    shape: MissingType
  }
}`);
  const semanticDiagnostic = semanticModel.diagnosticDetails.find((diagnostic) =>
    diagnostic.message.includes('unknown type MissingType')
  );
  assert.equal(semanticDiagnostic?.range?.start.line, 3);
  assert.equal(semanticDiagnostic?.range?.start.column, 5);
  assert(semanticDiagnostic?.range?.end.column > semanticDiagnostic!.range!.start.column);
});

test('accepts reusable types, business expressions, booleans, and null optionals', () => {
  const diagnostics = diagnosticsFor(`
    domain Demo {
      context Accounts {
        type Email = String {
          format email
        }
        type Role = String {
          oneOf "Admin", "Member"
        }
        slice RegisterAccount {
          startsLifecycle
          command RegisterAccount {
            accountId: UUID
            email: Email
            role: Role
            enabled: Boolean
            memo: String?
            age: Int
          }
          event AccountRegistered {
            accountId: UUID
            email: Email
            role: Role
            enabled: Boolean
            memo: String?
            age: Int
          }
          state Active
          specification "Account rules" {
            expression {
              unique Account.email
              assert RegisterAccount.age >= 18
            }
            scenario "Register" {
              when RegisterAccount {
                accountId = "9d037349-42a5-4ce7-9e39-cab0df01e408"
                email = "owner@example.com"
                role = "Admin"
                enabled = true
                memo = null
                age = 32
              }
              then AccountRegistered
            }
            scenario "Reject duplicate email" {
              given AccountRegistered {
                email = "owner@example.com"
              }
              when RegisterAccount {
                email = "owner@example.com"
                role = "Admin"
                enabled = true
                memo = null
                age = 32
              }
              then reject "Account Email Already Exists"
            }
            scenario "Reject underage owner" {
              when RegisterAccount {
                email = "young@example.com"
                role = "Member"
                enabled = true
                memo = null
                age = 16
              }
              then reject "Account Owner Must Be An Adult"
            }
          }
        }
        concept Account {
          state Active
          slice RegisterAccount
        }
      }
    }
  `);

  assert.deepEqual(diagnostics, []);
});

test('reports invalid type definitions and field types', () => {
  const diagnostics = diagnosticsFor(`
    context Types {
      type A = B
      type B = A
      type BrokenRange = Int {
        range 10..1
      }
      type BrokenLength = Int {
        length 1..2
      }
      type BrokenPattern = String {
        matches "["
      }
      slice Create {
        command Create {
          value: MissingType
        }
      }
      readmodel BrokenView {
        value: AnotherMissingType
      }
    }
  `);

  assert(diagnostics.some((message) => message.includes('cyclic type definition')));
  assert(diagnostics.some((message) => message.includes('invalid range bounds')));
  assert(diagnostics.some((message) => message.includes('length is only valid for String-based types')));
  assert(diagnostics.some((message) => message.includes('invalid regular expression')));
  assert(diagnostics.some((message) => message.includes('unknown type MissingType')));
  assert(diagnostics.some((message) => message.includes('unknown type AnotherMissingType')));
});

test('reports invalid lifecycle, state, tags, and concept membership', () => {
  const diagnostics = diagnosticsFor(`
    context Lifecycle {
      slice Start {
        startsLifecycle
        tags {
          missingField
        }
        command Start {
          id: UUID
        }
        state Unknown
      }
      slice Start {
        command Other {
          id: UUID
        }
      }
      concept Item {
        state Active
        slice Start
        slice Missing
      }
    }
  `);

  assert(diagnostics.some((message) => message.includes('duplicate slice Start')));
  assert(diagnostics.some((message) => message.includes('tag missingField does not match any field')));
  assert(diagnostics.some((message) => message.includes('results in undeclared state Unknown')));
  assert(diagnostics.some((message) => message.includes('references unknown slice Missing')));
  assert(diagnostics.some((message) => message.includes('slice reference Start is ambiguous')));
});

test('reports invalid specification operands and examples', () => {
  const diagnostics = diagnosticsFor(`
    context Rules {
      slice Register {
        command Register {
          name: String
          count: Int
          aliases: String[]
        }
        event Registered {
          name: String
        }
        specification "Rules" {
          expression {
            unique Register.missing
            unique Register.aliases
            assert Register.name >= 1
          }
          scenario "Invalid example" {
            when Register {
              missing = "x"
              count = "many"
            }
            then MissingEvent
          }
        }
      }
    }
  `);

  assert(diagnostics.some((message) => message.includes('unique references unknown field Register.missing')));
  assert(diagnostics.some((message) => message.includes('unique cannot target collection field Register.aliases')));
  assert(diagnostics.some((message) => message.includes('cannot compare Register.name')));
  assert(diagnostics.some((message) => message.includes('has no field missing')));
  assert(diagnostics.some((message) => message.includes('value for Register.count is incompatible')));
  assert(diagnostics.some((message) => message.includes('Unresolved then reference event MissingEvent')));
});

test('requires rejecting scenarios to demonstrate unique and assert violations', () => {
  const diagnostics = diagnosticsFor(`
    context Rules {
      slice Register {
        command Register {
          email: String
          age: Int
        }
        event Registered {
          email: String
          age: Int
        }
        specification "Registration rules" {
          expression {
            unique Account.email
            assert Register.age >= 18
          }
          scenario "Unrelated rejection" {
            when Register {
              email = "new@example.com"
              age = 21
            }
            then reject "Rejected"
          }
        }
      }
      concept Account {
        slice Register
      }
    }
  `);

  assert(diagnostics.some((message) => message.includes('unique Account.email is not covered')));
  assert(diagnostics.some((message) => message.includes('assert Register.age >= 18 is not covered')));
  assert(diagnostics.some((message) => message.includes('reject does not demonstrate a violation')));
});

test('accepts and validates composite unique expressions', () => {
  const diagnostics = diagnosticsFor(`
    context Federation {
      slice JoinFederation {
        command JoinFederation {
          federationId: UUID
          participantId: UUID
        }
        event ParticipantJoined {
          federationId: UUID
          participantId: UUID
        }
        specification "Participant unique within federation" {
          expression {
            unique (Membership.federationId, Membership.participantId)
          }
          scenario "Reject duplicate membership" {
            given ParticipantJoined {
              federationId = "f-1"
              participantId = "p-1"
            }
            when JoinFederation {
              federationId = "f-1"
              participantId = "p-1"
            }
            then reject "Participant Already Joined"
          }
        }
      }
      concept Membership {
        slice JoinFederation
      }
    }
  `);

  assert.deepEqual(diagnostics, []);
});

test('composite unique coverage requires all fields to match', () => {
  const diagnostics = diagnosticsFor(`
    context Federation {
      slice JoinFederation {
        command JoinFederation {
          federationId: UUID
          participantId: UUID
        }
        event ParticipantJoined {
          federationId: UUID
          participantId: UUID
        }
        specification "Participant unique within federation" {
          expression {
            unique (Membership.federationId, Membership.participantId)
          }
          scenario "Different participant" {
            given ParticipantJoined {
              federationId = "f-1"
              participantId = "p-1"
            }
            when JoinFederation {
              federationId = "f-1"
              participantId = "p-2"
            }
            then reject "Rejected"
          }
        }
      }
      concept Membership {
        slice JoinFederation
      }
    }
  `);

  assert(diagnostics.some((message) =>
    message.includes('unique (Membership.federationId, Membership.participantId) is not covered')
  ));
});

test('blocks code generation when semantic diagnostics exist', () => {
  assert.throws(
    () => medolToCodegenModel(`
      context Invalid {
        slice Create {
          command Create {
            value: MissingType
          }
        }
      }
    `),
    MedolValidationError
  );
});
