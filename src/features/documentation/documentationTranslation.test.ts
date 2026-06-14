import assert from 'node:assert/strict';
import test from 'node:test';
import type { EmModel } from '../../lib/model';
import {
  buildDocumentationTranslationCatalog,
  translateDocumentationModel
} from './documentationTranslation';

const model: EmModel = {
  domains: [{
    id: 'domain/demo',
    name: 'AccountPlatform',
    contexts: []
  }],
  contexts: [{
    id: 'context/account',
    name: 'AccountManagement',
    valueTypes: [],
    concepts: [],
    aggregates: [{
      id: 'aggregate/account',
      name: 'Account',
      states: ['Active'],
      slices: [{
        id: 'slice/register',
        name: 'RegisterAccount',
        resultingState: 'Active',
        tags: [],
        hotspots: ['Confirm duplicate email handling.'],
        elements: [{
          id: 'command/register',
          kind: 'command',
          name: 'RegisterAccount',
          fields: [{
            name: 'email',
            type: 'String',
            attributes: [],
            mapping: {
              kind: 'derived',
              sources: ['profile.email'],
              rule: 'Normalize the email address.'
            }
          }],
          metadata: {
            rule: 'An email address identifies one active account.',
            thenReject: 'Email already exists',
            expression1: 'unique Account.email',
            'example:email': 'owner@example.com',
            'givenExample:1:email': 'existing@example.com'
          }
        }]
      }]
    }],
    slices: [],
    looseElements: [],
    notes: ['Accounts are managed centrally.'],
    risks: [],
    decisions: [],
    metrics: []
  }],
  edges: [],
  diagnostics: []
};
model.domains[0].contexts = model.contexts;

test('builds a translation catalog from display vocabulary and narratives', () => {
  const catalog = buildDocumentationTranslationCatalog(model);
  assert(catalog.identifiers.includes('RegisterAccount'));
  assert(!catalog.identifiers.includes('email'));
  assert(!catalog.identifiers.includes('unique Account.email'));
  assert(!catalog.narratives.includes('owner@example.com'));
  assert(!catalog.narratives.includes('existing@example.com'));
  assert(catalog.narratives.includes('Normalize the email address.'));
  assert(catalog.narratives.includes('Accounts are managed centrally.'));
});

test('translates presentation content while preserving source identifiers', () => {
  const translated = translateDocumentationModel(model, {
    identifiers: {
      AccountPlatform: '账户平台',
      AccountManagement: '账户管理',
      Account: '账户',
      Active: '生效',
      RegisterAccount: '注册账户'
    },
    narratives: {
      'Confirm duplicate email handling.': '确认重复邮箱的处理规则。',
      'Normalize the email address.': '规范化邮箱地址。',
      'An email address identifies one active account.': '一个邮箱地址仅标识一个有效账户。',
      'Email already exists': '邮箱已存在',
      'Accounts are managed centrally.': '账户统一管理。'
    }
  });

  const context = translated.contexts[0];
  const slice = context.aggregates[0].slices[0];
  const command = slice.elements[0];
  assert.equal(context.name, '账户管理（AccountManagement）');
  assert.equal(slice.name, '注册账户（RegisterAccount）');
  assert.equal(command.fields[0].name, 'email');
  assert.equal(command.fields[0].mapping?.rule, '规范化邮箱地址。');
  assert.equal(command.metadata?.rule, '一个邮箱地址仅标识一个有效账户。');
  assert.equal(command.metadata?.thenReject, '邮箱已存在');
  assert.equal(command.metadata?.expression1, 'unique Account.email');
  assert.equal(command.metadata?.['example:email'], 'owner@example.com');
  assert.equal(command.metadata?.['givenExample:1:email'], 'existing@example.com');
});
