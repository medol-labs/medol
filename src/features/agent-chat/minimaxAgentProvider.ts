import type { BuiltAgentPrompt } from './agentPromptBuilder';
import type { AgentProvider, AgentProviderConfig } from './agentProvider';
import type { AgentRequest } from './agentTypes';
import { parseAgentMixedResponse } from './agentMixedResponse';
import type { AgentStructuredResponse } from './agentStructuredResponse';
import {
  createAgentProviderResult,
  estimateAgentUsage,
  extractOpenAiCompatibleUsage
} from './agentUsage';

export const createMiniMaxAgentProvider = (config: AgentProviderConfig['minimax']): AgentProvider => ({
  name: 'minimax',
  run: async (_request: AgentRequest, prompt: BuiltAgentPrompt) => {
    if (!config.apiKey) {
      return createAgentProviderResult({
        type: 'answer',
        content: 'MiniMax provider is selected, but MINIMAX_API_KEY is not configured on the server.'
      } satisfies AgentStructuredResponse);
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
            prompt.modelingSystem,
            'Respond naturally to the user first.',
            'For an ordinary question that does not require structured modeling data, return natural language only.',
            'When a MEDOL patch or structured clarification is needed, append one JSON object inside <agent-json>...</agent-json> after the natural-language response.',
            'The JSON block is machine-readable and must not contain prose outside its JSON string values.'
          ].join('\n\n'),
          input: [
            prompt.user,
            '',
            'Optional structured JSON shapes:',
            '{"type":"clarification","content":"...","questions":["..."]}',
            '{"type":"medol_patch_proposal","content":"...","patch":{"summary":"...","reason":"...","target":"slice Name","changeType":"insert","operations":[{"operation":"insert","target":"slice Name","content":"...","rule":"..."}],"preview":"...","focusTarget":{"kind":"slice","name":"Name"}}}'
          ].join('\n'),
          temperature: 0,
          reasoning: {
            effort: 'low'
          }
        })
      });

      const responseText = await response.text();
      if (!response.ok) {
        return createAgentProviderResult({
          type: 'answer',
          content: `MiniMax M3 API request failed with HTTP ${response.status}: ${responseText.slice(0, 800)}`
        } satisfies AgentStructuredResponse);
      }

      const responseJson = parseApiResponseJson(responseText);
      const outputText = extractMiniMaxOutputText(responseJson) ?? responseText;
      const usage = extractOpenAiCompatibleUsage(findUsageContainer(responseJson), {
        provider: 'minimax',
        model: config.model
      }) ?? estimateAgentUsage(
        { provider: 'minimax', model: config.model },
        `${prompt.modelingSystem}\n${prompt.user}`,
        outputText
      );
      return createAgentProviderResult(
        parseAgentMixedResponse(outputText),
        usage
      );
    } catch (error) {
      return createAgentProviderResult({
        type: 'answer',
        content: `MiniMax M3 API request failed: ${formatError(error)}`
      } satisfies AgentStructuredResponse);
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

const parseApiResponseJson = (text: string): unknown | undefined => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const findUsageContainer = (value: unknown): unknown => {
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  if (record.usage && typeof record.usage === 'object') return value;

  for (const key of ['data', 'response', 'result']) {
    const nested = record[key];
    if (nested && typeof nested === 'object') {
      const nestedRecord = nested as Record<string, unknown>;
      if (nestedRecord.usage && typeof nestedRecord.usage === 'object') return nested;
    }
  }

  return value;
};

const trimTrailingSlash = (value: string): string => {
  return value.replace(/\/+$/, '');
};

const formatError = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};
