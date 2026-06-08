import type { ChatFetcherInput, ChatFetcherOptions } from '@tanstack/ai-client';
import type { StreamChunk } from '@tanstack/ai/client';
import { runMockAgent } from './mockAgentRuntime';
import type { AgentDslPatch, AgentRequest } from './agentTypes';

interface MockAgentForwardedProps extends Omit<AgentRequest, 'prompt'> {
  prompt?: string;
}

export const eventModelingAgentMockFetcher = async function* (
  input: ChatFetcherInput,
  _options: ChatFetcherOptions
): AsyncIterable<StreamChunk> {
  const data = (input.data ?? {}) as Partial<MockAgentForwardedProps>;
  const prompt = data.prompt ?? latestUserText(input.messages);
  const messageId = createId('assistant');
  const model = 'event-modeling-mock';
  const timestamp = Date.now();

  yield {
    type: 'RUN_STARTED',
    threadId: input.threadId,
    runId: input.runId,
    model,
    timestamp
  } as StreamChunk;

  yield {
    type: 'TEXT_MESSAGE_START',
    messageId,
    role: 'assistant',
    model
  } as StreamChunk;

  if (!prompt || !data.dsl || !data.model) {
    yield* streamText(messageId, 'Select modeling context and enter a request before running the agent.', model);
    yield { type: 'TEXT_MESSAGE_END', messageId, model } as StreamChunk;
    yield finish(input, model);
    return;
  }

  const response = await runMockAgent({
    prompt,
    dsl: data.dsl,
    model: data.model,
    selectedItem: data.selectedItem
  });

  yield* streamText(messageId, response.content, model);

  if (response.patch) {
    yield {
      type: 'CUSTOM',
      name: 'event-modeling.patch-proposed',
      value: {
        messageId,
        patch: response.patch
      } satisfies PatchProposedEvent,
      model
    } as StreamChunk;
  }

  yield { type: 'TEXT_MESSAGE_END', messageId, model } as StreamChunk;
  yield finish(input, model);
};

interface PatchProposedEvent {
  messageId: string;
  patch: AgentDslPatch;
}

const streamText = async function* (
  messageId: string,
  text: string,
  model: string
): AsyncIterable<StreamChunk> {
  yield {
    type: 'TEXT_MESSAGE_CONTENT',
    messageId,
    delta: text,
    content: text,
    model
  } as StreamChunk;
};

const finish = (input: ChatFetcherInput, model: string): StreamChunk => ({
  type: 'RUN_FINISHED',
  threadId: input.threadId,
  runId: input.runId,
  model,
  timestamp: Date.now(),
  finishReason: 'stop'
}) as StreamChunk;

const latestUserText = (messages: ChatFetcherInput['messages']): string => {
  const latestUser = [...messages].reverse().find((message) => message.role === 'user');
  if (!latestUser) return '';

  return latestUser.parts
    .filter((part): part is Extract<(typeof latestUser.parts)[number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.content)
    .join('\n')
    .trim();
};

const createId = (prefix: string): string => {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};
