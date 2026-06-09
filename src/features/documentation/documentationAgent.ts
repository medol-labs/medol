import type { EmModel } from '../../lib/model';
import type {
  DocumentationKind,
  GeneratedDocumentation
} from '../../lib/generators/documentation';
import { runEventModelingAgent } from '../agent-chat/agentRuntime';
import type { AgentUsage } from '../agent-chat/agentUsage';

export interface DocumentationAgentResult {
  markdown: string;
  enhanced: boolean;
  usage?: AgentUsage;
  warning?: string;
}

export const enhanceDocumentationWithAgent = async (input: {
  dsl: string;
  model: EmModel;
  document: GeneratedDocumentation;
}): Promise<DocumentationAgentResult> => {
  const response = await runEventModelingAgent({
    prompt: buildDocumentationPrompt(
      input.document.kind,
      input.document.language,
      input.document.markdown
    ),
    dsl: input.dsl,
    model: input.model,
    includeDslInPrompt: false
  });

  const content = response.content.trim();
  const warning = response.provider === 'mock' || !isProviderFailure(content)
    ? undefined
    : content;

  if (response.provider === 'mock' || !content || warning) {
    return {
      markdown: input.document.markdown,
      enhanced: false,
      ...(response.usage ? { usage: response.usage } : {}),
      ...(warning ? { warning } : {})
    };
  }

  return {
    markdown: content,
    enhanced: true,
    ...(response.usage ? { usage: response.usage } : {})
  };
};

const isProviderFailure = (content: string): boolean => {
  return /provider (?:is selected, but|failed)|API request failed/i.test(content);
};

const buildDocumentationPrompt = (
  kind: DocumentationKind,
  language: GeneratedDocumentation['language'],
  draft: string
): string => [
  `Act as a senior product and software architect. Produce the final ${kindLabel(kind)} in Markdown.`,
  language === 'zh-CN'
    ? 'Write the complete document in Simplified Chinese. Keep DSL identifiers, code, event names, command names, field names, and source markers unchanged.'
    : 'Write the complete document in English.',
  'Use the deterministic draft below as the source of truth.',
  'Do not invent domain behavior, fields, events, integrations, SLAs, technologies, or compliance requirements.',
  'Preserve DSL source markers and Mermaid blocks when present.',
  'Improve structure, clarity, rationale, and implementation guidance.',
  kind === 'prd'
    ? 'Make the PRD suitable for routine product review and acceptance: retain the CRUD inventory, UI entry points, acceptance matrix, data requirements, delivery checklist, and open questions.'
    : '',
  'When information is missing, write an explicit Assumption, Open Question, or Recommendation instead of presenting it as fact.',
  'Return the complete final Markdown document, without commentary before or after it.',
  '',
  'Deterministic draft:',
  draft
].join('\n');

const kindLabel = (kind: DocumentationKind): string => {
  if (kind === 'prd') return 'product requirements document';
  if (kind === 'software-design') return 'software design document';
  if (kind === 'database-design') return 'read model database design document';
  return 'business process document';
};
