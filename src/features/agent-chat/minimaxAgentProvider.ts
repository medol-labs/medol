import type { BuiltAgentPrompt } from './agentPromptBuilder';
import type { AgentProvider, AgentProviderConfig } from './agentProvider';
import type { AgentRequest } from './agentTypes';
import { parseAgentStructuredResponse, type AgentStructuredResponse } from './agentStructuredResponse';

export const createMiniMaxAgentProvider = (config: AgentProviderConfig['minimax']): AgentProvider => ({
  name: 'minimax',
  run: async (_request: AgentRequest, prompt: BuiltAgentPrompt): Promise<unknown> => {
    if (!config.apiKey) {
      return {
        type: 'answer',
        content: 'MiniMax provider is selected, but MINIMAX_API_KEY is not configured on the server.'
      } satisfies AgentStructuredResponse;
    }

    try {
      const response = await fetch(`${trimTrailingSlash(config.baseURL)}/responses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.model,
          instructions: [
            prompt.system,
            'Return only one valid JSON object. Do not wrap it in markdown fences. Do not add explanatory text outside JSON.'
          ].join('\n\n'),
          input: [
            prompt.user,
            '',
            'Output must be valid JSON matching exactly one of these shapes:',
            '{"type":"answer","content":"..."}',
            '{"type":"clarification","content":"...","questions":["..."]}',
            '{"type":"dsl_patch_proposal","content":"...","patch":{"summary":"...","reason":"...","target":"slice Name","changeType":"insert","operations":[{"operation":"insert","target":"slice Name","content":"...","rule":"..."}],"preview":"...","focusTarget":{"kind":"slice","name":"Name"}}}'
          ].join('\n'),
          temperature: 0,
          reasoning: {
            effort: 'low'
          }
        })
      });

      const responseText = await response.text();
      if (!response.ok) {
        return {
          type: 'answer',
          content: `MiniMax M3 API request failed with HTTP ${response.status}: ${responseText.slice(0, 800)}`
        } satisfies AgentStructuredResponse;
      }

      const responseJson = parseJsonObject(responseText);
      const outputText = extractMiniMaxOutputText(responseJson) ?? responseText;
      const parsed = parseMiniMaxJsonResponse(outputText);
      if (parsed) return parsed;

      return {
        type: 'answer',
        content: `MiniMax M3 returned a response, but it was not valid structured agent JSON: ${outputText.slice(0, 800)}`
      } satisfies AgentStructuredResponse;
    } catch (error) {
      return {
        type: 'answer',
        content: `MiniMax M3 API request failed: ${formatError(error)}`
      } satisfies AgentStructuredResponse;
    }
  }
});

const extractMiniMaxOutputText = (value: unknown): string | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;

  if (typeof record.output_text === 'string') return record.output_text;
  if (typeof record.text === 'string') return record.text;

  if (Array.isArray(record.output)) {
    const parts = record.output.flatMap((item) => extractOutputItemText(item));
    if (parts.length > 0) return parts.join('\n');
  }

  if (Array.isArray(record.choices)) {
    const parts = record.choices.flatMap((choice) => extractChoiceText(choice));
    if (parts.length > 0) return parts.join('\n');
  }

  return undefined;
};

const extractOutputItemText = (value: unknown): string[] => {
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  if (typeof record.content === 'string') return [record.content];
  if (!Array.isArray(record.content)) return [];

  return record.content.flatMap((contentItem) => {
    if (!contentItem || typeof contentItem !== 'object') return [];
    const contentRecord = contentItem as Record<string, unknown>;
    if (typeof contentRecord.text === 'string') return [contentRecord.text];
    if (typeof contentRecord.output_text === 'string') return [contentRecord.output_text];
    return [];
  });
};

const extractChoiceText = (value: unknown): string[] => {
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  const message = record.message;
  if (!message || typeof message !== 'object') return [];
  const messageRecord = message as Record<string, unknown>;
  return typeof messageRecord.content === 'string' ? [messageRecord.content] : [];
};

const parseMiniMaxJsonResponse = (value: unknown): AgentStructuredResponse | undefined => {
  const direct = parseAgentStructuredResponse(value);
  if (direct) return direct;

  if (typeof value !== 'string') return undefined;
  const parsed = parseJsonObject(value);
  return parsed ? parseAgentStructuredResponse(parsed) : undefined;
};

const parseJsonObject = (text: string): unknown | undefined => {
  const trimmed = text.trim();
  const jsonText = stripMarkdownFence(trimmed) ?? extractJsonObject(trimmed);
  if (!jsonText) return undefined;

  try {
    return JSON.parse(jsonText);
  } catch {
    return undefined;
  }
};

const stripMarkdownFence = (text: string): string | undefined => {
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  return match?.[1]?.trim();
};

const extractJsonObject = (text: string): string | undefined => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return undefined;
  return text.slice(start, end + 1);
};

const trimTrailingSlash = (value: string): string => {
  return value.replace(/\/+$/, '');
};

const formatError = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};
