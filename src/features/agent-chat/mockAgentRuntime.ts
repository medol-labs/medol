import type { EmElement, EmSlice } from '../../lib/model';
import type { AgentRequest, AgentResponse } from './agentTypes';
import type { BuiltAgentPrompt } from './agentPromptBuilder';
import { normalizeAgentStructuredResponse, type AgentStructuredDslPatch, type AgentStructuredResponse } from './agentStructuredResponse';

const readModelIntent = /\b(read\s*model|projection|view|list|query)\b/i;

export const runMockAgent = async (request: AgentRequest): Promise<AgentResponse> => {
  const structuredResponse = await runMockStructuredAgent(request, {
    modelingSystem: '',
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
      ? `Selected slice has ${slice.elements.filter((element) => element.kind === 'command').length} command(s), ${slice.elements.filter((element) => element.kind === 'event').length} event(s), and ${slice.elements.filter((element) => element.kind === 'readmodel').length} read model(s).`
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
  const readModelName = uniqueElementName(slice, `${baseName}ReadModel`);
  const eventLine = event ? `\n        subscribe ${event.name}` : '';
  const snippet = `\n      readmodel ${readModelName}[] {\n        readModelId: UUID id generated technical${eventLine}\n      }\n`;
  if (!hasNamedBlock(dsl, 'slice', slice.name)) return proposeHotspotPatch(dsl, slice, `Add read model ${readModelName}`);

  return {
    summary: `Add read model ${readModelName} to slice ${slice.name}.`,
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
    focusTarget: { kind: 'slice', name: slice.name }
  };
};

const proposeHotspotPatch = (dsl: string, slice: EmSlice, prompt: string): AgentStructuredDslPatch | undefined => {
  const note = sanitizeStringLiteral(`Agent note: clarify rule for ${prompt.trim() || slice.name}`);
  const snippet = `\n      hotspot "${note}"\n`;
  if (!hasNamedBlock(dsl, 'slice', slice.name)) return undefined;

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
    focusTarget: { kind: 'slice', name: slice.name }
  };
};

const hasNamedBlock = (dsl: string, keyword: string, name: string): boolean => {
  const pattern = new RegExp(`\\b${keyword}\\s+${escapeRegExp(name)}\\s*\\{`, 'g');
  return pattern.test(dsl);
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
