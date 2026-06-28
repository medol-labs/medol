import type { EmElement, EmSlice } from '../../lib/model';
import type { AgentRequest, AgentResponse } from './agentTypes';
import type { BuiltAgentPrompt } from './agentPromptBuilder';
import { normalizeAgentStructuredResponse, type AgentStructuredDslPatch, type AgentStructuredResponse } from './agentStructuredResponse';

const readModelIntent = /\b(read\s*model|projection|view|list|query)\b/i;
const identityIntent = /(你是谁|你是誰|who\s+are\s+you|what\s+are\s+you|介绍一下你|介紹一下你|自我介绍|自我介紹)/i;
const capabilityIntent = /(你能做什么|你能做什麼|能做什么|能做什麼|what\s+can\s+you\s+do|help\s+me|怎么用|如何使用)/i;
const modelSummaryIntent = /(总结|總結|概览|概覽|overview|summary|分析.*模型|检查.*模型|檢查.*模型|当前.*模型|目前.*模型)/i;
const patchIntent = /(新增|添加|补充|修改|调整|删除|移除|生成|创建|建立|设计|实现|add|create|update|change|modify|delete|remove|generate|implement|patch|proposal)/i;

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

  const directAnswer = buildDirectMockAnswer(request);
  if (directAnswer) {
    return {
      type: 'answer',
      content: directAnswer
    };
  }

  const selected = request.selectedItem;
  const slice = selected?.slice;
  const contextName = selected ? `${selected.type} "${selected.name}"` : 'the whole model';
  const diagnostics = request.model.diagnostics.length;
  const contextCount = request.model.contexts.length;
  const sliceCount = request.model.contexts.reduce((total, context) => total + context.slices.length, 0);
  const conceptCount = request.model.contexts.reduce((total, context) => total + context.concepts.length, 0);
  const dslKnowledgeVersion = request.dslKnowledgeManifest?.version ?? request.dslKnowledge?.version;
  const selectedSnippet = request.agentContext?.selectedDslSnippet;
  const dslKnowledgeTopics = request.agentContext?.dslKnowledgeSnippets.map((snippet) => snippet.topic).join(', ');
  const findings = [
    `Context: ${contextName}.`,
    dslKnowledgeVersion ? `MEDOL knowledge package: ${dslKnowledgeVersion}.` : 'MEDOL knowledge package was not provided.',
    request.agentContext
      ? `Agent context built with ${request.agentContext.modelSummary.sliceCount} slice(s); relevant MEDOL snippet ${selectedSnippet ? `${selectedSnippet.label} (${selectedSnippet.startLine}-${selectedSnippet.endLine})` : 'not available'}.`
      : 'Agent context builder was not used.',
    dslKnowledgeTopics ? `Relevant MEDOL knowledge: ${dslKnowledgeTopics}.` : 'No relevant MEDOL knowledge snippets were selected.',
    diagnostics > 0
      ? `There ${diagnostics === 1 ? 'is' : 'are'} ${diagnostics} parser/model warning${diagnostics === 1 ? '' : 's'} to review before codegen.`
      : 'The current MEDOL parses without warnings.',
    slice
      ? `Selected slice has ${slice.elements.filter((element) => element.kind === 'command').length} command(s), ${slice.elements.filter((element) => element.kind === 'event').length} event(s), and ${slice.elements.filter((element) => element.kind === 'readmodel').length} read model(s).`
      : `Using the whole model: ${contextCount} context(s), ${conceptCount} concept(s), and ${sliceCount} slice(s).`
  ];

  const shouldProposePatch = patchIntent.test(request.prompt) || readModelIntent.test(request.prompt);
  const patch = shouldProposePatch && slice && readModelIntent.test(request.prompt)
    ? proposeReadModelPatch(request.dsl, slice)
    : shouldProposePatch && slice
      ? proposeHotspotPatch(request.dsl, slice, request.prompt)
      : undefined;

  const content = [
    selected || modelSummaryIntent.test(request.prompt)
      ? selected ? 'I reviewed the selected modeling focus.' : 'I reviewed the whole model.'
      : 'I can answer directly, and I can use the whole model as context when your question needs it.',
    ...findings.map((finding) => `- ${finding}`),
    patch
      ? `Proposed MEDOL patch: ${patch.summary}`
      : 'No MEDOL patch was prepared. Ask for a specific model change when you want an editable proposal.'
  ].join('\n');

  if (!patch) {
    return {
      type: 'answer',
      content
    };
  }

  return {
    type: 'medol_patch_proposal',
    content: [
      selected ? 'I reviewed the selected modeling focus.' : 'I reviewed the whole model.',
      ...findings.map((finding) => `- ${finding}`),
      `Proposed MEDOL patch: ${patch.summary}`
    ].join('\n'),
    patch
  };
};

const buildDirectMockAnswer = (request: AgentRequest): string | undefined => {
  const prompt = request.prompt.trim();
  if (identityIntent.test(prompt)) {
    return [
      '我是 MEDOL 建模助手，可以直接和你对话。',
      '',
      '我能基于当前整个 MEDOL 模型回答问题，也可以在你选中某个 context、concept 或 slice 时把它当成可选焦点。只有当你明确要求修改模型时，我才会准备可应用的 MEDOL patch。',
      '',
      '当前本地使用的是 mock provider，所以回答能力是有限模拟版；切到真实模型 provider 后，回答会更自然也更准确。'
    ].join('\n');
  }

  if (capabilityIntent.test(prompt)) {
    return [
      '我可以直接帮你看 MEDOL 模型、解释语法、检查建模完整性、讨论联邦学习领域设计，也可以按你的要求生成可预览和应用的 MEDOL 修改建议。',
      '',
      '你不需要先选模块。没选中对象时，我默认使用整个模型；选中对象时，我会把它当成焦点。'
    ].join('\n');
  }

  return undefined;
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
      content: snippet.trimEnd(),
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
    reason: 'The request needs a domain rule or modeling decision before the MEDOL can be safely expanded.',
    target: `slice ${slice.name}`,
    changeType: 'insert',
    operations: [{
      operation: 'insert',
      target: `slice ${slice.name}`,
      content: snippet.trimEnd(),
      rule: 'Capture the unresolved modeling decision as a hotspot before changing structural MEDOL.'
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
