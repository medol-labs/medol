import type { GeneratedDocumentation } from '../../lib/generators/documentation';
import type { AgentUsage } from '../agent-chat/agentUsage';
import {
  requestDocumentationReview,
  type DocumentationReviewRequest,
  type DocumentationReviewResult
} from './documentationReviewProvider';

export interface DocumentationAgentResult {
  markdown: string;
  enhanced: boolean;
  usage?: AgentUsage;
  warning?: string;
}

export const userJourneyClarificationPrompt = [
  'Review a modeled user journey using only the supplied source facts.',
  'Identify missing actor goals, handoffs, visible outcomes, and exception paths.',
  'Do not invent behavior; return review suggestions for human approval.'
].join('\n');

export const enhanceDocumentationWithAgent = async (
  document: GeneratedDocumentation,
  requestReview: (input: DocumentationReviewRequest) => Promise<DocumentationReviewResult> = requestDocumentationReview
): Promise<DocumentationAgentResult> => {
  const evidence = selectDocumentationEvidence(document);
  if (!evidence.length) return { markdown: document.markdown, enhanced: false };

  const review = await requestReview({
    kind: document.kind,
    language: document.language,
    title: document.title,
    excerpt: document.markdown.slice(0, 9000),
    evidence
  });
  if (!review.items) {
    return {
      markdown: document.markdown,
      enhanced: false,
      ...(review.warning ? { warning: review.warning } : {}),
      ...(review.usage ? { usage: review.usage } : {})
    };
  }

  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const validItems = review.items
    .filter((item) => evidenceById.has(item.sourceId) && item.suggestion.trim())
    .slice(0, 8);
  if (!validItems.length) {
    return {
      markdown: document.markdown,
      enhanced: false,
      warning: document.language === 'zh-CN'
        ? 'AI 审校结果没有可核对的模型依据，未写入文档。'
        : 'AI review had no verifiable source references; the document was left unchanged.',
      ...(review.usage ? { usage: review.usage } : {})
    };
  }

  const zh = document.language === 'zh-CN';
  const lines = [
    '<!-- em:section id="document.aiReview" -->',
    `## ${zh ? 'AI 辅助审校建议（待人工确认）' : 'AI-assisted review suggestions (pending human approval)'}`,
    '',
    zh
      ? '以下为部分来源事项的抽样审校建议，不能代替已确认的需求、设计或部署事实。'
      : 'These suggestions review a sample of source items and do not replace approved requirements, design, or deployment facts.',
    ''
  ];
  for (const item of validItems) {
    const source = evidenceById.get(item.sourceId)!;
    lines.push(`- **${escapeReviewText(source.label)}**：${escapeReviewText(item.suggestion)}`);
  }
  return {
    markdown: `${document.markdown.trimEnd()}\n\n${lines.join('\n')}\n`,
    enhanced: true,
    ...(review.usage ? { usage: review.usage } : {}),
    ...(review.warning ? { warning: review.warning } : {})
  };
};

const escapeReviewText = (value: string): string => value.trim()
  .replace(/\s+/g, ' ')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

const selectDocumentationEvidence = (
  document: GeneratedDocumentation
): DocumentationReviewRequest['evidence'] => {
  const { bundle, kind } = document;
  const workflowItems = bundle.workflows.map((workflow) => ({
    id: workflow.id,
    label: workflow.slice,
    facts: JSON.stringify({
      context: workflow.context,
      actor: workflow.actor,
      commands: workflow.commands.map((item) => item.name),
      events: workflow.events.map((item) => item.name),
      specifications: workflow.specifications.map((item) => ({
        name: item.name,
        rule: item.rule,
        given: item.given,
        when: item.when,
        then: item.then,
        reject: item.reject,
        error: item.error
      })),
      resultingState: workflow.resultingState
    }).slice(0, 1200)
  }));
  const contextItems = bundle.contexts.map((context) => ({
    id: context.id,
    label: context.name,
    facts: JSON.stringify({
      notes: context.notes,
      risks: context.risks,
      decisions: context.decisions,
      aggregates: context.aggregates.map((item) => item.name)
    }).slice(0, 1200)
  }));
  const readModelItems = bundle.readmodels.map((view) => ({
    id: view.id,
    label: view.name,
    facts: JSON.stringify({
      context: view.context,
      sourceEvents: view.sourceEvents,
      fields: view.fields.map((field) => `${field.name}: ${field.type}`)
    }).slice(0, 1200)
  }));
  const deploymentItems = bundle.deployments.map((deployment) => ({
    id: deployment.id,
    label: deployment.name,
    facts: JSON.stringify({ contexts: deployment.contexts, domain: deployment.domain })
  }));
  const integrationItems = bundle.integrations.map((integration) => ({
    id: integration.id,
    label: integration.name,
    facts: JSON.stringify({ source: integration.source, target: integration.target, context: integration.context })
  }));
  const selected = kind === 'database-design'
    ? [...readModelItems, ...contextItems]
    : kind === 'installation-manual'
      ? [...deploymentItems, ...integrationItems, ...contextItems]
      : kind === 'software-design' || kind === 'diagrams'
        ? [...contextItems, ...integrationItems, ...deploymentItems, ...workflowItems]
        : kind === 'test-outline'
          ? [...workflowItems.filter((item) => item.facts.includes('specifications')), ...contextItems]
          : kind === 'user-manual' || kind === 'user-journey'
            ? [...workflowItems.filter((item) => item.facts.includes('actor')), ...contextItems]
            : [...workflowItems, ...contextItems];
  return selected.slice(0, 24);
};
