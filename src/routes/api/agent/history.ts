import { createFileRoute } from '@tanstack/react-router';
import {
  readAgentChatHistory,
  removeAgentChatHistory,
  writeAgentChatHistory
} from '../../../server/agentChatHistoryRepository';

const maxPersistedMessages = 100;
const defaultChatId = 'event-modeling-assistant';

export const Route = createFileRoute('/api/agent/history')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const chatId = getChatId(request);
        return Response.json({
          chatId,
          messages: readAgentChatHistory(chatId)
        });
      },
      PUT: async ({ request }) => {
        const chatId = getChatId(request);
        const body = await request.json() as { messages?: unknown };
        if (!Array.isArray(body.messages)) {
          return Response.json({ error: 'messages must be an array' }, { status: 400 });
        }

        const messages = body.messages.slice(-maxPersistedMessages);
        writeAgentChatHistory(chatId, messages);
        return Response.json({ chatId, count: messages.length });
      },
      DELETE: ({ request }) => {
        const chatId = getChatId(request);
        removeAgentChatHistory(chatId);
        return new Response(null, { status: 204 });
      }
    }
  }
});

const getChatId = (request: Request): string => {
  const value = new URL(request.url).searchParams.get('chatId')?.trim();
  return value || defaultChatId;
};
