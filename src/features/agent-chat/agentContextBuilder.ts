import type { EmAggregate, EmContext, EmElement, EmModel, EmSlice } from '../../lib/model';
import type { SelectedModelItem } from '../../app/modelSelection';
import type { AgentDslKnowledge, AgentDslKnowledgeManifest } from './dslKnowledge';

export interface AgentConversationMessage {
  role?: string;
  content?: unknown;
  parts?: unknown;
}

export interface AgentDslSnippet {
  label: string;
  startLine: number;
  endLine: number;
  text: string;
  truncated: boolean;
}

export interface AgentModelSummary {
  domainCount: number;
  contextCount: number;
  aggregateCount: number;
  sliceCount: number;
  elementCount: number;
  diagnostics: string[];
  selected?: {
    type: SelectedModelItem['type'];
    name: string;
    context?: string;
    aggregate?: string;
    slice?: string;
    elementKind?: string;
  };
}

export interface AgentDslKnowledgeSnippet {
  topic: string;
  reason: string;
  content: string;
}

export interface BuiltAgentContext {
  systemRules: string[];
  dslKnowledgeRef: {
    id: string;
    version: string;
    title: string;
    summary: string;
    compactRules: string[];
  };
  dslKnowledgeSnippets: AgentDslKnowledgeSnippet[];
  selectedContextSummary: string;
  selectedDslSnippet?: AgentDslSnippet;
  modelSummary: AgentModelSummary;
  recentConversationSummary: string;
  debug: {
    promptChars: number;
    selectedDslSnippetChars: number;
    recentConversationChars: number;
    dslKnowledgeSnippetTopics: string[];
    includedFullDsl: false;
    includedFullModel: false;
  };
}

export const buildAgentContext = (input: {
  prompt: string;
  dsl: string;
  model: EmModel;
  selectedItem?: SelectedModelItem;
  dslKnowledgeManifest: AgentDslKnowledgeManifest;
  dslKnowledge: AgentDslKnowledge;
  messages: AgentConversationMessage[];
}): BuiltAgentContext => {
  const selectedDslSnippet = findSelectedDslSnippet(input.dsl, input.selectedItem);
  const recentConversationSummary = summarizeConversation(input.messages);
  const dslKnowledgeSnippets = selectRelevantDslKnowledge({
    knowledge: input.dslKnowledge,
    prompt: input.prompt,
    selectedItem: input.selectedItem,
    selectedDslSnippet
  });

  return {
    systemRules: [
      'You are a MEDOL domain design assistant.',
      'Use the MEDOL knowledge reference and compact rules before proposing changes.',
      'Prefer a focused MEDOL patch over a broad rewrite.',
      'If a domain rule is unclear, add a hotspot or ask for clarification instead of inventing behavior.',
      'Never treat command/event field mismatches as automatically wrong; event fields may be derived.'
    ],
    dslKnowledgeRef: {
      id: input.dslKnowledgeManifest.id,
      version: input.dslKnowledgeManifest.version,
      title: input.dslKnowledgeManifest.title,
      summary: input.dslKnowledgeManifest.summary,
      compactRules: input.dslKnowledgeManifest.compactRules
    },
    dslKnowledgeSnippets,
    selectedContextSummary: summarizeSelectedContext(input.selectedItem),
    ...(selectedDslSnippet ? { selectedDslSnippet } : {}),
    modelSummary: summarizeModel(input.model, input.selectedItem),
    recentConversationSummary,
    debug: {
      promptChars: input.prompt.length,
      selectedDslSnippetChars: selectedDslSnippet?.text.length ?? 0,
      recentConversationChars: recentConversationSummary.length,
      dslKnowledgeSnippetTopics: dslKnowledgeSnippets.map((snippet) => snippet.topic),
      includedFullDsl: false,
      includedFullModel: false
    }
  };
};

export const toAgentContextDebug = (context: BuiltAgentContext) => ({
  dslKnowledge: `${context.dslKnowledgeRef.id}@${context.dslKnowledgeRef.version}`,
  dslKnowledgeSnippetTopics: context.debug.dslKnowledgeSnippetTopics,
  selectedContextSummary: context.selectedContextSummary,
  selectedDslSnippet: context.selectedDslSnippet
    ? {
        label: context.selectedDslSnippet.label,
        startLine: context.selectedDslSnippet.startLine,
        endLine: context.selectedDslSnippet.endLine,
        chars: context.selectedDslSnippet.text.length,
        truncated: context.selectedDslSnippet.truncated
      }
    : undefined,
  modelSummary: context.modelSummary,
  recentConversationChars: context.recentConversationSummary.length,
  includedFullDsl: context.debug.includedFullDsl,
  includedFullModel: context.debug.includedFullModel
});

const selectRelevantDslKnowledge = (input: {
  knowledge: AgentDslKnowledge;
  prompt: string;
  selectedItem?: SelectedModelItem;
  selectedDslSnippet?: AgentDslSnippet;
}): AgentDslKnowledgeSnippet[] => {
  const intentText = [
    input.prompt,
    input.selectedItem?.type,
    input.selectedItem?.element?.kind,
    input.selectedDslSnippet?.text
  ].filter(Boolean).join('\n').toLowerCase();

  const snippets: AgentDslKnowledgeSnippet[] = [
    {
      topic: 'required-instructions',
      reason: 'Always included as the baseline behavior contract.',
      content: input.knowledge.requiredInstructions.join('\n')
    },
    {
      topic: 'patch-rules',
      reason: 'Always included because the assistant proposes MEDOL patches.',
      content: input.knowledge.patchRules.join('\n')
    }
  ];

  if (matches(intentText, ['field', 'from', 'derived', 'mapping', 'example', '字段', '推理', '计算'])) {
    snippets.push({
      topic: 'field-mapping',
      reason: 'The request or selected MEDOL references field mapping, derived values, or examples.',
      content: input.knowledge.fieldMappingRules.join('\n')
    });
  }

  if (matches(intentText, ['ui', 'screen', 'page', 'layout', 'form', 'dialog', 'drawer', 'confirm', '页面', '布局', '表单'])) {
    snippets.push({
      topic: 'ui-rules',
      reason: 'The request or selected MEDOL references UI/page interaction semantics.',
      content: input.knowledge.uiRules.join('\n')
    });
  }

  if (matches(intentText, ['read model', 'readmodel', 'projection', 'list', 'query', 'subscribe', '查询', '列表'])) {
    snippets.push({
      topic: 'readmodel-syntax',
      reason: 'The request or selected MEDOL references read models, lists, queries, or subscriptions.',
      content: [
        input.knowledge.syntax.readmodel,
        input.knowledge.examples.find((example) => example.name === 'Read model')?.dsl
      ].filter(Boolean).join('\n')
    });
  }

  if (matches(intentText, ['command', 'event', 'slice', 'createsaggregate', 'state', '命令', '事件', '状态'])) {
    snippets.push({
      topic: 'timeline-modeling',
      reason: 'The request or selected MEDOL references slice timeline, command/event, creation, or state behavior.',
      content: [
        input.knowledge.syntax.slice,
        input.knowledge.syntax.command,
        input.knowledge.syntax.event,
        input.knowledge.syntax.createsAggregate,
        input.knowledge.syntax.state,
        ...input.knowledge.modelingConventions
      ].join('\n')
    });
  }

  if (matches(intentText, ['specification', 'given', 'when', 'then', 'acceptance', '测试', '验收'])) {
    snippets.push({
      topic: 'specification-syntax',
      reason: 'The request references behavior examples or acceptance specifications.',
      content: input.knowledge.syntax.specification
    });
  }

  if (matches(intentText, ['automation', 'policy', 'reactsTo', 'integration', '集成', '策略', '自动化'])) {
    snippets.push({
      topic: 'automation-policy-integration',
      reason: 'The request references event-triggered behavior, policies, automations, or integrations.',
      content: [
        input.knowledge.syntax.automation,
        input.knowledge.syntax.policy,
        input.knowledge.syntax.hotspot
      ].join('\n')
    });
  }

  return uniqueSnippets(snippets).slice(0, 5);
};

const summarizeModel = (model: EmModel, selectedItem?: SelectedModelItem): AgentModelSummary => {
  const aggregates = model.contexts.flatMap((context) => context.aggregates);
  const slices = model.contexts.flatMap((context) => [
    ...context.slices,
    ...context.aggregates.flatMap((aggregate) => aggregate.slices)
  ]);
  const elements = [
    ...slices.flatMap((slice) => slice.elements),
    ...model.contexts.flatMap((context) => context.looseElements)
  ];

  return {
    domainCount: model.domains.length,
    contextCount: model.contexts.length,
    aggregateCount: aggregates.length,
    sliceCount: slices.length,
    elementCount: elements.length,
    diagnostics: model.diagnostics.slice(0, 8),
    ...(selectedItem
      ? {
          selected: {
            type: selectedItem.type,
            name: selectedItem.name,
            ...(selectedItem.context ? { context: selectedItem.context.name } : {}),
            ...(selectedItem.aggregate ? { aggregate: selectedItem.aggregate.name } : {}),
            ...(selectedItem.slice ? { slice: selectedItem.slice.name } : {}),
            ...(selectedItem.element ? { elementKind: selectedItem.element.kind } : {})
          }
        }
      : {})
  };
};

const summarizeSelectedContext = (selectedItem?: SelectedModelItem): string => {
  if (!selectedItem) return 'No model item is selected; use the overall domain model.';

  const parts = [`Selected ${selectedItem.type}: ${selectedItem.name}.`];
  if (selectedItem.context) parts.push(`Context: ${selectedItem.context.name}.`);
  if (selectedItem.aggregate) parts.push(summarizeAggregate(selectedItem.aggregate));
  if (selectedItem.slice) parts.push(summarizeSlice(selectedItem.slice));
  if (selectedItem.element) parts.push(summarizeElement(selectedItem.element));
  return parts.join(' ');
};

const summarizeAggregate = (aggregate: EmAggregate): string => {
  const stateSummary = aggregate.states.length ? `states ${aggregate.states.join(', ')}` : 'no explicit states';
  return `Aggregate ${aggregate.name} has ${aggregate.slices.length} slice(s) and ${stateSummary}.`;
};

const summarizeSlice = (slice: EmSlice): string => {
  const counts = countElements(slice.elements);
  const state = slice.resultingState ? ` Resulting state: ${slice.resultingState}.` : '';
  const creates = slice.createsAggregate ? ' It creates the aggregate.' : '';
  const hotspots = slice.hotspots.length ? ` Hotspots: ${slice.hotspots.join('; ')}.` : '';
  const tags = slice.tags.length
    ? ` Selection tags: ${slice.tags.map((tag) => tag.expression ? `${tag.name}=${tag.expression}` : tag.name).join(', ')}.`
    : '';
  return `Slice ${slice.name} has ${counts.commands} command(s), ${counts.events} event(s), ${counts.rejects} rejection specification(s), ${counts.readmodels} read model(s), ${counts.automations} automation(s).${state}${creates}${tags}${hotspots}`;
};

const summarizeElement = (element: EmElement): string => {
  const fieldSummary = element.fields.length
    ? `fields ${element.fields.map((field) => field.name).join(', ')}`
    : 'no fields';
  return `Element ${element.kind} ${element.name} has ${fieldSummary}.`;
};

const countElements = (elements: EmElement[]) => ({
  commands: elements.filter((element) => element.kind === 'command').length,
  events: elements.filter((element) => element.kind === 'event').length,
  rejects: elements.filter((element) => element.kind === 'gwt' && element.metadata?.thenReject).length,
  readmodels: elements.filter((element) => element.kind === 'readmodel').length,
  automations: elements.filter((element) => element.kind === 'automation').length
});

const findSelectedDslSnippet = (dsl: string, selectedItem?: SelectedModelItem): AgentDslSnippet | undefined => {
  if (!selectedItem) return sliceByLines(dsl, 1, 80, 'MEDOL document start');

  const candidates = getBlockCandidates(selectedItem);
  for (const candidate of candidates) {
    const block = findNamedBlock(dsl, candidate.keyword, candidate.name);
    if (block) return block;
  }

  if (selectedItem.element?.kind === 'screen') {
    return findLineSnippet(dsl, new RegExp(`\\bui\\s+${escapeRegExp(selectedItem.element.name)}\\b.*`, 'm'), `ui ${selectedItem.element.name}`);
  }

  return sliceByLines(dsl, 1, 80, `Fallback context for ${selectedItem.type} ${selectedItem.name}`);
};

const getBlockCandidates = (selectedItem: SelectedModelItem) => {
  if (selectedItem.type === 'domain') return [{ keyword: 'domain', name: selectedItem.name }];
  if (selectedItem.type === 'context') return [{ keyword: 'context', name: selectedItem.name }];
  if (selectedItem.type === 'aggregate') return [{ keyword: 'aggregate', name: selectedItem.name }];
  if (selectedItem.type === 'slice') return [{ keyword: 'slice', name: selectedItem.name }];
  if (!selectedItem.element) return [];

  const keywordByKind: Partial<Record<EmElement['kind'], string>> = {
    command: 'command',
    event: 'event',
    readmodel: 'readmodel',
    automation: 'automation',
    policy: 'policy',
    integration: 'integration',
    hotspot: 'hotspot'
  };
  const keyword = keywordByKind[selectedItem.element.kind];
  return keyword ? [{ keyword, name: selectedItem.element.name }] : [];
};

const findNamedBlock = (dsl: string, keyword: string, name: string): AgentDslSnippet | undefined => {
  const keywordPattern = keyword === 'readmodel' ? '(?:readmodel|projection)' : keyword;
  const pattern = new RegExp(`\\b${keywordPattern}\\s+${escapeRegExp(name)}(?:\\[\\])?\\s*\\{`, 'm');
  const match = pattern.exec(dsl);
  if (!match) return undefined;

  const openIndex = dsl.indexOf('{', match.index);
  if (openIndex < 0) return undefined;

  const closeIndex = findBlockEnd(dsl, openIndex);
  if (closeIndex < 0) return undefined;

  const startLine = lineNumberAt(dsl, match.index);
  const endLine = lineNumberAt(dsl, closeIndex);
  return sliceByLines(dsl, startLine, endLine, `${keyword} ${name}`);
};

const findLineSnippet = (dsl: string, pattern: RegExp, label: string): AgentDslSnippet | undefined => {
  const match = pattern.exec(dsl);
  if (!match) return undefined;
  const line = lineNumberAt(dsl, match.index);
  return sliceByLines(dsl, line, line, label);
};

const sliceByLines = (dsl: string, startLine: number, endLine: number, label: string): AgentDslSnippet => {
  const maxLines = 120;
  const lines = dsl.split('\n');
  const safeStart = Math.max(1, startLine);
  const safeEnd = Math.max(safeStart, Math.min(lines.length, endLine));
  const selectedLines = lines.slice(safeStart - 1, safeEnd);
  const truncated = selectedLines.length > maxLines;
  const text = (truncated ? selectedLines.slice(0, maxLines) : selectedLines).join('\n');
  return {
    label,
    startLine: safeStart,
    endLine: truncated ? safeStart + maxLines - 1 : safeEnd,
    text,
    truncated
  };
};

const summarizeConversation = (messages: AgentConversationMessage[]): string => {
  const recent = messages.slice(-8)
    .map((message) => {
      const text = contentToText(message.content ?? message.parts).trim();
      if (!text) return undefined;
      return `${message.role ?? 'unknown'}: ${truncate(text, 280)}`;
    })
    .filter((item): item is string => Boolean(item));

  return recent.length ? recent.join('\n') : 'No prior conversation in this request.';
};

const contentToText = (content: unknown): string => {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (!part || typeof part !== 'object') return '';
      const record = part as Record<string, unknown>;
      return typeof record.text === 'string'
        ? record.text
        : typeof record.content === 'string'
          ? record.content
          : '';
    })
    .filter(Boolean)
    .join('\n');
};

const findBlockEnd = (text: string, openIndex: number): number => {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
};

const lineNumberAt = (text: string, index: number): number => {
  return text.slice(0, index).split('\n').length;
};

const truncate = (value: string, maxLength: number): string => {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
};

const matches = (text: string, keywords: string[]): boolean => {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
};

const uniqueSnippets = (snippets: AgentDslKnowledgeSnippet[]): AgentDslKnowledgeSnippet[] => {
  const seen = new Set<string>();
  return snippets.filter((snippet) => {
    if (seen.has(snippet.topic)) return false;
    seen.add(snippet.topic);
    return true;
  });
};

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
