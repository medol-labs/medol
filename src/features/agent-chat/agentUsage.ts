export interface AgentUsage {
  provider: string;
  model: string;
  measurement?: 'reported' | 'estimated';
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
  requestCount: number;
}

export interface AgentProviderResult {
  response: unknown;
  usage?: AgentUsage;
}

export const createAgentProviderResult = (
  response: unknown,
  usage?: AgentUsage
): AgentProviderResult => ({
  response,
  ...(usage ? { usage } : {})
});

export const mergeAgentUsage = (
  current: AgentUsage | undefined,
  next: AgentUsage
): AgentUsage => {
  if (!current) return next;
  return {
    provider: next.provider,
    model: next.model,
    measurement: current.measurement === 'estimated' || next.measurement === 'estimated'
      ? 'estimated'
      : 'reported',
    inputTokens: sum(current.inputTokens, next.inputTokens),
    outputTokens: sum(current.outputTokens, next.outputTokens),
    totalTokens: sum(current.totalTokens, next.totalTokens),
    cachedInputTokens: sum(current.cachedInputTokens, next.cachedInputTokens),
    reasoningTokens: sum(current.reasoningTokens, next.reasoningTokens),
    requestCount: current.requestCount + next.requestCount
  };
};

export const sumAgentUsage = (items: AgentUsage[]): AgentUsage | undefined => {
  return items.reduce<AgentUsage | undefined>(mergeAgentUsage, undefined);
};

export const extractOpenAiCompatibleUsage = (
  value: unknown,
  source: Pick<AgentUsage, 'provider' | 'model'>
): AgentUsage | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const usage = (value as Record<string, unknown>).usage;
  if (!usage || typeof usage !== 'object') return undefined;
  const record = usage as Record<string, unknown>;
  const inputDetails = asRecord(record.input_tokens_details) ?? asRecord(record.prompt_tokens_details);
  const outputDetails = asRecord(record.output_tokens_details) ?? asRecord(record.completion_tokens_details);
  const inputTokens = readNumber(record, ['input_tokens', 'prompt_tokens']);
  const outputTokens = readNumber(record, ['output_tokens', 'completion_tokens']);
  const totalTokens = readNumber(record, ['total_tokens'])
    ?? sum(inputTokens, outputTokens);
  const cachedInputTokens = readNumber(record, ['cache_read_input_tokens', 'cached_tokens'])
    ?? readNumber(inputDetails, ['cached_tokens', 'cache_read_tokens']);
  const reasoningTokens = readNumber(record, ['reasoning_tokens'])
    ?? readNumber(outputDetails, ['reasoning_tokens']);

  if (
    inputTokens === undefined
    && outputTokens === undefined
    && totalTokens === undefined
    && cachedInputTokens === undefined
    && reasoningTokens === undefined
  ) {
    return undefined;
  }

  return {
    ...source,
    measurement: 'reported',
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    ...(totalTokens !== undefined ? { totalTokens } : {}),
    ...(cachedInputTokens !== undefined ? { cachedInputTokens } : {}),
    ...(reasoningTokens !== undefined ? { reasoningTokens } : {}),
    requestCount: 1
  };
};

export const estimateAgentUsage = (
  source: Pick<AgentUsage, 'provider' | 'model'>,
  input: string,
  output: string
): AgentUsage => {
  const inputTokens = estimateTokens(input);
  const outputTokens = estimateTokens(output);
  return {
    ...source,
    measurement: 'estimated',
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    requestCount: 1
  };
};

const sum = (left?: number, right?: number): number | undefined => {
  return left !== undefined || right !== undefined
    ? (left ?? 0) + (right ?? 0)
    : undefined;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined => {
  return value && typeof value === 'object'
    ? value as Record<string, unknown>
    : undefined;
};

const readNumber = (
  record: Record<string, unknown> | undefined,
  keys: string[]
): number | undefined => {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const estimateTokens = (text: string): number => {
  return Math.max(1, Math.ceil(text.length / 4));
};
