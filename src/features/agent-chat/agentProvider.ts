import type { BuiltAgentPrompt } from './agentPromptBuilder';
import type { AgentRequest } from './agentTypes';
import type { AgentProviderResult } from './agentUsage';

export type AgentProviderName = 'mock' | 'openai' | 'minimax';

export interface AgentProviderConfig {
  provider: AgentProviderName;
  openai: {
    apiKey?: string;
    model: string;
  };
  minimax: {
    apiKey?: string;
    model: string;
    baseURL: string;
  };
}

export interface AgentProvider {
  name: AgentProviderName;
  run: (request: AgentRequest, prompt: BuiltAgentPrompt) => Promise<AgentProviderResult>;
}

export const getAgentProviderConfig = (): AgentProviderConfig => {
  const env = getServerEnv();
  return {
    provider: parseProviderName(env.AGENT_PROVIDER),
    openai: {
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL || 'gpt-5.2'
    },
    minimax: {
      apiKey: env.MINIMAX_API_KEY,
      model: env.MINIMAX_MODEL || 'MiniMax-M3',
      baseURL: env.MINIMAX_BASE_URL || 'https://api.minimaxi.com/v1'
    }
  };
};

const parseProviderName = (value?: string): AgentProviderName => {
  if (value === 'openai' || value === 'minimax') return value;
  return 'mock';
};

const getServerEnv = (): Record<string, string | undefined> => {
  return typeof process === 'undefined' ? {} : process.env;
};
