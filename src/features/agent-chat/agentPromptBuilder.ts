import type { AgentRequest } from './agentTypes';

export interface BuiltAgentPrompt {
  system: string;
  user: string;
}

export const buildAgentPrompt = (request: AgentRequest): BuiltAgentPrompt => {
  const context = request.agentContext;
  const selectedSnippet = context?.selectedDslSnippet;

  return {
    system: [
      ...(context?.systemRules ?? ['You are an Event Modeling DSL assistant.']),
      '',
      'Respond with exactly one JSON object matching one of these shapes:',
      JSON.stringify(outputContract, null, 2),
      '',
      'Rules:',
      '- Use dsl_patch_proposal only when you can produce a focused complete nextDsl.',
      '- Keep nextDsl as the complete DSL document, not a fragment.',
      '- Do not silently invent domain rules; use clarification or add a hotspot when behavior is unclear.',
      '- Preserve unrelated DSL exactly as much as possible.',
      '- For patch operations, describe the semantic operation at the DSL level.'
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
        ? `DSL knowledge reference:\n${context.dslKnowledgeRef.title} ${context.dslKnowledgeRef.version}\n${context.dslKnowledgeRef.compactRules.join('\n')}`
        : undefined,
      context?.dslKnowledgeSnippets.length
        ? `Relevant DSL knowledge snippets:\n${context.dslKnowledgeSnippets.map((snippet) => [
            `Topic: ${snippet.topic}`,
            `Reason: ${snippet.reason}`,
            snippet.content
          ].join('\n')).join('\n\n')}`
        : undefined,
      selectedSnippet
        ? `Selected DSL snippet (${selectedSnippet.label}, lines ${selectedSnippet.startLine}-${selectedSnippet.endLine}):\n${selectedSnippet.text}`
        : undefined,
      context
        ? `Recent conversation:\n${context.recentConversationSummary}`
        : undefined,
      'Current complete DSL:',
      request.dsl
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
  dsl_patch_proposal: {
    type: 'dsl_patch_proposal',
    content: 'Short explanation shown in chat.',
    patch: {
      summary: 'Human-readable patch summary.',
      reason: 'Why this DSL change is appropriate.',
      target: 'DSL element being changed.',
      changeType: 'insert | update | delete',
      operations: [{
        operation: 'insert | replace | delete',
        target: 'DSL element or block.',
        content: 'Inserted or replacement DSL fragment.',
        rule: 'Domain or modeling rule behind the change.'
      }],
      preview: 'Short DSL fragment preview.',
      nextDsl: 'Complete updated DSL document.',
      focusTarget: {
        kind: 'domain | context | aggregate | slice',
        name: 'Element name'
      }
    }
  }
};
