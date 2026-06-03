import { chat } from '@tanstack/ai';
import { createOpenaiChat } from '@tanstack/ai-openai';
import type { OpenAIChatModel } from '@tanstack/ai-openai';
import type { BuiltAgentPrompt } from './agentPromptBuilder';
import type { AgentProvider, AgentProviderConfig } from './agentProvider';
import type { AgentRequest } from './agentTypes';
import type { AgentStructuredResponse } from './agentStructuredResponse';

export const createOpenAiAgentProvider = (config: AgentProviderConfig['openai']): AgentProvider => ({
  name: 'openai',
  run: async (_request: AgentRequest, prompt: BuiltAgentPrompt): Promise<unknown> => {
    if (!config.apiKey) {
      return {
        type: 'answer',
        content: 'OpenAI provider is selected, but OPENAI_API_KEY is not configured on the server.'
      } satisfies AgentStructuredResponse;
    }

    try {
      const outputText = await chat({
        adapter: createOpenaiChat(config.model as OpenAIChatModel, config.apiKey),
        systemPrompts: [prompt.system],
        messages: [{ role: 'user', content: prompt.user }],
        stream: false,
        temperature: 0
      });

      return JSON.parse(outputText) as unknown;
    } catch (error) {
      return {
        type: 'answer',
        content: `OpenAI provider failed through TanStack AI adapter: ${error instanceof Error ? error.message : String(error)}`
      } satisfies AgentStructuredResponse;
    }
  }
});
