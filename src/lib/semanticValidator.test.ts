import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMedol } from './dslParser';
import { MedolValidationError, medolToCodegenModel } from './dslToConfig';

const diagnosticsFor = (medol: string): string[] => parseMedol(medol).diagnostics;

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
        aggregate Account {
          state Active
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
                assert RegisterAccount.memo != null
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
            }
          }
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
