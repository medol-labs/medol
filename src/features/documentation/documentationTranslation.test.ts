import assert from 'node:assert/strict';
import test from 'node:test';
import type { EmModel } from '../../lib/model';
import { generateDocumentation } from '../../lib/generators/documentation';
import { numberMarkdownHeadings } from '../../lib/generators/documentation/documentHeadingNumbering';
import { medolSoftwareVersion } from '../../lib/generators/documentation/documentVersion';
import { renderSimpleMermaidSvg } from '../../lib/generators/documentation/simpleMermaidRenderer';
import {
  buildDocumentationTranslationCatalog,
  modelTranslationsToDocumentationTranslations,
  translateDocumentationModel,
  translateDocumentationModelWithModelTranslations
} from './documentationTranslation';
import {
  buildModelTranslationUnits,
  parseModelTranslationMarkdown,
  renderModelTranslationMarkdown,
  toCodegenTranslations
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

test('uses the modeled domain name as the generated document title source', () => {
  const multiDomainModel: EmModel = {
    ...model,
    domains: [
      model.domains[0],
      {
        id: 'domain/audit',
        name: 'AuditPlatform',
        contexts: []
      }
    ]
  };

  const document = generateDocumentation(multiDomainModel, 'software-design');
  const prd = generateDocumentation(multiDomainModel, 'prd');

  assert.equal(document.title, 'Account Platform Software Design');
  assert.match(document.markdown, /^# Account Platform Software Design/m);
  assert.equal(prd.title, 'Account Platform Product Requirements and Acceptance');
  assert.match(prd.markdown, /^# Account Platform Product Requirements Document/m);
  assert.doesNotMatch(document.title, /Event Modeling Workspace/);
  assert.doesNotMatch(prd.markdown, /Event Modeling Workspace/);
});

test('uses translated domain display text in generated Chinese document titles', () => {
  const translated = translateDocumentationModelWithModelTranslations(model, {
    'Account Platform': '账户平台'
  });

  const document = generateDocumentation(translated, 'prd', { language: 'zh-CN' });

  assert.equal(document.title, '账户平台（Account Platform） 产品需求文档');
  assert.match(document.markdown, /^# 账户平台（Account Platform） 产品需求文档/m);
  assert.match(document.markdown, /## 一、产品背景与目标\/AP-PRD-BAG/);
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

test('parses edited model translation markdown back into source translations', () => {
  const markdown = [
    '# 模型国际化术语表',
    '',
    '| 原文 | 译文 | 状态 |',
    '| --- | --- | --- |',
    '| Active Member Count | 活跃成员数 | 已翻译 |',
    '| Rule with \\| separator | 包含\\|分隔符的规则 | 已翻译 |',
    '| Windows Path | C:\\Temp\\Demo | 已翻译 |',
    '| Pending Item | - | 待翻译 |'
  ].join('\n');

  assert.deepEqual(parseModelTranslationMarkdown(markdown), {
    'Active Member Count': '活跃成员数',
    'Rule with | separator': '包含|分隔符的规则',
    'Windows Path': 'C:\\Temp\\Demo'
  });
});

test('normalizes Chinese model translations with feature schema context', () => {
  const codegenTranslations = toCodegenTranslations('zh-CN', {
    'Feature Schema': '特征模式',
    'Feature Schema Catalog': '特征模式目录',
    'Feature Schema Id': '特征模式 ID',
    'Agent Feature Schema Catalog': '代理功能架构目录',
    'Agent Feature Schema Catalogs': '代理功能架构目录',
    'Agent Dictionary Value Catalog': '代理字典值目录'
  }).translations['zh-CN'];

  assert.equal(codegenTranslations['Feature Schema'], '特征架构');
  assert.equal(codegenTranslations['Feature Schema Catalog'], '特征架构目录');
  assert.equal(codegenTranslations['Feature Schema Id'], '特征架构 ID');
  assert.equal(codegenTranslations['Agent Feature Schema Catalog'], '运行时代理特征架构目录');
  assert.equal(codegenTranslations['Agent Feature Schema Catalogs'], '运行时代理特征架构目录');
  assert.equal(codegenTranslations['Agent Dictionary Value Catalog'], '代理字典值目录');
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

  assert.deepEqual(normalizeModelTranslationResponse({
    RegisterAccount: '注册账户',
    EmailAlreadyExists: '邮箱已存在'
  }, sourceTexts), {
    'Register Account': '注册账户',
    'Email already exists': '邮箱已存在'
  });

  assert.deepEqual(normalizeModelTranslationResponse(
    '注册模型工件',
    ['Register Model Artifact']
  ), {
    'Register Model Artifact': '注册模型工件'
  });

  assert.deepEqual(normalizeModelTranslationResponse(
    '```json\n{\n  "PYTORCH\\_STATE\\_DICT and SKLEARN\\_PICKLE": "PYTORCH_STATE_DICT 和 SKLEARN_PICKLE"\n}\n```',
    ['PYTORCH_STATE_DICT and SKLEARN_PICKLE']
  ), {
    'PYTORCH_STATE_DICT and SKLEARN_PICKLE': 'PYTORCH_STATE_DICT 和 SKLEARN_PICKLE'
  });

  const modelArtifactRule = [
    'Registering a model artifact is a port-backed import operation. modelFormat is maintained by the MODEL_FORMAT dictionary.',
    '',
    'unique (ModelArtifact.modelName, ModelArtifact.modelVersion)'
  ].join('\n');
  assert.deepEqual(normalizeModelTranslationResponse({
    'Registering a model artifact is a port-backed import operation. modelFormat is maintained by the MODEL\\_FORMAT dictionary.': '注册模型制品是一个由端口支持的导入操作。modelFormat 由 MODEL_FORMAT 字典维护。',
    'unique (ModelArtifact.modelName, ModelArtifact.modelVersion)': '唯一 (ModelArtifact.modelName, ModelArtifact.modelVersion)'
  }, [modelArtifactRule]), {
    [modelArtifactRule]: [
      '注册模型制品是一个由端口支持的导入操作。modelFormat 由 MODEL_FORMAT 字典维护。',
      '',
      '唯一 (ModelArtifact.modelName, ModelArtifact.modelVersion)'
    ].join('\n')
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
  assert.doesNotMatch(markdown, /Concept:Account|Event Modeling|covers|defines the product capabilities|delivery acceptance scope|尚未定义明确的验收规则|验收矩阵依据|specification/);
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

test('generates Chinese user journey summary documentation', () => {
  const markdown = generateDocumentation(
    model,
    'user-journey',
    { language: 'zh-CN' }
  ).markdown;

  assert.match(markdown, /# Account Platform 用户旅程总结/);
  assert.match(markdown, /## 一、旅程概览/);
  assert.match(markdown, /## 二、角色旅程摘要/);
  assert.match(markdown, /\| 角色 \| 目标\/能力 \| 主要触点 \| 关键结果 \|/);
  assert.match(markdown, /\| 系统 \| Register Account \|/);
  assert.match(markdown, /Register Account/);
  assert.doesNotMatch(markdown, /```mermaid\nflowchart LR/);
  assert.match(markdown, /## 三、业务域旅程/);
  assert.match(markdown, /\| 步骤 \| 角色\/触发方 \| 用户目标 \| 触点 \| 业务结果 \| 完成证据 \|/);
  assert.match(markdown, /## 六、AI 辅助业务梳理提示词/);
  assert.match(markdown, /不得编造模型中不存在的角色、能力、状态、页面、集成或业务规则/);
});

test('generates actor journeys from explicit results and automation links', () => {
  const context = {
    ...model.contexts[0],
    aggregates: [],
    slices: [
      {
        id: 'slice/create', name: 'CreateTrainingJob', tags: [], hotspots: [],
        elements: [
          { id: 'actor/researcher', kind: 'actor' as const, name: 'ResearchLead', fields: [] },
          { id: 'screen/create', kind: 'screen' as const, name: 'TrainingJobScreen', fields: [] },
          { id: 'command/create', kind: 'command' as const, name: 'CreateTrainingJob', fields: [], sliceId: 'slice/create' },
          { id: 'event/created', kind: 'event' as const, name: 'TrainingJobCreated', fields: [] },
          { id: 'spec/failure', kind: 'gwt' as const, name: 'MissingConfiguration', fields: [], metadata: { when: 'CreateTrainingJob', thenError: 'Configuration required' } }
        ]
      },
      {
        id: 'slice/review', name: 'ReviewTrainingJob', tags: [], hotspots: [],
        elements: [
          { id: 'actor/reviewer', kind: 'actor' as const, name: 'GovernanceReviewer', fields: [] },
          { id: 'screen/review', kind: 'screen' as const, name: 'TrainingReviewScreen', fields: [] },
          { id: 'command/review', kind: 'command' as const, name: 'ReviewTrainingJob', fields: [], sliceId: 'slice/review' },
          { id: 'event/reviewed', kind: 'event' as const, name: 'TrainingJobReviewed', fields: [] }
        ]
      },
      {
        id: 'slice/submit', name: 'SubmitTrainingJob', tags: [], hotspots: [],
        elements: [
          { id: 'automation/submit', kind: 'automation' as const, name: 'SubmitWhenCreated', fields: [] },
          { id: 'command/submit', kind: 'command' as const, name: 'SubmitTrainingJob', fields: [], sliceId: 'slice/submit' },
          { id: 'event/submitted', kind: 'event' as const, name: 'TrainingJobSubmitted', fields: [] }
        ]
      },
      {
        id: 'slice/catalog', name: 'TrainingJobCatalog', tags: [], hotspots: [],
        elements: [{ id: 'readmodel/jobs', kind: 'readmodel' as const, name: 'TrainingJobCatalog', fields: [] }]
      },
      {
        id: 'slice/delete', name: 'DeleteTrainingJob', tags: [], hotspots: [],
        elements: [
          { id: 'actor/operator', kind: 'actor' as const, name: 'TrainingOperator', fields: [] },
          { id: 'command/delete', kind: 'command' as const, name: 'DeleteTrainingJob', fields: [], sliceId: 'slice/delete' }
        ]
      }
    ]
  };
  const diagramModel: EmModel = {
    ...model,
    contexts: [context],
    domains: [{ ...model.domains[0], contexts: [context] }],
    userJourneys: [{
      id: 'user-journey/TrainingOverview', name: 'TrainingOverview',
      stages: [
        { id: 'user-journey/TrainingOverview/stage/CreateTraining', name: 'CreateTraining', context: context.name, contextId: context.id },
        { id: 'user-journey/TrainingOverview/stage/ReviewTraining', name: 'ReviewTraining', context: context.name, contextId: context.id }
      ],
      transitions: [{ source: 'user-journey/TrainingOverview/stage/CreateTraining', target: 'user-journey/TrainingOverview/stage/ReviewTraining', condition: 'Ready for review' }]
    }],
    edges: [
      { id: '1', source: 'command/create', target: 'event/created', label: 'emits' },
      { id: '2', source: 'event/created', target: 'automation/submit', label: 'triggers' },
      { id: '3', source: 'automation/submit', target: 'command/submit', label: 'emits' },
      { id: '4', source: 'command/submit', target: 'event/submitted', label: 'emits' },
      { id: '5', source: 'event/submitted', target: 'readmodel/jobs', label: 'updates' },
      { id: '6', source: 'event/created', target: 'command/review', label: 'reactsTo' }
    ]
  };
  const markdown = generateDocumentation(diagramModel, 'diagrams', { language: 'zh-CN' }).markdown;
  const diagrams = [...markdown.matchAll(/```mermaid\n([\s\S]*?)\n```/g)].map((match) => match[1]);
  const [overview, diagram] = diagrams;

  assert.match(markdown, /# Account Platform 图表文档/);
  assert.match(markdown, /## 一、总体业务旅程/);
  assert.match(markdown, /## 二、用户旅程图/);
  assert.match(overview, /Create Training/);
  assert.match(overview, /Review Training/);
  assert.match(overview, /S1 -->\|Ready for review\| S2/);
  assert.match(markdown, /角色: Research Lead/);
  assert.match(markdown, /界面: Training Job Screen/);
  assert.match(markdown, /操作: Create Training Job/);
  assert.match(markdown, /结果: Training Job Created/);
  assert.match(markdown, /自动步骤: Submit When Created/);
  assert.match(diagram ?? '', /后续可操作: Governance Reviewer/);
  assert.match(diagram ?? '', /后续界面: Training Review Screen/);
  assert.match(diagram ?? '', /操作: Review Training Job/);
  assert.doesNotMatch(diagram ?? '', /Delete Training Job/);
  assert.match(markdown, /结果: Training Job Submitted/);
  assert.match(markdown, /查询视图: Training Job Catalog/);
  assert.match(markdown, /失败: Configuration required/);
  assert.equal(diagrams.length, 4);
  assert.match(renderSimpleMermaidSvg(overview) ?? '', /<svg\b/);
  assert.match(renderSimpleMermaidSvg(overview) ?? '', /Ready for review/);
  assert.match(renderSimpleMermaidSvg(diagram ?? '') ?? '', /<svg\b/);
});

test('includes diagram journey terms in model translation units and renders their translations', () => {
  const diagramModel: EmModel = {
    ...model,
    userJourneys: [{
      id: 'journey/setup', name: 'SetupJourney',
      stages: [
        { id: 'stage/register', name: 'RegisterAccount', context: 'AccountManagement', contextId: 'context/account' },
        { id: 'stage/confirm', name: 'ConfirmAccount', context: 'AccountManagement', contextId: 'context/account' }
      ],
      transitions: [{ source: 'stage/register', target: 'stage/confirm', condition: 'Account is active' }]
    }]
  };
  const commonTexts = buildModelTranslationUnits(diagramModel)
    .find((unit) => unit.id === 'common')?.sourceTexts ?? [];
  assert(commonTexts.includes('Setup Journey'));
  assert(commonTexts.includes('Confirm Account'));
  assert(commonTexts.includes('Account is active'));

  const translated = translateDocumentationModelWithModelTranslations(diagramModel, {
    'Account Platform': '账户平台',
    'Account Management': '账户管理',
    'Setup Journey': '账户开通旅程',
    'Register Account': '注册账户',
    'Confirm Account': '确认账户',
    'Account is active': '账户已激活'
  });
  const markdown = generateDocumentation(translated, 'diagrams', { language: 'zh-CN' }).markdown;
  assert.match(markdown, /账户开通旅程（Setup Journey）/);
  assert.match(markdown, /注册账户（Register Account）/);
  assert.match(markdown, /确认账户（Confirm Account）/);
  assert.match(markdown, /S1 -->\|账户已激活\| S2/);
});

test('resolves raw journey identifiers and keeps complete bilingual labels in the SVG', () => {
  const diagramModel: EmModel = {
    ...model,
    userJourneys: [{
      id: 'journey/setup', name: 'SetupJourney',
      stages: [
        { id: 'stage/organization', name: 'OnboardOrganization', context: 'AccountManagement', contextId: 'context/account' },
        { id: 'stage/dataset', name: 'PrepareParticipantDataset', context: 'AccountManagement', contextId: 'context/account' }
      ],
      transitions: [{ source: 'stage/organization', target: 'stage/dataset', condition: 'Secure aggregation required' }]
    }]
  };
  const translated = translateDocumentationModelWithModelTranslations(diagramModel, {
    OnboardOrganization: '组织入驻',
    PrepareParticipantDataset: '准备参与方数据集',
    AccountManagement: '账户管理',
    'Secure aggregation required': '需要安全聚合'
  });
  const markdown = generateDocumentation(translated, 'diagrams', { language: 'zh-CN' }).markdown;
  const overview = markdown.match(/```mermaid\n([\s\S]*?)\n```/)?.[1] ?? '';
  assert.match(overview, /组织入驻（Onboard Organization）/);
  assert.match(overview, /准备参与方数据集（Prepare Participant Dataset）/);
  assert.match(overview, /S1 -->\|需要安全聚合\| S2/);

  const svg = renderSimpleMermaidSvg(overview) ?? '';
  assert.match(svg, /Organization）/);
  assert.match(svg, /Dataset）/);
  assert.match(svg, /Management）/);
  assert.match(svg, /<rect[^>]+height="[789]\d"/);
});

test('routes cross-row and backward journey edges through orthogonal corridors', () => {
  const svg = renderSimpleMermaidSvg([
    'flowchart LR',
    '  S1["Start"]', '  S2["Next"]', '  S3["Third"]', '  S4["Fourth"]',
    '  S5["Fifth"]',
    '  S1 --> S2',
    '  S1 --> S4',
    '  S4 --> S1',
    '  S1 --> S5'
  ].join('\n')) ?? '';
  const paths = [...svg.matchAll(/<path d="([^"]+)"[^>]*marker-end/g)].map((match) => match[1]);
  assert.equal(paths.length, 4);
  assert(paths.every((path) => !/\bL\b/.test(path)));
  assert.match(paths[0], /^M [\d.]+ [\d.]+ H [\d.]+$/);
  assert(paths.slice(1).every((path) => / H [\d.]+ V [\d.]+ H [\d.]+ V [\d.]+ H [\d.]+$/.test(path)));
  assert.notEqual(paths[1].match(/ V ([\d.]+) H/)?.[1], paths[2].match(/ V ([\d.]+) H/)?.[1]);
  const portY = (path: string) => Number(path.match(/^M [\d.]+ ([\d.]+)/)?.[1]);
  assert.notEqual(portY(paths[0]), portY(paths[1]));
  assert.notEqual(portY(paths[0]), portY(paths[3]));
  assert.notEqual(portY(paths[1]), portY(paths[3]));
  assert.match(svg, /Start → Fourth/);
  assert.match(svg, /Fourth → Start/);
  assert.match(svg, /marker-end="url\(#arrow-0\)"/);
  assert.match(svg, /marker-end="url\(#arrow-3\)"/);
  assert.match(svg, /marker-end="url\(#arrow\)"/);
});

test('shows unconnected orthogonal crossings as separate lines', () => {
  const svg = renderSimpleMermaidSvg([
    'flowchart LR',
    '  A["First"]', '  B["Second"]', '  C["Third"]', '  D["Fourth"]',
    '  E["Fifth"]', '  F["Sixth"]', '  G["Seventh"]', '  H["Eighth"]',
    '  I["Ninth"]', '  J["Tenth"]', '  K["Eleventh"]', '  L["Twelfth"]', '  M["Thirteenth"]',
    '  A --> D', '  B --> E'
  ].join('\n')) ?? '';
  assert.match(svg, /First → Fourth/);
  assert.match(svg, /Second → Fifth/);
  assert.match(svg, /data-crossing-gap="true"/);
});

test('overall business flow follows declared journey transitions rather than inferred context links', () => {
  const first = {
    ...model.contexts[0], id: 'context/first', name: 'OrganizationManagement', aggregates: [],
    slices: [{ id: 'slice/first', name: 'RegisterOrganization', tags: [], hotspots: [], elements: [
      { id: 'event/registered', kind: 'event' as const, name: 'OrganizationRegistered', fields: [] }
    ] }]
  };
  const second = {
    ...first, id: 'context/second', name: 'RuntimeProvisioning',
    slices: [{ id: 'slice/second', name: 'PlanRuntime', tags: [], hotspots: [], elements: [
      { id: 'command/plan', kind: 'command' as const, name: 'PlanRuntime', fields: [] }
    ] }]
  };
  const independent = { ...first, id: 'context/independent', name: 'DictionaryMaintenance', slices: [] };
  const contexts = [first, second, independent];
  const diagramModel: EmModel = {
    ...model, contexts, domains: [{ ...model.domains[0], contexts }],
    edges: [{ id: 'handoff', source: 'event/registered', target: 'command/plan', label: 'reactsTo' }],
    userJourneys: [{
      id: 'user-journey/Setup', name: 'Setup',
      stages: [
        { id: 'stage/organization', name: 'OnboardOrganization', context: first.name, contextId: first.id },
        { id: 'stage/runtime', name: 'ProvisionRuntime', context: second.name, contextId: second.id },
        { id: 'stage/dictionary', name: 'SeedDictionary', context: independent.name, contextId: independent.id }
      ],
      transitions: [{ source: 'stage/organization', target: 'stage/runtime' }]
    }]
  };
  const markdown = generateDocumentation(diagramModel, 'diagrams', { language: 'zh-CN' }).markdown;
  const overview = markdown.match(/```mermaid\n([\s\S]*?)\n```/)?.[1] ?? '';

  assert.match(overview, /S1\["Onboard Organization<br\/>Organization Management"\]/);
  assert.match(overview, /S2\["Provision Runtime<br\/>Runtime Provisioning"\]/);
  assert.match(overview, /S3\["Seed Dictionary<br\/>Dictionary Maintenance"\]/);
  assert.match(overview, /S1 --> S2/);
  assert.doesNotMatch(overview, /S2 --> S3|S1 --> S3/);
  assert.doesNotMatch(markdown, /业务域职责/);
});

test('generates Chinese installation and user manuals', () => {
  const installationManual = generateDocumentation(
    model,
    'installation-manual',
    { language: 'zh-CN', generatedAt: '2026-08-23T10:00:00.000Z' }
  ).markdown;
  assert.match(installationManual, /# Account Platform 安装部署手册/);
  const installationManualBodyHeadings = (installationManual.match(/^## .+$/gm) ?? [])
    .map((heading) => heading.replace(/^## /, ''))
    .map(normalizeFormalHeading)
    .filter((heading) => heading !== '变更记录');
  assert.deepEqual(installationManualBodyHeadings, [
    '系统说明',
    '部署架构',
    '环境要求',
    '网络与端口',
    '安装前准备',
    '安装步骤',
    '配置说明',
    '初始化',
    '启动与停止',
    '安装验证',
    '升级与回滚',
    '故障排查'
  ]);
  assertFormalHeading(installationManual, '##', '系统说明');
  assert.ok(installationManual.includes(`| 软件版本 | ${medolSoftwareVersion} |`));
  assert.ok(installationManual.includes(`| 手册版本 | ${medolSoftwareVersion} |`));
  assertFormalHeading(installationManual, '##', '部署架构');
  assertFormalHeading(installationManual, '###', '部署拓扑');
  assert.match(installationManual, /```mermaid\nflowchart TB/);
  const topologySource = installationManual.match(/```mermaid\n([\s\S]*?)\n```/)?.[1] ?? '';
  assert.match(topologySource, /User\["用户浏览器"\]/);
  assert.match(topologySource, /Db\["数据库 \/ 事件存储（umadb）"\]/);
  assert.match(topologySource, /User --> Web/);
  assert.doesNotMatch(topologySource, /User\["[^"]+"\]\s*-->\s*Web/);
  assert.match(renderSimpleMermaidSvg(topologySource) ?? '', /<svg\b/);
  assert.ok(installationManual.includes('| 后端 API 服务 | 数据库 / 事件存储（umadb） | 写入事件存储，并读写持久化业务数据和查询数据。 |'));
  assertFormalHeading(installationManual, '##', '环境要求');
  assertFormalHeading(installationManual, '###', '硬件要求');
  assert.ok(installationManual.includes('| 架构 | x86_64 / ARM64 | x86_64 / ARM64 | x86_64 / ARM64 |'));
  assert.doesNotMatch(installationManual, /Linux x86_64|ARM64 支持需单独确认/);
  assertFormalHeading(installationManual, '##', '网络与端口');
  assertFormalHeading(installationManual, '##', '安装前准备');
  assertFormalHeading(installationManual, '###', '安装介质确认');
  assert.ok(installationManual.includes(`account-platform-${medolSoftwareVersion}/`));
  assert.ok(installationManual.includes(`| account-platform-backend | ${medolSoftwareVersion} | SHA256:<...> |`));
  assert.match(installationManual, /\| 准备项 \| 命令 \/ 操作 \| 期望结果 \|/);
  assertFormalHeading(installationManual, '##', '安装步骤');
  assert.match(installationManual, /初始化 umadb 与事件存储结构/);
  assert.match(installationManual, /\| 步骤 \| 操作目的 \| 命令 \| 预期输出 \| 异常处理 \|/);
  assertFormalHeading(installationManual, '##', '配置说明');
  assert.ok(installationManual.includes('| DB_NAME | 是 | umadb | umadb | 统一应用数据库名称，当前固定为 umadb。 |'));
  assertFormalHeading(installationManual, '##', '初始化');
  assertFormalHeading(installationManual, '##', '启动与停止');
  assertFormalHeading(installationManual, '##', '安装验证');
  assert.ok(installationManual.includes('| 事件存储验证 | `psql -h <db_host> -U <user> -d umadb -c "select 1"` | umadb 可连接，并可作为应用事件存储使用。 |'));
  assert.match(installationManual, /\| 验证层级 \| 验证方式 \| 通过标准 \|/);
  assertFormalHeading(installationManual, '##', '升级与回滚');
  assertFormalHeading(installationManual, '##', '故障排查');
  assert.doesNotMatch(installationManual, /## 文档概述|## 系统部署架构|## 安装环境要求|## 网络要求|## 安装介质说明|## 系统安装|## 系统配置|## 系统初始化|## 启动、停止、重启和状态检查|## 常见问题与故障排查|## 系统卸载|## 附录|## 模块部署与初始化|installation-manual\.slice\.RegisterAccount|限界上下文准备运行主机|首次生产启动前准备日志/);

  const userManual = generateDocumentation(
    model,
    'user-manual',
    { language: 'zh-CN', generatedAt: '2026-08-23T10:00:00.000Z' }
  ).markdown;
  assert.match(userManual, /# Account Platform 使用手册/);
  assertFormalHeading(userManual, '##', '角色与权限');
  assertFormalHeading(userManual, '##', '功能操作指南');
  assertFormalHeading(userManual, '####', 'Register Account');
  assert.match(userManual, /\| 命令 \| 字段 \| 类型 \| 填写要求 \| 示例\/规则 \|/);
});

const normalizeFormalHeading = (heading: string): string =>
  heading
    .replace(/\/[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/u, '')
    .replace(/^[零〇一二三四五六七八九十百千万两]+、/u, '')
    .replace(/^\d+(?:\.\d+)*\s+/u, '')
    .trim();

const assertFormalHeading = (markdown: string, hashes: string, title: string): void => {
  assert.match(
    markdown,
    new RegExp(`^${hashes} (?:[零〇一二三四五六七八九十百千万两]+、|\\d+(?:\\.\\d+)* )?${escapeRegExp(title)}(?:/[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*)?$`, 'm')
  );
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('includes editable change log front matter in generated Chinese Markdown', () => {
  for (const kind of ['prd', 'software-design', 'database-design', 'process', 'test-outline', 'user-journey', 'diagrams', 'installation-manual', 'user-manual'] as const) {
    const markdown = generateDocumentation(
      model,
      kind,
      { language: 'zh-CN', generatedAt: '2026-08-23T10:00:00.000Z' }
    ).markdown;

    assert.match(markdown, /<!-- em:section id="document\.changeLog" -->/);
    assert.match(markdown, /## 变更记录/);
    assert.match(markdown, /\| 版本 \| 日期 \| 变更说明 \| 作者 \|/);
    assert.ok(markdown.includes(`| ${medolSoftwareVersion} | 2026-08-23 | 初始发布 | MEDOL |`));
  }
});

test('infers event-driven workflow inputs, emitted commands, and subscribed read models', () => {
  const context: EmModel['contexts'][number] = {
    ...model.contexts[0],
    aggregates: [],
    slices: [
      {
        id: 'slice/pause', name: 'PauseTrainingJob', tags: [], hotspots: [],
        elements: [
          { id: 'command/pause', kind: 'command', name: 'PauseTrainingJob', fields: [] },
          { id: 'event/paused', kind: 'event', name: 'TrainingJobPaused', fields: [] }
        ]
      },
      {
        id: 'slice/dashboard', name: 'TrainingJobDashboard', tags: [], hotspots: [],
        elements: [{ id: 'readmodel/dashboard', kind: 'readmodel', name: 'TrainingJobDashboard', fields: [] }]
      },
      {
        id: 'slice/next-round', name: 'ScheduleNextTrainingRound', tags: [], hotspots: [],
        elements: [{
          id: 'automation/next-round', kind: 'automation', name: 'SelectNextRoundParticipants', fields: [],
          metadata: {
            on: 'TrainingRoundCompleted', condition: 'roundNumber < maxRounds',
            emits: 'SelectTrainingRoundParticipants'
          }
        }]
      }
    ]
  };
  const eventModel: EmModel = {
    ...model,
    contexts: [context],
    domains: [{ ...model.domains[0], contexts: [context] }],
    edges: [{ id: 'edge/paused-dashboard', source: 'event/paused', target: 'readmodel/dashboard', label: 'updates' }]
  };
  const markdown = generateDocumentation(eventModel, 'software-design', { language: 'zh-CN' }).markdown;

  assert.match(markdown, /Pause Training Job[^\n]*Training Job Dashboard/u);
  assert.match(markdown, /输入: Training Round Completed \(条件: roundNumber < maxRounds\)/u);
  assert.match(markdown, /业务结果: 触发提交操作 Select Training Round Participants/u);
  assert.match(markdown, /读侧结果: 本步骤不直接更新查询视图/u);
  assert.match(markdown, /执行条件: roundNumber < maxRounds/u);
  assert.match(markdown, /^- 输入: Training Round Completed \(条件: roundNumber < maxRounds\)。$/mu);
  assert.doesNotMatch(markdown, /^- (?:归属|角色\/触发条件|输入|业务结果|读侧结果):[^\n]*\.$/mu);
});
