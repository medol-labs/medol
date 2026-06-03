import type { BuiltAgentPrompt } from './agentPromptBuilder';
import type { AgentRequest } from './agentTypes';

export type AgentProviderName = 'mock' | 'openai';

export interface AgentProviderConfig {
  provider: AgentProviderName;
  openai: {
    apiKey?: string;
    model: string;
  };
}

export interface AgentProvider {
  name: AgentProviderName;
  run: (request: AgentRequest, prompt: BuiltAgentPrompt) => Promise<unknown>;
}

export const getAgentProviderConfig = (): AgentProviderConfig => {
  const env = getServerEnv();
  return {
    provider: parseProviderName(env.AGENT_PROVIDER),
    openai: {
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL || 'gpt-5.2'
    }
  };
};

const parseProviderName = (value?: string): AgentProviderName => {
  return value === 'openai' ? 'openai' : 'mock';
};

const getServerEnv = (): Record<string, string | undefined> => {
  return typeof process === 'undefined' ? {} : process.env;
};
