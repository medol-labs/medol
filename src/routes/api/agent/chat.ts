import { createFileRoute } from '@tanstack/react-router';
import { toServerSentEventsResponse } from '@tanstack/ai';
import type { StreamChunk } from '@tanstack/ai/client';
import { runMockAgent } from '../../../features/agent-chat/mockAgentRuntime';
import type { AgentDslPatch, AgentRequest } from '../../../features/agent-chat/agentTypes';

type AgentChatRequestBody = {
  threadId?: string;
  runId?: string;
  messages?: WireMessage[];
  forwardedProps?: Partial<Omit<AgentRequest, 'prompt'>> & { prompt?: string };
  data?: Partial<Omit<AgentRequest, 'prompt'>> & { prompt?: string };
};

type WireMessage = {
  role?: string;
  content?: unknown;
  parts?: unknown;
};

export const Route = createFileRoute('/api/agent/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json() as AgentChatRequestBody;
        const forwardedProps = body.forwardedProps ?? body.data ?? {};
        const stream = createEventModelingAgentStream({
          threadId: body.threadId ?? createId('thread'),
          runId: body.runId ?? createId('run'),
          prompt: forwardedProps.prompt ?? latestUserText(body.messages ?? []),
          dsl: forwardedProps.dsl,
          model: forwardedProps.model,
          selectedItem: forwardedProps.selectedItem
        });

        return toServerSentEventsResponse(stream);
      }
    }
  }
});

async function* createEventModelingAgentStream(input: {
  threadId: string;
  runId: string;
  prompt: string;
} & Partial<Omit<AgentRequest, 'prompt'>>): AsyncIterable<StreamChunk> {
  const messageId = createId('assistant');
  const model = 'event-modeling-agent';
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

  if (!input.prompt || !input.dsl || !input.model) {
    yield* streamText(messageId, 'Select modeling context and enter a request before running the agent.', model);
    yield { type: 'TEXT_MESSAGE_END', messageId, model } as StreamChunk;
    yield finish(input.threadId, input.runId, model);
    return;
  }

  const response = await runMockAgent({
    prompt: input.prompt,
    dsl: input.dsl,
    model: input.model,
    selectedItem: input.selectedItem
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
  yield finish(input.threadId, input.runId, model);
}

interface PatchProposedEvent {
  messageId: string;
  patch: AgentDslPatch;
}

async function* streamText(messageId: string, text: string, model: string): AsyncIterable<StreamChunk> {
  let content = '';
  for (const delta of chunkText(text)) {
    content += delta;
    yield {
      type: 'TEXT_MESSAGE_CONTENT',
      messageId,
      delta,
      content,
      model
    } as StreamChunk;
    await new Promise((resolve) => globalThis.setTimeout(resolve, 14));
  }
}

const finish = (threadId: string, runId: string, model: string): StreamChunk => ({
  type: 'RUN_FINISHED',
  threadId,
  runId,
  model,
  timestamp: Date.now(),
  finishReason: 'stop'
}) as StreamChunk;

const latestUserText = (messages: WireMessage[]): string => {
  const latestUser = [...messages].reverse().find((message) => message.role === 'user');
  if (!latestUser) return '';
  return contentToText(latestUser.content ?? latestUser.parts).trim();
};

const contentToText = (content: unknown): string => {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (!part || typeof part !== 'object') return '';
      const record = part as Record<string, unknown>;
      return typeof record.text === 'string'
        ? record.text
        : typeof record.content === 'string'
          ? record.content
          : '';
    })
    .filter(Boolean)
    .join('\n');
};

const chunkText = (text: string): string[] => {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += 18) {
    chunks.push(text.slice(index, index + 18));
  }
  return chunks.length > 0 ? chunks : [''];
};

const createId = (prefix: string): string => {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};
