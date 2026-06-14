import { chat } from '@tanstack/ai';
import { createOpenaiChat, type OpenAIChatModel } from '@tanstack/ai-openai';
import { z } from 'zod';
import { getAgentProviderConfig } from '../agent-chat/agentProvider';
import {
  estimateAgentUsage,
  extractOpenAiCompatibleUsage,
  mergeAgentUsage,
  type AgentUsage
} from '../agent-chat/agentUsage';
import type {
  DocumentationTranslationCatalog,
  DocumentationTranslations
} from './documentationTranslation';

const translationSchema = z.object({
  identifiers: z.record(z.string(), z.string()),
  narratives: z.record(z.string(), z.string())
});

export interface DocumentationTranslationResult {
  translations?: DocumentationTranslations;
  usage?: AgentUsage;
  warning?: string;
}

export const requestDocumentationTranslations = async (
  catalog: DocumentationTranslationCatalog
): Promise<DocumentationTranslationResult> => {
  const config = getAgentProviderConfig();
  if (config.provider === 'mock') {
    return { warning: '中文术语服务未配置，已使用基础中文模板。' };
  }

  const prompt = buildPrompt(catalog);
  if (config.provider === 'openai') {
    if (!config.openai.apiKey) {
      return { warning: '中文术语服务未配置，已使用基础中文模板。' };
    }
    try {
      let usage: AgentUsage | undefined;
      const translations = await chat({
        adapter: createOpenaiChat(
          config.openai.model as OpenAIChatModel,
          config.openai.apiKey
        ),
        systemPrompts: [translationSystemPrompt],
        messages: [{ role: 'user', content: prompt }],
        outputSchema: translationSchema,
        temperature: 0,
        middleware: [{
          name: 'documentation-translation-usage',
          onUsage: (_context, currentUsage) => {
            usage = mergeAgentUsage(usage, {
              provider: 'openai',
              model: config.openai.model,
              measurement: 'reported',
              inputTokens: currentUsage.promptTokens,
              outputTokens: currentUsage.completionTokens,
              totalTokens: currentUsage.totalTokens,
              cachedInputTokens: currentUsage.promptTokensDetails?.cachedTokens,
              reasoningTokens: currentUsage.completionTokensDetails?.reasoningTokens,
              requestCount: 1
            });
          }
        }]
      });
      return { translations, usage };
    } catch (error) {
      return { warning: formatWarning(error) };
    }
  }

  if (!config.minimax.apiKey) {
    return { warning: '中文术语服务未配置，已使用基础中文模板。' };
  }
  try {
    const response = await fetch(`${trimTrailingSlash(config.minimax.baseURL)}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.minimax.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.minimax.model,
        instructions: translationSystemPrompt,
        input: prompt,
        temperature: 0,
        reasoning: { effort: 'low' }
      })
    });
    const responseText = await response.text();
    if (!response.ok) {
      return { warning: `中文术语服务暂不可用（HTTP ${response.status}），已使用基础中文模板。` };
    }
    const responseJson = parseJson(responseText);
    const output = extractOutputText(responseJson) ?? responseText;
    const translations = translationSchema.safeParse(parseEmbeddedJson(output));
    if (!translations.success) {
      return { warning: '中文术语结果格式不完整，已使用基础中文模板。' };
    }
    const usage = extractOpenAiCompatibleUsage(responseJson, {
      provider: 'minimax',
      model: config.minimax.model
    }) ?? estimateAgentUsage(
      { provider: 'minimax', model: config.minimax.model },
      `${translationSystemPrompt}\n${prompt}`,
      output
    );
    return { translations: translations.data, usage };
  } catch (error) {
    return { warning: formatWarning(error) };
  }
};

const translationSystemPrompt = [
  'You are a senior Chinese domain analyst and technical writer.',
  'Translate only the supplied English domain vocabulary and business narrative into concise Simplified Chinese.',
  'Do not add, remove, infer, summarize, or reinterpret business facts.',
  'Keep product names and established technical terms accurate.',
  'Return exactly one JSON object with identifiers and narratives maps.',
  'Every input string must appear as a key in the corresponding output map.',
  'Values must contain only the Chinese translation, without the English source in parentheses.'
].join('\n');

const buildPrompt = (catalog: DocumentationTranslationCatalog): string =>
  JSON.stringify(catalog);

const parseEmbeddedJson = (value: string): unknown => {
  const trimmed = value.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const direct = parseJson(trimmed);
  if (direct) return direct;
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  return start >= 0 && end > start
    ? parseJson(trimmed.slice(start, end + 1))
    : undefined;
};

const parseJson = (value: string): unknown | undefined => {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

const extractOutputText = (value: unknown): string | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.output_text === 'string') return record.output_text;
  if (typeof record.text === 'string') return record.text;
  if (Array.isArray(record.output)) {
    const parts = record.output.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const content = (item as Record<string, unknown>).content;
      if (!Array.isArray(content)) return [];
      return content.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return [];
        const text = (entry as Record<string, unknown>).text;
        return typeof text === 'string' ? [text] : [];
      });
    });
    if (parts.length) return parts.join('\n');
  }
  if (Array.isArray(record.choices)) {
    const parts = record.choices.flatMap((choice) => {
      if (!choice || typeof choice !== 'object') return [];
      const message = (choice as Record<string, unknown>).message;
      if (!message || typeof message !== 'object') return [];
      const content = (message as Record<string, unknown>).content;
      return typeof content === 'string' ? [content] : [];
    });
    if (parts.length) return parts.join('\n');
  }
  return undefined;
};

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const formatWarning = (_error: unknown): string =>
  '中文术语服务暂不可用，已使用基础中文模板。';
