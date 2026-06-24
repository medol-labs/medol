import assert from 'node:assert/strict';
import test from 'node:test';
import { coveredSpecificationExpressions } from './specificationCoverage';

test('maps unique and failed assert expressions to a rejecting scenario', () => {
  const expressions = [
    'unique Account.email',
    'unique (Membership.federationId, Membership.participantId)',
    'assert RegisterAccount.age >= 18',
    'assert RegisterAccount.enabled == true'
  ];
  const validates = coveredSpecificationExpressions({
    expressions,
    metadata: {
      given1: 'AccountRegistered',
      'givenExample:1:email': '"owner@example.com"',
      'givenExample:1:federationId': '"f-1"',
      'givenExample:1:participantId': '"p-1"',
      when: 'RegisterAccount',
      'example:email': '"owner@example.com"',
      'example:federationId': '"f-1"',
      'example:participantId': '"p-1"',
      'example:age': '16',
      'example:enabled': 'true'
    }
  });

  assert.deepEqual(validates, [
    'unique Account.email',
    'unique (Membership.federationId, Membership.participantId)',
    'assert RegisterAccount.age >= 18'
  ]);
});

test('composite unique requires every field to match the same given example', () => {
  const expression = 'unique (Membership.federationId, Membership.participantId)';
  const validates = coveredSpecificationExpressions({
    expressions: [expression],
    metadata: {
      given1: 'ParticipantJoined',
      'givenExample:1:federationId': '"f-1"',
      'givenExample:1:participantId': '"p-1"',
      when: 'JoinFederation',
      'example:federationId': '"f-1"',
      'example:participantId': '"p-2"'
    }
  });

  assert.deepEqual(validates, []);
});

test('does not claim coverage when examples do not prove a violation', () => {
  const validates = coveredSpecificationExpressions({
    expressions: [
      'unique Account.email',
      'assert RegisterAccount.age >= 18'
    ],
    metadata: {
      given1: 'AccountRegistered',
      'givenExample:1:email': '"existing@example.com"',
      when: 'RegisterAccount',
      'example:email': '"new@example.com"',
      'example:age': '21'
    }
  });

  assert.deepEqual(validates, []);
});
