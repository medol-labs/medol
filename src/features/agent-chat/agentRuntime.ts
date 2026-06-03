import { buildAgentPrompt, type BuiltAgentPrompt } from './agentPromptBuilder';
import { getAgentProviderConfig, type AgentProvider, type AgentProviderName } from './agentProvider';
import { runMockStructuredAgent } from './mockAgentRuntime';
import { createOpenAiAgentProvider } from './openAiAgentProvider';
import type { AgentRequest, AgentResponse } from './agentTypes';
import {
  normalizeAgentStructuredResponse,
  parseAgentStructuredResponse,
  type AgentStructuredResponse
} from './agentStructuredResponse';

export interface AgentRuntimeResult extends AgentResponse {
  prompt: BuiltAgentPrompt;
  provider: AgentProviderName;
  structuredResponse: AgentStructuredResponse;
}

export const runEventModelingAgent = async (request: AgentRequest): Promise<AgentRuntimeResult> => {
  const prompt = buildAgentPrompt(request);
  const provider = resolveAgentProvider();
  const rawStructuredResponse = await provider.run(request, prompt);
  const structuredResponse = parseAgentStructuredResponse(rawStructuredResponse) ?? {
    type: 'answer',
    content: 'I could not produce a valid structured modeling response. Please try a smaller, more specific request.'
  } satisfies AgentStructuredResponse;
  const response = normalizeAgentStructuredResponse(structuredResponse, request);

  return {
    ...response,
    prompt,
    provider: provider.name,
    structuredResponse
  };
};

const resolveAgentProvider = (): AgentProvider => {
  const config = getAgentProviderConfig();

  if (config.provider === 'openai') {
    return createOpenAiAgentProvider(config.openai);
  }

  return {
    name: 'mock',
    run: runMockStructuredAgent
  };
};
