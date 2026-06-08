import { buildAgentPrompt, type BuiltAgentPrompt } from './agentPromptBuilder';
import { getAgentProviderConfig, type AgentProvider, type AgentProviderName } from './agentProvider';
import { createMiniMaxAgentProvider } from './minimaxAgentProvider';
import { runMockStructuredAgent } from './mockAgentRuntime';
import { createOpenAiAgentProvider } from './openAiAgentProvider';
import type { AgentRequest, AgentResponse } from './agentTypes';
import { createAgentProviderResult, type AgentUsage } from './agentUsage';
import {
  normalizeAgentStructuredResponse,
  parseAgentStructuredResponse,
  type AgentStructuredResponse
} from './agentStructuredResponse';

export interface AgentRuntimeResult extends AgentResponse {
  prompt: BuiltAgentPrompt;
  provider: AgentProviderName;
  structuredResponse: AgentStructuredResponse;
  usage?: AgentUsage;
}

export const runEventModelingAgent = async (request: AgentRequest): Promise<AgentRuntimeResult> => {
  const prompt = buildAgentPrompt(request);
  const provider = resolveAgentProvider();
  const providerResult = await provider.run(request, prompt);
  const structuredResponse = parseAgentStructuredResponse(providerResult.response) ?? {
    type: 'answer',
    content: 'I could not produce a valid structured modeling response. Please try a smaller, more specific request.'
  } satisfies AgentStructuredResponse;
  const response = normalizeAgentStructuredResponse(structuredResponse, request);

  return {
    ...response,
    prompt,
    provider: provider.name,
    structuredResponse,
    ...(providerResult.usage ? { usage: providerResult.usage } : {})
  };
};

const resolveAgentProvider = (): AgentProvider => {
  const config = getAgentProviderConfig();

  if (config.provider === 'openai') {
    return createOpenAiAgentProvider(config.openai);
  }

  if (config.provider === 'minimax') {
    return createMiniMaxAgentProvider(config.minimax);
  }

  return {
    name: 'mock',
    run: async (request, prompt) => {
      const response = await runMockStructuredAgent(request, prompt);
      const inputTokens = estimateMockTokens(prompt.system + prompt.user);
      const outputTokens = estimateMockTokens(JSON.stringify(response));
      return createAgentProviderResult(response, {
        provider: 'mock',
        model: 'mock-model',
        measurement: 'estimated',
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        requestCount: 1
      });
    }
  };
};

const estimateMockTokens = (text: string): number => {
  return Math.max(1, Math.ceil(text.length / 4));
};
