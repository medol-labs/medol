import { chat } from '@tanstack/ai';
import { createOpenaiChat } from '@tanstack/ai-openai';
import type { OpenAIChatModel } from '@tanstack/ai-openai';
import type { BuiltAgentPrompt } from './agentPromptBuilder';
import type { AgentProvider, AgentProviderConfig } from './agentProvider';
import type { AgentRequest } from './agentTypes';
import { agentStructuredResponseSchema, type AgentStructuredResponse } from './agentStructuredResponse';
import { createAgentProviderResult, mergeAgentUsage, type AgentUsage } from './agentUsage';

export const createOpenAiAgentProvider = (config: AgentProviderConfig['openai']): AgentProvider => ({
  name: 'openai',
  run: async (_request: AgentRequest, prompt: BuiltAgentPrompt) => {
    if (!config.apiKey) {
      return createAgentProviderResult({
        type: 'answer',
        content: 'OpenAI provider is selected, but OPENAI_API_KEY is not configured on the server.'
      } satisfies AgentStructuredResponse);
    }

    try {
      let usage: AgentUsage | undefined;
      const response = await chat({
        adapter: createOpenaiChat(config.model as OpenAIChatModel, config.apiKey),
        systemPrompts: [prompt.system],
        messages: [{ role: 'user', content: prompt.user }],
        outputSchema: agentStructuredResponseSchema,
        middleware: [{
          name: 'agent-usage-capture',
          onUsage: (_context, currentUsage) => {
            usage = mergeAgentUsage(usage, {
              provider: 'openai',
              model: config.model,
              measurement: 'reported',
              inputTokens: currentUsage.promptTokens,
              outputTokens: currentUsage.completionTokens,
              totalTokens: currentUsage.totalTokens,
              cachedInputTokens: currentUsage.promptTokensDetails?.cachedTokens,
              reasoningTokens: currentUsage.completionTokensDetails?.reasoningTokens,
              requestCount: 1
            });
          }
        }],
        temperature: 0
      });
      return createAgentProviderResult(response, usage);
    } catch (error) {
      return createAgentProviderResult({
        type: 'answer',
        content: `OpenAI provider failed through TanStack AI adapter: ${error instanceof Error ? error.message : String(error)}`
      } satisfies AgentStructuredResponse);
    }
  }
});
