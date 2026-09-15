import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseMedolFile } from '../src/lib/medolProject';
import {
  generateDocumentation,
  type DocumentationKind
} from '../src/lib/generators/documentation';
import {
  translateDocumentationModelWithModelTranslations
} from '../src/features/documentation/documentationTranslation';
import type { ModelTranslations } from '../src/features/model-i18n/modelTranslation';

const projectTitle = '“感-通-算”一体化的跨域健康管理联邦孪生平台';
const subsystemName = '联邦学习子系统';
const sourceModelPath = resolve('examples/fl/federation-learning.medol');
const translationPath = resolve('examples/fl/model-translations.zh-CN.json');
const outputDirectory = resolve('tmp/联邦学习子系统文档');
const generatedAt = '2026-08-28T00:00:00.000Z';

const rawModel = parseMedolFile(sourceModelPath);
const translations = readModelTranslations(translationPath);
const supplementalTranslations: ModelTranslations = {
  'Federation Learning Platform': '联邦学习平台',
  'File upload owns short-lived staged file references used by generated forms and backend adapters. Business commands store the stagedFileId returned by this context, not a browser-local file path or storage location.': '文件上传负责管理生成表单和后端适配器使用的短期暂存文件引用。业务命令只保存该上下文返回的暂存文件标识，不保存浏览器本地文件路径或存储位置。',
  'Runtime onboarding owns runtime installation planning, bootstrap configuration, runtime environment registration, agent installation, readiness, connection reporting, and access revocation. K3s, Kubernetes, Docker Compose, and host process runtimes are installation targets, not separate domain concepts.': '运行时接入负责运行时安装规划、启动配置、运行环境登记、代理安装、就绪检查、连接上报和访问撤销。K3s、Kubernetes、Docker Compose 及主机进程运行时属于安装目标，不作为独立领域概念。',
  'Runtime bootstrap and agent installation material is support configuration, not domain state: the platform backend adapter reads platform.runtime.bootstrap.publicBaseAddress, platform.runtime.agent.platformApiBaseAddress, platform.runtime.agent.controlApiBaseAddress, platform.runtime.agent.containerRegistry, platform.runtime.agent.trustBundleSecretName, and platform.runtime.agent.accessGrantSecretPrefix from deployment config or a secret store. Commands, events, and read models keep only runtimeInstallationPlanId, runtimeInfrastructurePackageId, and generated access grant IDs.': '运行时启动与代理安装材料属于支撑配置，不属于领域状态。平台后端适配器从部署配置或密钥存储读取平台访问地址、代理控制地址、容器镜像仓库、信任包密钥名称和访问授权密钥前缀。命令、事件和读模型中仅保留运行时安装计划标识、运行时基础设施包标识和生成的访问授权标识。',
  'Dataset governance separates feature schemas, platform-recorded runtime dataset metadata, dataset access validation evidence, and train evaluation bundles. Runtime agents own dataset declarations, data connectors, local access profiles, and credentials inside participant infrastructure.': '数据集治理区分特征模式、平台记录的运行时数据集元数据、数据集访问校验证据和训练评估包。运行时代理在参与方基础设施内负责数据集声明、数据连接器、本地访问配置和凭证。',
  'Model repository owns model identity and immutable, pullable model artifact locations used by training orchestration and runtime agents.': '模型仓库负责模型标识，以及训练编排和运行时代理使用的不可变、可拉取模型构件位置。',
  'Training orchestration owns job intent, participant eligibility, runtime dispatch, and each round of distributed training and evaluation.': '训练编排负责训练作业意图、参与方资格、运行时分发，以及每轮分布式训练和评估。',
  'Model lifecycle starts after training has produced a final evaluated candidate.': '模型生命周期从训练产出完成评估的候选模型后开始。',
  'Runtime operations separates low-frequency runtime state changes, node inventory changes, latest telemetry views, training alerts, and append only audit records. High-frequency heartbeat and resource samples are telemetry, not event-sourced domain events.': '运行时运维区分低频运行时状态变化、节点清单变化、最新遥测视图、训练告警和追加式审计记录。高频心跳和资源采样属于遥测数据，不作为事件溯源领域事件。',
  'Runtime governance owns stable RuntimeIdentity activation, capability detection, and revocation. Runtime private keys, local paths, credentials, node scheduling, and data-plane connectivity stay inside participant runtime infrastructure.': '运行时治理负责稳定运行时身份的激活、能力探测和撤销。运行时私钥、本地路径、凭证、节点调度和数据平面连接保留在参与方运行时基础设施内。',
  'Platform-managed runtime agents are activated from platform deployment outcomes. Network reachability is not business authorization. Training eligibility uses active federation membership, RuntimeIdentity, detected capabilities, connected runtime status, and dataset readiness.': '平台托管运行时代理由平台部署结果激活。网络可达不等同于业务授权。训练资格依据有效联邦成员关系、运行时身份、已探测能力、运行时连接状态和数据集就绪状态判断。',
  'Training parameter encryption, secure aggregation keys, and data-plane message encryption are handled by protocol adapters or SecureAggregation, not by RuntimeIdentity events.': '训练参数加密、安全聚合密钥和数据平面消息加密由协议适配器或安全聚合能力处理，不由运行时身份事件处理。',
  'Secure aggregation owns homomorphic-encryption-based aggregation sessions. The platform owns the private key and publishes only encryption context metadata to runtime agents; raw key material, public key documents, and storage locations stay in SecureAggregationService or KMS adapter configuration.': '安全聚合负责基于同态加密的聚合会话。平台持有私钥，仅向运行时代理发布加密上下文元数据；原始密钥材料、公钥文档和存储位置保留在安全聚合服务或 KMS 适配器配置中。',
  'Runtime agent operations is a separate deployable that runs inside participant infrastructure and executes dispatched training jobs with local data and local secrets.': '运行时代理操作是部署在参与方基础设施内的独立单元，使用本地数据和本地密钥执行下发的训练任务。',
  'API': '接口',
  'MLOps': '机器学习运维',
  'MLOps Engineer': '机器学习运维工程师',
  'Read Model': '读模型',
  'String': '文本',
  'UUID': '唯一标识',
  'Int': '整数',
  'Decimal': '小数',
  'Boolean': '布尔值',
  'DateTime': '日期时间',
  'Single': '单条',
  'Optional': '可选',
  'technical': '技术',
  'generated': '生成',
  'emits': '产生',
  'automation': '自动化',
  'event': '事件',
  'onKind': '触发类型',
  'unspecified': '未指定',
  'id': '标识',
  'File Upload': '文件上传',
  'Runtime Provisioning': '运行时预配',
  'Training Orchestration': '训练编排',
  'Model Lifecycle': '模型生命周期',
  'Runtime Monitoring': '运行时监控',
  'Runtime Governance': '运行时治理',
  'Secure Aggregation': '安全聚合',
  'Runtime Agent Operations': '运行时代理操作',
  'Register Runtime Infrastructure Package': '注册运行时基础设施包',
  'Plan Runtime Infrastructure': '规划运行时基础设施',
  'Verify Runtime Infrastructure': '验证运行时基础设施',
  'Deploy Runtime Agent': '部署运行时代理',
  'Retry Runtime Agent Deployment': '重试运行时代理部署',
  'Activate Runtime Identity': '激活运行时身份',
  'Record Model Evaluation Package': '记录模型评估包',
  'Approve Model': '批准模型',
  'Stage File Upload': '暂存文件上传',
  'Discard Staged File': '丢弃暂存文件',
  'Mark Staged File Consumed': '标记暂存文件已消费',
  'Define Training Run Configuration': '定义训练运行配置',
  'Update Training Run Configuration': '更新训练运行配置',
  'Pause Training Job': '暂停训练作业',
  'Resume Training Job': '恢复训练作业',
  'Create Training Job': '创建训练作业',
  'Submit Training Job': '提交训练作业',
  'Retry Training Round Participant Selection': '重试训练轮次参与方选择',
  'Submit Model Update Submission': '提交模型更新',
  'Detect Runtime Capabilities': '探测运行时能力',
  'Validate Agent Dataset Access': '校验代理数据集访问',
  'Profile Agent Dataset': '代理数据集画像分析',
  'Load Runtime Agent Bootstrap Configuration': '加载运行时代理启动配置',
  'Report Runtime Agent Started': '上报运行时代理已启动',
  'Report Runtime Instance Self Check Passed': '上报运行时实例自检通过',
  'Fail Training Round': '标记训练轮次失败',
  'Promote Model To Production': '发布模型至生产',
  'Rollback Model': '回滚模型',
  'Retire Model': '退役模型',
  'Revoke Runtime Identity': '撤销运行时身份',
  'Complete Homomorphic Aggregation Session': '完成同态聚合会话',
  'Fail Secure Aggregation Session': '标记安全聚合会话失败',
  'Declare Dataset': '声明数据集',
  'Retry Dataset Contract Validation': '重试数据集契约校验',
  'Configure Runtime Dataset Binding': '配置运行时数据集绑定',
  'Revalidate Agent Dataset Access': '重新校验代理数据集访问',
  'Reprofile Agent Dataset': '重新分析代理数据集画像',
  'Runtime Infrastructure Package Catalog Screen': '运行时基础设施包目录页面',
  'Training Run Configuration Screen': '训练运行配置页面',
  'Training Operations Screen': '训练操作页面',
  'Training Job Creation Screen': '训练作业创建页面',
  'Training Submission Screen': '训练提交页面',
  'Model Approval Screen': '模型审批页面',
  'Model Release Screen': '模型发布页面',
  'Runtime Identity Screen': '运行时身份页面',
  'Runtime Dataset Binding Screen': '运行时数据集绑定页面',
  'Platform User': '平台用户',
  'Platform Service': '平台服务',
  'Training Operator': '训练操作员',
  'Agent': '代理',
  'Access': '访问',
  'Runtime': '运行时',
  'Model': '模型',
  'Session': '会话',
  'Package': '包',
  'Binding': '绑定',
  'Version': '版本',
  'Dashboard': '看板',
  'Submit': '提交',
  'Retry': '重试',
  'Record': '记录',
  'Mark': '标记',
  'Create': '创建',
  'Define': '定义',
  'Update': '更新',
  'Pause': '暂停',
  'Resume': '恢复',
  'Acknowledge': '确认',
  'Resolve': '解决',
  'Detect': '探测',
  'Validate': '校验',
  'Profile': '画像分析',
  'Load': '加载',
  'Report': '上报',
  'Fail': '失败处理',
  'Promote': '发布',
  'Rollback': '回滚',
  'Retire': '退役',
  'Revoke': '撤销',
  'Prepare': '准备',
  'Declare': '声明',
  'Configure': '配置',
  'Revalidate': '重新校验',
  'Reprofile': '重新画像分析',
  'Participants': '参与方',
  'Completed': '已完成',
  'Approved': '已批准',
  'Rejected': '已拒绝',
  'Connected': '已连接',
  'Draft': '草稿',
  'Planned': '已规划',
  'Validated': '已校验',
  'Recovered': '已恢复',
  'Started': '已启动',
  'Expired': '已过期',
  'Consumed': '已消费',
  'Failed': '失败',
  'Staged File': '暂存文件',
  'Runtime Identity': '运行时身份',
  'Runtime Capability': '运行时能力',
  'Runtime Health': '运行时健康',
  'Training Job': '训练作业',
  'Training Run Configuration': '训练运行配置',
  'Training Alert': '训练告警',
  'Training Round': '训练轮次',
  'Participant Selection': '参与方选择',
  'Round Execution': '轮次执行',
  'Execution Plan': '执行计划',
  'Model Update Submission': '模型更新提交',
  'Agent Local Model Update': '代理本地模型更新',
  'Contract Validation': '契约校验',
  'Bootstrap Configuration': '启动配置',
  'Feature Schema': '特征模式',
  'Runtime Capabilities': '运行时能力',
  'Runtime Instance': '运行时实例',
  'Runtime Engine Job': '运行时引擎作业',
  'Engine Job': '引擎作业',
  'Node Inventory': '节点清单',
  'Node Inventory Reported': '节点清单已上报',
  'Metadata Catalog': '元数据目录',
  'Reprofiled Metadata': '重新画像元数据',
  'Homomorphic Encryption Context': '同态加密上下文',
  'Encrypted Model Update': '加密模型更新',
  'Complete Homomorphic Aggregation': '完成同态聚合',
  'To Production': '至生产',
  'After Start Failure': '启动失败后',
  'After Runtime Failure': '运行时失败后',
  'After': '后',
  'Outcome': '结果',
  'Screen': '页面',
  'Dialog': '对话框',
  'Confirm': '确认',
  'Catalog': '目录',
  'Submission': '提交',
  'Deployment': '部署',
  'Release': '发布',
  'Evaluation': '评估',
  'Validation': '校验',
  'Selected': '已选择',
  'Created': '已创建',
  'Submitted': '已提交',
  'Received': '已接收',
  'Reported': '已上报',
  'Profiling': '画像分析',
  'Failure': '失败',
  'Connection': '连接',
  'Connection Established': '连接已建立',
  'Instance Self Check Passed': '实例自检通过',
  'Current Recommended': '当前推荐',
  'Global': '全局',
  'Stage': '暂存',
  'Discard': '丢弃',
  'Approve': '批准',
  'Select': '选择',
  'Request': '请求',
  'Complete': '完成',
  'Generate Participant Execution Plan': '生成参与方执行计划',
  'Dispatch Participant Execution Plan': '分发参与方执行计划',
  'Receive Participant Execution Plan': '接收参与方执行计划',
  'Accept Execution Plan': '接受执行计划',
  'Start Round Execution': '启动轮次执行',
  'Observe Runtime Engine Job': '观测运行时引擎作业',
  'Complete Round Execution': '完成轮次执行',
  'Evaluate Model Update Submission': '评估模型更新提交',
  'Start Training Round': '启动训练轮次',
  'Complete Training Round': '完成训练轮次',
  'Record Runtime': '记录运行时',
  'Configure Runtime': '配置运行时',
  'Validate Agent': '校验代理',
  'Revalidate Agent': '重新校验代理',
  'Profile Agent': '代理画像分析',
  'Reprofile Agent': '重新代理画像分析',
  'Report Runtime Instance': '上报运行时实例',
  'Prepare Homomorphic Encryption Context': '准备同态加密上下文',
  'Record Encrypted Model Update': '记录加密模型更新',
  'Retry Round Execution After Start Failure': '启动失败后重试轮次执行',
  'Retry Round Execution After Runtime Failure': '运行时失败后重试轮次执行',
  'Staged File Catalog': '暂存文件目录',
  'Runtime Infrastructure Package Catalog': '运行时基础设施包目录',
  'Runtime Agent Endpoint Catalog': '运行时代理端点目录',
  'Runtime Dataset Metadata Catalog': '运行时数据集元数据目录',
  'Training Run Configuration Catalog': '训练运行配置目录',
  'Training Job Dashboard': '训练作业看板',
  'Training Round Progress': '训练轮次进度',
  'Runtime Telemetry Latest': '最新运行时遥测',
  'Runtime Node Resource Latest': '最新运行时节点资源',
  'Agent Runtime Telemetry Latest': '最新代理运行时遥测',
  'Agent Runtime Node Resource Latest': '最新代理运行时节点资源'
};
const model = translateDocumentationModelWithModelTranslations(rawModel, translations);
const localizationDictionary = buildLocalizationDictionary({
  ...supplementalTranslations,
  ...translations
});

const prd = documentBody('prd');
const softwareDesign = documentBody('software-design');
const databaseDesign = documentBody('database-design');
const userManual = documentBody('user-manual');
const installationManual = documentBody('installation-manual');

mkdirSync(outputDirectory, { recursive: true });

writeMarkdown(
  '项目文档标题结构.md',
  [
    `# ${projectTitle} 项目文档标题结构对照`,
    '',
    '该文件记录 `tmp/项目文档` 下现有 Word 文档的主标题结构，用于后续把两个子系统内容合并到同一标题体系下。',
    '',
    '## 3.1 需求规格说明',
    '',
    '- 1 范围',
    '- 1.1 标识',
    '- 1.2 系统概述',
    '- 1.3 文档概述',
    '- 2 引用文档',
    '- 3 需求',
    '- 3.1 要求的状态和方式',
    '- 3.2 软件配置项总体需求',
    '- 3.2.4 能力需求',
    '',
    '## 3.2 软件设计说明',
    '',
    '项目文档目录中暂未提供软件设计说明，临时按常见软件设计说明结构生成：范围、引用文档、总体设计、详细设计、接口与集成设计、数据与追踪性。',
    '',
    '## 3.3 数据库设计说明',
    '',
    '- 范围',
    '- 引用文档',
    '- 数据库级设计决策',
    '- 数据库详细设计',
    '- 用于数据库访问或操纵的软件单元的详细设计',
    '- 需求可追踪性',
    '- 注释',
    '- 附录',
    '',
    '## 3.4 用户操作手册',
    '',
    '- 1 范围',
    '- 2 引用文档',
    '- 3 软件综述',
    '- 4 软件入门',
    '- 5 使用指南',
    '',
    '## 3.5 安装部署手册',
    '',
    '- 系统要求',
    '- 常用软件安装',
    '- 系统部署安装'
  ].join('\n')
);

writeMarkdown(
  `3.1-${projectTitle}-需求规格说明-${subsystemName}.md`,
  [
    `# ${projectTitle} 需求规格说明`,
    '',
    '## 1 范围',
    '',
    '### 1.1 标识',
    '',
    `本文档补充描述${subsystemName}的需求内容，用于后续与孪生数字人子系统内容合并形成平台级需求规格说明。`,
    '',
    '### 1.2 系统概述',
    '',
    `平台包含孪生数字人子系统与${subsystemName}。${subsystemName}围绕组织、联邦、数据集、模型、训练编排、运行时代理、安全聚合与运行时治理能力，支撑跨机构数据不出域条件下的协同建模。`,
    '',
    '### 1.3 文档概述',
    '',
    '本转化稿仅包含联邦学习相关内容。平台公共背景、标准引用、签署页、术语总表等内容建议在最终合并稿中统一维护。',
    '',
    '## 2 引用文档',
    '',
    '本节建议沿用平台级引用文档，不按子系统重复拆分。',
    '',
    '## 3 需求',
    '',
    '### 3.1 要求的状态和方式',
    '',
    `#### ${subsystemName}`,
    '',
    '联邦学习相关业务对象通过建模中定义的状态流转表达，包括组织、联邦、参与方、数据集、训练作业、训练轮次、模型、运行时代理和安全聚合会话等对象的生命周期状态。',
    '',
    '### 3.2 软件配置项总体需求',
    '',
    `#### ${subsystemName}`,
    '',
    demote(prd, 2)
  ].join('\n')
);

writeMarkdown(
  `3.2-${projectTitle}-软件设计说明-${subsystemName}.md`,
  [
    `# ${projectTitle} 软件设计说明`,
    '',
    '## 1 范围',
    '',
    `本文档补充描述${subsystemName}的软件设计内容，用于后续合并到平台级软件设计说明。`,
    '',
    '## 2 引用文档',
    '',
    '本节建议沿用平台级引用文档，不按子系统重复拆分。',
    '',
    '## 3 总体设计',
    '',
    `### ${subsystemName}`,
    '',
    '联邦学习子系统采用事件建模方式组织业务能力，以业务上下文、聚合/概念、命令、事件、读模型和自动化处理器表达核心业务设计。',
    '',
    '## 4 详细设计',
    '',
    `### ${subsystemName}`,
    '',
    demote(softwareDesign, 2),
    '',
    '## 5 接口与集成设计',
    '',
    '接口、外部系统和运行时代理交互以软件设计正文中的集成设计、能力设计和自动化处理说明为准。',
    '',
    '## 6 数据与追踪性',
    '',
    '数据视图、事件来源和能力追踪关系可与数据库设计说明、需求规格说明交叉引用。'
  ].join('\n')
);

writeMarkdown(
  `3.3-${projectTitle}-数据库设计说明-${subsystemName}.md`,
  [
    `# ${projectTitle} 数据库设计说明`,
    '',
    '## 范围',
    '',
    `本文档补充描述${subsystemName}的数据模型和数据库设计内容，用于后续合并到平台级数据库设计说明。`,
    '',
    '## 引用文档',
    '',
    '本节建议沿用平台级引用文档，不按子系统重复拆分。',
    '',
    '## 数据库级设计决策',
    '',
    `### ${subsystemName}`,
    '',
    '联邦学习子系统的数据设计以事件、业务状态、查询读模型和运行时反馈数据为核心。物理数据库产品、部署拓扑、备份恢复和安全策略建议在平台级数据库设计中统一描述。',
    '',
    '## 数据库详细设计',
    '',
    `### ${subsystemName}`,
    '',
    demote(databaseDesign, 2),
    '',
    '## 用于数据库访问或操纵的软件单元的详细设计',
    '',
    `### ${subsystemName}`,
    '',
    '数据库访问单元与各业务上下文中的命令处理、事件处理、读模型更新和自动化处理器对应。',
    '',
    '## 需求可追踪性',
    '',
    '需求到数据对象的追踪关系可通过需求规格说明中的能力、数据库设计中的读模型和事件来源共同建立。',
    ''
  ].join('\n')
);

writeMarkdown(
  `3.4-${projectTitle}-用户操作手册-${subsystemName}.md`,
  [
    `# ${projectTitle} 用户操作手册`,
    '',
    '## 1 范围',
    '',
    `本文档补充描述${subsystemName}的用户角色、入口、操作流程、数据视图和异常处理建议，用于后续合并到平台级用户操作手册。`,
    '',
    '## 2 引用文档',
    '',
    '本节建议沿用平台级引用文档，不按子系统重复拆分。',
    '',
    '## 3 软件综述',
    '',
    `### ${subsystemName}`,
    '',
    '联邦学习子系统面向平台管理员、联邦负责人、治理审核员、数据负责人、节点操作员、训练操作员、MLOps 工程师、安全审核员、运行时代理等角色提供协同建模相关操作能力。',
    '',
    '## 4 软件入门',
    '',
    `### ${subsystemName}`,
    '',
    '用户进入系统后应根据角色权限访问对应菜单、页面和数据视图。首次使用时建议先完成组织、联邦、运行时基础设施、数据集和特征模式等基础配置。',
    '',
    '## 5 使用指南',
    '',
    `### ${subsystemName}`,
    '',
    demote(userManual, 2)
  ].join('\n')
);

writeMarkdown(
  `3.5-${projectTitle}-安装部署手册-${subsystemName}.md`,
  [
    `# ${projectTitle} 安装部署手册`,
    '',
    '## 系统要求',
    '',
    `### ${subsystemName}`,
    '',
    '联邦学习子系统部署涉及 Web 前端、后端 API 服务、数据库/事件存储、对象或文件存储、任务调度/消息通道和运行时代理。基础操作系统、网络、证书、容器运行时和数据库要求建议在平台级安装部署手册中统一维护。',
    '',
    '## 常用软件安装',
    '',
    '本节建议沿用平台级基础软件安装说明，不按子系统重复拆分。联邦学习子系统如需额外运行时、代理或模型仓库依赖，可在最终合并稿中补充。',
    '',
    '## 系统部署安装',
    '',
    `### ${subsystemName}`,
    '',
    demote(installationManual, 2)
  ].join('\n')
);

writeMarkdown(
  'README.md',
  [
    `# ${subsystemName}临时转化说明`,
    '',
    `源模型：\`${sourceModelPath}\``,
    '',
    `术语表：\`${translationPath}\``,
    '',
    '输出说明：',
    '',
    '- 本目录内容是临时转换稿，只用于后续与 `tmp/项目文档` 下的联邦孪生平台 Word 文档合并。',
    '- 转换稿只包含联邦学习子系统内容，没有写入正式文档生成逻辑。',
    '- 平台公共章节，如签署页、引用文档、公共术语、基础环境要求，建议最终合并时统一维护。',
    '- 子系统相关章节已使用“联邦学习子系统”作为合并锚点，后续可在同级补充“孪生数字人子系统”。',
    '',
    '生成文件：',
    '',
    '- `3.1-...-需求规格说明-联邦学习子系统.md`',
    '- `3.2-...-软件设计说明-联邦学习子系统.md`',
    '- `3.3-...-数据库设计说明-联邦学习子系统.md`',
    '- `3.4-...-用户操作手册-联邦学习子系统.md`',
    '- `3.5-...-安装部署手册-联邦学习子系统.md`',
    '- `项目文档标题结构.md`'
  ].join('\n')
);

console.log(`Generated federation learning subsystem documents in ${outputDirectory}`);

function documentBody(kind: DocumentationKind): string {
  const body = stripGeneratedDocumentChrome(
    generateDocumentation(model, kind, {
      language: 'zh-CN',
      generatedAt
    }).markdown
  );
  if (kind === 'prd') return stripPrdReviewOnlySections(body);
  if (kind === 'software-design') return replaceSoftwareQualitySection(body);
  return body;
}

function readModelTranslations(path: string): ModelTranslations {
  const content = JSON.parse(readFileSync(path, 'utf8')) as {
    translations?: Record<string, ModelTranslations>;
  };
  return content.translations?.['zh-CN'] ?? {};
}

function writeMarkdown(filename: string, markdown: string): void {
  writeFileSync(join(outputDirectory, filename), `${localizeBareEnglish(markdown).trim()}\n`, 'utf8');
}

function stripGeneratedDocumentChrome(markdown: string): string {
  return markdown
    .replace(/^# .+\n+/u, '')
    .replace(/<!-- em:section id="document\.toc" -->\n## 目录\n\n[\s\S]*?(?=<!-- em:section id="document\.changeLog" -->|## [一二三四五六七八九十])/u, '')
    .replace(/<!-- em:section id="document\.changeLog" -->\n## 变更记录\n\n\|[\s\S]*?(?=<!-- em:section id="(?!document\.)|## [一二三四五六七八九十])/u, '')
    .replace(/^## 变更记录\n\n\|[\s\S]*?(?=<!-- em:section id="(?!document\.)|## [一二三四五六七八九十])/mu, '')
    .replace(/^\s*<!--\s*em:section\b[^>]*-->\s*$/gmu, '')
    .trim();
}

function stripPrdReviewOnlySections(markdown: string): string {
  return markdown
    .replace(/\n+\*\*已建模产品指标\*\*\n\n(?:- .+\n)+/u, '\n')
    .replace(/\n+## 十三、待确认事项[^\n]*\n[\s\S]*$/u, '')
    .trim();
}

function replaceSoftwareQualitySection(markdown: string): string {
  const replacement = [
    '## 五、质量属性、运维与可观测性设计/FLP-SD-SECTION-80',
    '',
    '### 5.1 质量属性设计',
    '',
    '- 可用性：联邦学习子系统应保证平台管理端、训练编排服务、运行时代理连接和关键读模型在正常部署条件下稳定可用。',
    '- 一致性：命令处理、事件记录、读模型更新和自动化处理应保持可追踪关系，关键业务状态不得出现无法解释的跳变。',
    '- 安全性：组织、联邦、数据集、模型、运行时身份和安全聚合相关操作应执行角色权限、租户边界和敏感数据保护控制。',
    '- 可扩展性：训练任务、训练轮次、参与方运行时、数据集和模型构件应支持按业务规模扩展。',
    '- 可维护性：业务能力按上下文拆分，命令、事件、读模型和自动化处理器保持清晰边界，便于后续扩展和问题定位。',
    '',
    '### 5.2 运维设计',
    '',
    '- 服务状态：运维侧应能查看前端、后端服务、数据库、对象存储、消息或调度组件、运行时代理的启动状态和健康状态。',
    '- 任务处理：训练编排、轮次执行、安全聚合、模型评估和运行时回调应具备失败记录、重试处理和人工排查入口。',
    '- 审计追踪：联邦激活、参与方加入、数据集审批、训练提交、模型发布、运行时身份变更等关键操作应形成审计记录。',
    '- 配置管理：运行时安装计划、代理启动配置、访问授权、镜像仓库和信任包等配置应支持变更留痕和回滚。',
    '- 故障恢复：训练任务失败、运行时离线、节点资源压力、代理连接失败和安全聚合失败应提供明确的恢复路径。',
    '',
    '### 5.3 可观测性设计',
    '',
    '| 观测对象 | 观测内容 | 处理建议 |',
    '| --- | --- | --- |',
    '| 平台服务 | 服务启动、接口错误、任务积压、数据库连接状态 | 接入日志、指标和告警，异常时定位到服务实例和请求链路。 |',
    '| 训练任务 | 作业状态、轮次状态、参与方选择、模型更新、评估结果 | 在训练作业看板中展示关键状态，并保留异常原因。 |',
    '| 运行时代理 | 代理启动、自检、连接状态、数据集访问、运行时执行结果 | 通过运行时健康视图和代理生命周期视图进行跟踪。 |',
    '| 节点资源 | 节点清单、处理器、内存、存储、资源压力 | 资源压力触发告警，并关联受影响训练任务。 |',
    '| 安全聚合 | 会话创建、参与方选择、加密上下文、聚合完成或失败 | 聚合失败时记录缺失参与方、加密上下文和失败阶段。 |',
    '',
    '### 5.4 关键运维指标',
    '',
    '- 运行时连接成功率',
    '- 训练轮次完成时延',
    '- 训练作业失败率',
    '- 运行时代理任务启动时延',
    '- 数据集契约校验失败率',
    '- 模型构件拉取失败率',
    '- 安全聚合完成时延',
    '- 告警平均确认时间',
    '- 审计记录完整率',
    ''
  ].join('\n');

  return markdown.replace(
    /\n+## 五、质量属性、运维与可观测性设计[^\n]*\n[\s\S]*?(?=\n+## 六、实现缺口)/u,
    `\n\n${replacement}\n`
  );
}

function demote(markdown: string, levels: number): string {
  return markdown.replace(/^(#{1,6}) /gmu, (_match, hashes: string) =>
    `${'#'.repeat(Math.min(6, hashes.length + levels))} `
  );
}

function buildLocalizationDictionary(source: ModelTranslations): Array<[string, string]> {
  return Object.entries(source)
    .filter(([english, chinese]) =>
      /[A-Za-z]/u.test(english)
      && Boolean(chinese.trim())
      && chinese.trim() !== english
      && !/ is required$|^Enter |^Select /u.test(english)
    )
    .sort((left, right) => right[0].length - left[0].length);
}

function localizeBareEnglish(markdown: string): string {
  const parts = markdown.split(/(（[^）]*）)/u);
  const protectedReplacements: string[] = [];
  return parts.map((part) => {
    if (part.startsWith('（') && part.endsWith('）')) return part;
    let localized = part;
    for (const [english, chinese] of localizationDictionary) {
      const replacement = english.includes('.') || english.length > 80 ? chinese : `${chinese}（${english}）`;
      const pattern = new RegExp(`(^|[^（A-Za-z0-9_])${escapeRegExp(english)}($|[^）A-Za-z0-9_])`, 'gu');
      localized = localized.replace(pattern, (_match, prefix: string, suffix: string) =>
        `${prefix}${protectReplacement(replacement, protectedReplacements)}${suffix}`
      );
    }
    return localized;
  }).join('').replace(/@@MEDOL_PROTECTED_REPLACEMENT_(\d+)@@/gu, (_match, index: string) =>
    protectedReplacements[Number(index)] ?? ''
  );
}

function protectReplacement(value: string, protectedReplacements: string[]): string {
  const index = protectedReplacements.push(value) - 1;
  return `@@MEDOL_PROTECTED_REPLACEMENT_${index}@@`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
