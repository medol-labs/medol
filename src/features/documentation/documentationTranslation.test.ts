import assert from 'node:assert/strict';
import test from 'node:test';
import type { EmModel } from '../../lib/model';
import { generateDocumentation } from '../../lib/generators/documentation';
import { numberMarkdownHeadings } from '../../lib/generators/documentation/documentHeadingNumbering';
import {
  buildDocumentationTranslationCatalog,
  modelTranslationsToDocumentationTranslations,
  translateDocumentationModel,
  translateDocumentationModelWithModelTranslations
} from './documentationTranslation';
import {
  buildModelTranslationUnits,
  renderModelTranslationMarkdown
} from '../model-i18n/modelTranslation';
import { normalizeModelTranslationResponse } from '../model-i18n/modelTranslationProvider';
import { toRenderableDocumentMarkdown } from './documentMarkdownPresentation';

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
  diagnostics: [],
  diagnosticDetails: []
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

test('generates Chinese database design without English template prose', () => {
  const readModelModel: EmModel = {
    domains: [{
      id: 'domain/orders',
      name: 'OrderPlatform',
      contexts: []
    }],
    contexts: [{
      id: 'context/sales',
      name: 'Sales',
      valueTypes: [],
      concepts: [],
      aggregates: [{
        id: 'aggregate/order',
        name: 'Order',
        states: [],
        slices: [{
          id: 'slice/order-list',
          name: 'OrderList',
          tags: [],
          hotspots: [],
          elements: [{
            id: 'readmodel/orders',
            kind: 'readmodel',
            name: 'OrderList',
            listElement: true,
            fields: [{
              name: 'orderId',
              type: 'UUID',
              attributes: ['id']
            }, {
              name: 'buyerName',
              type: 'String',
              attributes: ['query']
            }]
          }]
        }]
      }],
      slices: [],
      looseElements: [],
      notes: [],
      risks: [],
      decisions: [],
      metrics: []
    }],
    edges: [],
    diagnostics: [],
    diagnosticDetails: []
  };
  readModelModel.domains[0].contexts = readModelModel.contexts;

  const markdown = generateDocumentation(
    readModelModel,
    'database-design',
    { language: 'zh-CN' }
  ).markdown;

  assert.match(markdown, /逻辑标识：orderId。/);
  assert.match(markdown, /候选查询索引：buyerName。/);
  assert.match(markdown, /订阅事件处理需要具备幂等性。/);
  assert.doesNotMatch(markdown, /Logical identifier|Candidate query indexes|Apply subscribed events|Track event position|Confirm deletion|Provide deterministic ordering|Source \/ Derivation/);
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

test('builds context and slice scoped model translation units', () => {
  const units = buildModelTranslationUnits(model);
  const common = units.find((unit) => unit.kind === 'common');
  const context = units.find((unit) => unit.id === 'context:context/account');
  const slice = units.find((unit) => unit.id === 'slice:slice/register');

  assert(common);
  assert(context);
  assert(slice);
  assert(context.sourceRefs.includes('aggregate/account'));
  assert(slice.sourceRefs.includes('slice/register'));
  assert(context.sourceTexts.includes('Account Management'));
  assert(context.sourceTexts.includes('Accounts are managed centrally.'));
  assert(slice.sourceTexts.includes('Register Account'));
  assert(slice.sourceTexts.includes('Normalize the email address.'));
  assert(slice.sourceTexts.includes('Email already exists'));
});

test('renders locatable model translation markdown', () => {
  const markdown = renderModelTranslationMarkdown({
    model,
    locale: 'zh-CN',
    sourceHash: 'fnv1a-demo',
    translations: {
      'Account Management': '账户管理',
      'Register Account': '注册账户',
      'Normalize the email address.': '规范化邮箱地址。'
    }
  });

  assert.match(markdown, /# 模型国际化术语表/);
  assert.match(markdown, /<!-- em:section id="model-i18n\.context\.context_context_account" sources="context\/account aggregate\/account" -->/);
  assert.match(markdown, /<!-- em:section id="model-i18n\.slice\.slice_slice_register" source="slice\/register" -->/);
  assert.match(markdown, /\| Register Account \| 注册账户 \| 已翻译 \|/);
  assert.match(markdown, /\| Email already exists \| - \| 待翻译 \|/);
});

test('hides internal document comments from rendered markdown', () => {
  const markdown = [
    '# Account Platform 产品需求文档',
    '',
    '<!-- em:section id="prd.overview" source="context/account" -->',
    '',
    '## 版本变更记录',
    '',
    '<!-- medol:pagebreak -->',
    '',
    '## 一、产品背景与目标',
    '',
    '<!-- medol:toc -->',
    '',
    '<!-- empty document body -->',
    '',
    '正文内容。'
  ].join('\n');

  const renderable = toRenderableDocumentMarkdown(markdown);

  assert.match(renderable, /# Account Platform 产品需求文档/);
  assert.match(renderable, /## 一、产品背景与目标/);
  assert.match(renderable, /正文内容。/);
  assert.doesNotMatch(renderable, /<!--|medol:pagebreak|em:section|empty document body/);
  assert.doesNotMatch(renderable, /medol:toc/);
});

test('adds title-initial unique codes to Chinese document headings', () => {
  const markdown = generateDocumentation(
    model,
    'prd',
    { language: 'zh-CN' }
  ).markdown;

  assert.match(markdown, /## 一、产品背景与目标\/AP-PRD-BAG/);
  assert.match(markdown, /<!-- em:section id="document\.toc" -->\n## 目录\n\n- \[一、产品背景与目标\/AP-PRD-BAG\]\(#ap-prd-bag\)/);
  assert.match(markdown, /  - \[1\.1 业务背景\/AP-PRD-BB\]\(#ap-prd-bb\)/);
  assert.doesNotMatch(markdown, /\[TOC\]/);
  assert.match(markdown, /<!-- em:section id="prd\.section\.overview" sources="aggregate\/account slice\/register command\/register" -->/);
  assert.match(markdown, /<!-- em:section id="prd\.section\.featureInventory" sources="slice\/register command\/register" -->/);
  assert.match(markdown, /### 1\.1 业务背景\/AP-PRD-BB/);
  assert.match(markdown, /## 六、功能需求\/AP-PRD-FR/);
  assert.match(markdown, /#### 6\.1\.1 Register Account · 新增\/AP-PRD-RA/);
});

test('adds numeric suffixes for duplicate title-initial codes', () => {
  const markdown = numberMarkdownHeadings([
    '# Order Platform 产品需求文档',
    '',
    '## Create Order',
    '',
    '## Create Order',
    '',
    '## Cancel Order'
  ].join('\n'), 'zh-CN');

  assert.match(markdown, /## 一、Create Order\/OP-PRD-CO/);
  assert.match(markdown, /## 二、Create Order\/OP-PRD-CO-2/);
  assert.match(markdown, /## 三、Cancel Order\/OP-PRD-CO-3/);
});

test('maps stored model translations into documentation translations', () => {
  const translations = modelTranslationsToDocumentationTranslations(model, {
    'Account Platform': '账户平台',
    'Account Management': '账户管理',
    Account: '账户',
    Active: '生效',
    'Register Account': '注册账户',
    'Normalize the email address.': '规范化邮箱地址。',
    'An email address identifies one active account.': '一个邮箱地址仅标识一个有效账户。',
    'Email already exists': '邮箱已存在',
    'Accounts are managed centrally.': '账户统一管理。'
  });
  const translated = translateDocumentationModelWithModelTranslations(model, {
    'Account Platform': '账户平台',
    'Account Management': '账户管理',
    Account: '账户',
    Active: '生效',
    'Register Account': '注册账户',
    'Normalize the email address.': '规范化邮箱地址。',
    'An email address identifies one active account.': '一个邮箱地址仅标识一个有效账户。',
    'Email already exists': '邮箱已存在',
    'Accounts are managed centrally.': '账户统一管理。'
  });

  assert.equal(translations.identifiers.AccountManagement, '账户管理');
  assert.equal(translations.identifiers.RegisterAccount, '注册账户');
  assert.equal(translations.narratives['Normalize the email address.'], '规范化邮箱地址。');
  assert.equal(translated.contexts[0].name, '账户管理（AccountManagement）');
  assert.equal(translated.contexts[0].aggregates[0].slices[0].name, '注册账户（RegisterAccount）');
});

test('normalizes wrapped model translation provider responses', () => {
  const sourceTexts = ['Register Account', 'Email already exists'];

  assert.deepEqual(normalizeModelTranslationResponse({
    translations: {
      'Register Account': '注册账户',
      'Email already exists': '邮箱已存在'
    }
  }, sourceTexts), {
    'Register Account': '注册账户',
    'Email already exists': '邮箱已存在'
  });

  assert.deepEqual(normalizeModelTranslationResponse({
    data: [{
      sourceText: 'Register Account',
      translatedText: '注册账户'
    }, {
      source: 'Email already exists',
      translation: '邮箱已存在'
    }]
  }, sourceTexts), {
    'Register Account': '注册账户',
    'Email already exists': '邮箱已存在'
  });

  assert.deepEqual(normalizeModelTranslationResponse({
    translations: {
      'Register Account': { 'zh-CN': '注册账户' },
      'Email already exists': { 译文: '邮箱已存在' }
    }
  }, sourceTexts), {
    'Register Account': '注册账户',
    'Email already exists': '邮箱已存在'
  });

  assert.deepEqual(normalizeModelTranslationResponse([
    ['Register Account', '注册账户'],
    ['Email already exists', '邮箱已存在']
  ], sourceTexts), {
    'Register Account': '注册账户',
    'Email already exists': '邮箱已存在'
  });
});

test('generates a conventional Chinese PRD with concept business objects', () => {
  const conceptModel: EmModel = {
    domains: [{
      id: 'domain/demo',
      name: 'AccountPlatform',
      contexts: [],
      deployments: []
    }],
    deployments: [],
    contexts: [{
      id: 'context/account',
      name: 'AccountManagement',
      valueTypes: [],
      concepts: [{
        id: 'concept/account',
        name: 'Account',
        states: ['Registered', 'Active'],
        sliceNames: ['RegisterAccount'],
        sliceIds: ['slice/register']
      }],
      aggregates: [],
      slices: [{
        id: 'slice/register',
        name: 'RegisterAccount',
        resultingState: 'Registered',
        startsLifecycle: true,
        tags: [],
        hotspots: [],
        elements: [{
          id: 'actor/admin',
          kind: 'actor',
          name: 'AccountAdmin',
          fields: []
        }, {
          id: 'screen/register',
          kind: 'screen',
          name: 'AccountRegistrationScreen',
          fields: [],
          ui: { type: 'form' }
        }, {
          id: 'command/register',
          kind: 'command',
          name: 'RegisterAccount',
          fields: [{
            name: 'email',
            type: 'String',
            attributes: ['id']
          }]
        }, {
          id: 'event/registered',
          kind: 'event',
          name: 'AccountRegistered',
          fields: []
        }]
      }],
      looseElements: [],
      externalSystems: [],
      notes: ['Accounts are created by administrators before activation.'],
      risks: [],
      decisions: [],
      metrics: []
    }],
    edges: [],
    diagnostics: [],
    diagnosticDetails: []
  };
  conceptModel.domains[0].contexts = conceptModel.contexts;

  const markdown = generateDocumentation(
    conceptModel,
    'prd',
    { language: 'zh-CN' }
  ).markdown;

  assert.match(markdown, /## 一、产品背景与目标/);
  assert.match(markdown, /### 1\.1 业务背景/);
  assert.match(markdown, /Account Platform覆盖Account Management，定义实施所需的产品能力、操作角色、数据视图、业务规则和交付验收范围。/);
  assert.match(markdown, /## 三、角色与权限矩阵/);
  assert.match(markdown, /\| 角色 \| 职责 \| 可访问模块 \| 关键权限 \| 数据范围 \|/);
  assert.match(markdown, /\| Account Admin \| 负责Account Management中的新增。 \| Account Management \| 创建\/登记 Register Account \|/);
  assert.match(markdown, /## 六、功能需求/);
  assert.match(markdown, /#### 6\.1\.1 Register Account · 新增/);
  assert.match(markdown, /\*\*权限要求\*\*/);
  assert.match(markdown, /仅 Account Admin 或具备等效授权的角色可使用该功能。/);
  assert.match(markdown, /\*\*无权限处理\*\*/);
  assert.match(markdown, /不得产生 Account Registered。/);
  assert.match(markdown, /\*\*核心业务对象:\*\* Account/);
  assert.doesNotMatch(markdown, /\*\*核心业务对象:\*\* -/);
  assert.doesNotMatch(markdown, /Concept:Account|Event Modeling|MEDOL|covers|defines the product capabilities|delivery acceptance scope|尚未定义明确的验收规则|验收矩阵依据|specification/);
});

test('generates comprehensive Chinese software design sections', () => {
  const markdown = generateDocumentation(
    model,
    'software-design',
    { language: 'zh-CN' }
  ).markdown;

  assert.match(markdown, /## 一、概要设计/);
  assert.match(markdown, /### 1\.1 限界上下文与模块划分/);
  assert.match(markdown, /## 二、详细设计/);
  assert.match(markdown, /#### 2\.1\.1 业务对象设计/);
  assert.match(markdown, /#### 2\.1\.2 应用服务与能力设计/);
  assert.match(markdown, /## 三、接口与集成设计/);
  assert.doesNotMatch(markdown, /Architecture Overview|Aggregate Design|Implementation Gaps/);
});

test('generates Chinese test outline documentation', () => {
  const markdown = generateDocumentation(
    model,
    'test-outline',
    { language: 'zh-CN' }
  ).markdown;

  assert.match(markdown, /# Account Platform 测试大纲/);
  assert.match(markdown, /## 一、测试目标与范围/);
  assert.match(markdown, /## 二、测试对象/);
  assert.match(markdown, /## 三、测试范围边界/);
  assert.match(markdown, /### 3\.1 纳入测试范围/);
  assert.match(markdown, /## 六、测试类型/);
  assert.match(markdown, /## 七、功能测试范围/);
  assert.match(markdown, /## 八、测试场景覆盖/);
  assert.match(markdown, /Specification Test/);
  assert.match(markdown, /正常路径；拒绝路径；幂等；权限；边界；并发/);
  assert.match(markdown, /## 九、业务规则与异常测试/);
  assert.match(markdown, /## 十四、准出标准/);
});
