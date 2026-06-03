import type { EmElement, EmSlice } from '../../lib/model';
import type { AgentRequest, AgentResponse } from './agentTypes';
import type { BuiltAgentPrompt } from './agentPromptBuilder';
import { normalizeAgentStructuredResponse, type AgentStructuredDslPatch, type AgentStructuredResponse } from './agentStructuredResponse';

const readModelIntent = /\b(read\s*model|projection|view|list|query)\b/i;

export const runMockAgent = async (request: AgentRequest): Promise<AgentResponse> => {
  const structuredResponse = await runMockStructuredAgent(request, {
    system: '',
    user: ''
  });
  return normalizeAgentStructuredResponse(structuredResponse, request);
};

export const runMockStructuredAgent = async (
  request: AgentRequest,
  _prompt: BuiltAgentPrompt
): Promise<AgentStructuredResponse> => {
  await new Promise((resolve) => globalThis.setTimeout(resolve, 350));

  const selected = request.selectedItem;
  const slice = selected?.slice;
  const contextName = selected ? `${selected.type} "${selected.name}"` : 'the current model';
  const diagnostics = request.model.diagnostics.length;
  const dslKnowledgeVersion = request.dslKnowledgeManifest?.version ?? request.dslKnowledge?.version;
  const selectedSnippet = request.agentContext?.selectedDslSnippet;
  const dslKnowledgeTopics = request.agentContext?.dslKnowledgeSnippets.map((snippet) => snippet.topic).join(', ');
  const findings = [
    `Context: ${contextName}.`,
    dslKnowledgeVersion ? `DSL knowledge package: ${dslKnowledgeVersion}.` : 'DSL knowledge package was not provided.',
    request.agentContext
      ? `Agent context built with ${request.agentContext.modelSummary.sliceCount} slice(s); selected DSL snippet ${selectedSnippet ? `${selectedSnippet.label} (${selectedSnippet.startLine}-${selectedSnippet.endLine})` : 'not available'}.`
      : 'Agent context builder was not used.',
    dslKnowledgeTopics ? `Relevant DSL knowledge: ${dslKnowledgeTopics}.` : 'No relevant DSL knowledge snippets were selected.',
    diagnostics > 0
      ? `There ${diagnostics === 1 ? 'is' : 'are'} ${diagnostics} parser/model warning${diagnostics === 1 ? '' : 's'} to review before codegen.`
      : 'The current DSL parses without warnings.',
    slice
      ? `Selected slice has ${slice.elements.filter((element) => element.kind === 'command').length} command(s), ${slice.elements.filter((element) => element.kind === 'event').length} event(s), and ${slice.elements.filter((element) => element.kind === 'projection').length} read model(s).`
      : 'Select a slice when you want the agent to propose a precise DSL patch.'
  ];

  const patch = slice && readModelIntent.test(request.prompt)
    ? proposeReadModelPatch(request.dsl, slice)
    : slice
      ? proposeHotspotPatch(request.dsl, slice, request.prompt)
      : undefined;

  const content = [
    'I reviewed the current modeling context.',
    ...findings.map((finding) => `- ${finding}`),
    patch
      ? `Proposed DSL patch: ${patch.summary}`
      : 'No DSL patch was prepared because there is no selected slice yet.'
  ].join('\n');

  if (!patch) {
    return {
      type: 'answer',
      content
    };
  }

  return {
    type: 'dsl_patch_proposal',
    content: [
      'I reviewed the current modeling context.',
      ...findings.map((finding) => `- ${finding}`),
      `Proposed DSL patch: ${patch.summary}`
    ].join('\n'),
    patch
  };
};

const proposeReadModelPatch = (dsl: string, slice: EmSlice): AgentStructuredDslPatch | undefined => {
  const event = slice.elements.find((element) => element.kind === 'event');
  const baseName = event ? stripSuffix(event.name, 'Event') : slice.name;
  const projectionName = uniqueElementName(slice, `${baseName}ReadModel`);
  const eventLine = event ? `\n        subscribe ${event.name}` : '';
  const snippet = `\n      projection ${projectionName}[] {${eventLine}\n        id: String id\n      }\n`;
  const nextDsl = insertIntoSlice(dsl, slice.name, snippet);

  if (!nextDsl) return proposeHotspotPatch(dsl, slice, `Add read model ${projectionName}`);

  return {
    summary: `Add read model ${projectionName} to slice ${slice.name}.`,
    reason: event
      ? `The selected slice emits ${event.name}; a read model can make that event visible for UI/query flows.`
      : 'The selected slice has no event yet, so this creates a placeholder read model to review.',
    target: `slice ${slice.name}`,
    changeType: 'insert',
    operations: [{
      operation: 'insert',
      target: `slice ${slice.name}`,
      content: snippet.trim(),
      rule: event
        ? `Subscribe the read model to ${event.name} so UI/query flows have a visible state source.`
        : 'Add a placeholder read model for later field and subscription refinement.'
    }],
    preview: snippet.trimEnd(),
    nextDsl,
    focusTarget: { kind: 'slice', name: slice.name }
  };
};

const proposeHotspotPatch = (dsl: string, slice: EmSlice, prompt: string): AgentStructuredDslPatch | undefined => {
  const note = sanitizeStringLiteral(`Agent note: clarify rule for ${prompt.trim() || slice.name}`);
  const snippet = `\n      hotspot "${note}"\n`;
  const nextDsl = insertIntoSlice(dsl, slice.name, snippet);

  if (!nextDsl) return undefined;

  return {
    summary: `Add a modeling hotspot to slice ${slice.name}.`,
    reason: 'The request needs a domain rule or modeling decision before the DSL can be safely expanded.',
    target: `slice ${slice.name}`,
    changeType: 'insert',
    operations: [{
      operation: 'insert',
      target: `slice ${slice.name}`,
      content: snippet.trim(),
      rule: 'Capture the unresolved modeling decision as a hotspot before changing structural DSL.'
    }],
    preview: snippet.trimEnd(),
    nextDsl,
    focusTarget: { kind: 'slice', name: slice.name }
  };
};

const insertIntoSlice = (dsl: string, sliceName: string, snippet: string): string | undefined => {
  const blockStart = findNamedBlockStart(dsl, 'slice', sliceName);
  if (blockStart < 0) return undefined;

  const insertAt = findBlockEnd(dsl, blockStart);
  if (insertAt < 0) return undefined;

  return `${dsl.slice(0, insertAt)}${snippet}${dsl.slice(insertAt)}`;
};

const findNamedBlockStart = (dsl: string, keyword: string, name: string): number => {
  const pattern = new RegExp(`\\b${keyword}\\s+${escapeRegExp(name)}\\s*\\{`, 'g');
  const match = pattern.exec(dsl);
  return match?.index ?? -1;
};

const findBlockEnd = (dsl: string, blockStart: number): number => {
  const openIndex = dsl.indexOf('{', blockStart);
  if (openIndex < 0) return -1;

  let depth = 0;
  let quote: '"' | undefined;
  for (let index = openIndex; index < dsl.length; index += 1) {
    const char = dsl[index];
    const previous = dsl[index - 1];

    if (quote) {
      if (char === quote && previous !== '\\') quote = undefined;
      continue;
    }

    if (char === '"') {
      quote = char;
      continue;
    }

    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
};

const uniqueElementName = (slice: EmSlice, preferredName: string): string => {
  const existingNames = new Set(slice.elements.map((element: EmElement) => element.name));
  if (!existingNames.has(preferredName)) return preferredName;

  let index = 2;
  while (existingNames.has(`${preferredName}${index}`)) index += 1;
  return `${preferredName}${index}`;
};

const stripSuffix = (value: string, suffix: string): string => {
  return value.endsWith(suffix) ? value.slice(0, -suffix.length) : value;
};

const sanitizeStringLiteral = (value: string): string => {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').slice(0, 160);
};

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
