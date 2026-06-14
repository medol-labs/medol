import type { DocumentationKind } from './documentationModel';

export const localizeDocumentationMarkdown = (
  markdown: string,
  kind: DocumentationKind
): string => {
  const replacements: Array<[string, string]> = [
    ['Software Design', '软件设计'],
    ['Read Model Database Design', 'Read Model 数据库设计'],
    ['Business Process', '业务流程'],
    ['Architecture Overview', '架构概述'],
    ['Bounded Contexts', '限界上下文'],
    ['Aggregate Design', '聚合设计'],
    ['Application Flows', '应用流程'],
    ['UI Composition', '页面与交互'],
    ['Automation And Integration', '自动化与集成'],
    ['Quality Attributes And Decisions', '质量属性与设计决策'],
    ['Implementation Gaps', '实现缺口'],
    ['Design Scope', '设计范围'],
    ['Read Model Inventory', 'Read Model 清单'],
    ['Logical Schema', '逻辑结构'],
    ['Keys And Access Paths', '主键与访问路径'],
    ['Update Semantics', '更新语义'],
    ['Cross-Cutting Database Decisions', '数据库通用决策'],
    ['End-To-End Overview', '端到端流程概览'],
    ['Process Risks And Open Questions', '流程风险与待确认事项'],
    [' Process', ' 流程'],
    ['Bounded context:', '限界上下文：'],
    ['Lifecycle:', '生命周期：'],
    ['Capabilities:', '业务能力：'],
    ['Owner:', '归属：'],
    ['Logical shape:', '逻辑形态：'],
    ['Updated by:', '订阅事件：'],
    ['Aggregate:', '聚合：'],
    ['Acceptance scenarios:', '验收场景：'],
    ['Collection', '集合/列表'],
    ['Single record', '单条记录'],
    ['Not explicitly modeled', '尚未明确'],
    ['No UI views are explicitly modeled.', '尚未明确页面视图。'],
    ['No structural gaps were detected.', '未检测到结构性缺口。'],
    ['No process risks or open questions are explicitly modeled.', '尚未明确流程风险或待确认事项。'],
    ['MEDOL contains diagnostics. Treat affected sections as incomplete until these are resolved.', '当前领域模型存在诊断错误；相关章节在问题修复前应视为不完整。']
  ];

  let localized = markdown;
  for (const [source, target] of replacements) {
    localized = localized.split(source).join(target);
  }

  const tableReplacements: Array<[string, string]> = [
    ['| Context | Domain | Aggregates | Notes |', '| 限界上下文 | 业务领域 | 聚合 | 说明 |'],
    ['| Context | Aggregate | Capability | Input | Result | Read Side | Trigger |', '| 限界上下文 | 聚合 | 业务能力 | 输入 | 结果 | 读模型 | 触发者 |'],
    ['| View | Interaction | Capability | Command | Read Model |', '| 页面 | 交互类型 | 业务能力 | 命令 | Read Model |'],
    ['| Read Model | Context | Aggregate | Shape | Source Events |', '| Read Model | 限界上下文 | 聚合 | 形态 | 来源事件 |'],
    ['| Field | Type | Cardinality | Attributes | Example | Source / Derivation |', '| 字段 | 类型 | 数量 | 属性 | 示例 | 来源/计算规则 |'],
    ['| Step | Actor / Trigger | Interaction | Command | Event / State | Read Model | Rules |', '| 步骤 | 角色/触发条件 | 交互 | 命令 | 事件/状态 | Read Model | 规则 |']
  ];
  for (const [source, target] of tableReplacements) {
    localized = localized.split(source).join(target);
  }

  if (kind === 'software-design') {
    localized = localized.replace(
      'The system is organized around bounded contexts, event-driven aggregate workflows, read models, policies, automations, and external integrations.',
      '系统按照限界上下文组织，以事件驱动的聚合流程为写侧，以 Read Model 为读侧，并结合策略、自动化和外部集成。'
    );
  }
  if (kind === 'database-design') {
    localized = localized.replace(
      'This document describes the read-side data model inferred from Event Modeling read models. Storage engines, physical table names, retention, and consistency SLAs remain implementation decisions unless explicitly stated.',
      '本文档描述由 Event Modeling Read Model 推导出的读侧数据模型。除非领域模型明确说明，否则存储引擎、物理表名、数据保留策略和一致性 SLA 均属于后续实现决策。'
    );
  }

  return localized;
};
