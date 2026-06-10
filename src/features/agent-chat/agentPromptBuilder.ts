import type { AgentRequest } from './agentTypes';

export interface BuiltAgentPrompt {
  modelingSystem: string;
  system: string;
  user: string;
}

export const buildAgentPrompt = (request: AgentRequest): BuiltAgentPrompt => {
  const context = request.agentContext;
  const selectedSnippet = context?.selectedDslSnippet;

  const modelingSystem = [
    ...(context?.systemRules ?? ['You are a MEDOL domain design assistant.']),
    '',
    'You can answer ordinary questions that are unrelated to MEDOL or domain design.',
    'Only propose a MEDOL patch when the user explicitly requests or clearly needs a model change.',
    '',
    'Modeling rules:',
    '- Use medol_patch_proposal only when you can produce focused MEDOL operations.',
    '- Do not output nextDsl; the server applies operations to the current MEDOL.',
    '- Do not silently invent domain rules; use clarification or add a hotspot when behavior is unclear.',
    '- Preserve unrelated MEDOL exactly as much as possible.',
    '- For patch operations, use targets like "slice CreateOrder", "readmodel OrderList", "command CreateOrder", or "specification Reject duplicate order".',
    '- Insert operations must include the MEDOL fragment in content.'
  ].join('\n');

  return {
    modelingSystem,
    system: [
      modelingSystem,
      '',
      'Respond with exactly one JSON object matching one of these shapes:',
      JSON.stringify(outputContract, null, 2)
    ].join('\n'),
    user: [
      `User request:\n${request.prompt}`,
      context
        ? `Selected context:\n${context.selectedContextSummary}`
        : 'Selected context:\nNo structured agent context was provided.',
      context
        ? `Model summary:\n${JSON.stringify(context.modelSummary, null, 2)}`
        : undefined,
      context
        ? `MEDOL knowledge reference:\n${context.dslKnowledgeRef.title} ${context.dslKnowledgeRef.version}\n${context.dslKnowledgeRef.compactRules.join('\n')}`
        : undefined,
      context?.dslKnowledgeSnippets.length
        ? `Relevant MEDOL knowledge snippets:\n${context.dslKnowledgeSnippets.map((snippet) => [
            `Topic: ${snippet.topic}`,
            `Reason: ${snippet.reason}`,
            snippet.content
          ].join('\n')).join('\n\n')}`
        : undefined,
      selectedSnippet
        ? `Selected MEDOL snippet (${selectedSnippet.label}, lines ${selectedSnippet.startLine}-${selectedSnippet.endLine}):\n${selectedSnippet.text}`
        : undefined,
      context
        ? `Recent conversation:\n${context.recentConversationSummary}`
        : undefined,
      request.includeDslInPrompt === false
        ? undefined
        : `Current complete MEDOL:\n${request.dsl}`
    ].filter(Boolean).join('\n\n')
  };
};

const outputContract = {
  answer: {
    type: 'answer',
    content: 'Short direct answer.'
  },
  clarification: {
    type: 'clarification',
    content: 'Explain why more domain information is needed.',
    questions: ['One focused question.']
  },
  medol_patch_proposal: {
    type: 'medol_patch_proposal',
    content: 'Short explanation shown in chat.',
    patch: {
      summary: 'Human-readable patch summary.',
      reason: 'Why this MEDOL change is appropriate.',
      target: 'MEDOL element being changed.',
      changeType: 'insert | update | delete',
      operations: [{
        operation: 'insert | replace | delete',
        target: 'MEDOL element or block.',
        content: 'Inserted or replacement MEDOL fragment.',
        rule: 'Domain or modeling rule behind the change.'
      }],
      preview: 'Short MEDOL fragment preview.',
      focusTarget: {
        kind: 'domain | context | aggregate | slice',
        name: 'Element name'
      }
    }
  }
};
