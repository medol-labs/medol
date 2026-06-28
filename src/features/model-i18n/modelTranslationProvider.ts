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
import type { ModelTranslations } from './modelTranslation';

const translationSchema = z.record(z.string(), z.string());

export interface ModelTranslationProviderResult {
  translations?: ModelTranslations;
  usage?: AgentUsage;
  warning?: string;
  provider?: string;
  model?: string;
}

export const requestModelTranslations = async (input: {
  sourceTexts: string[];
  locale: string;
}): Promise<ModelTranslationProviderResult> => {
  const sourceTexts = input.sourceTexts.filter((text) => text.trim().length > 0);
  if (sourceTexts.length === 0) return { translations: {} };

  const config = getAgentProviderConfig();
  if (config.provider === 'mock') {
    return { warning: '模型翻译服务未配置，未生成新的翻译。' };
  }

  const prompt = buildPrompt(sourceTexts, input.locale);
  if (config.provider === 'openai') {
    if (!config.openai.apiKey) {
      return { warning: 'OpenAI 翻译服务未配置，未生成新的翻译。' };
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
          name: 'model-translation-usage',
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
      return {
        translations,
        usage,
        provider: 'openai',
        model: config.openai.model
      };
    } catch (error) {
      return { warning: formatWarning(error) };
    }
  }

  if (!config.minimax.apiKey) {
    return { warning: 'MiniMax 翻译服务未配置，未生成新的翻译。' };
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
      return { warning: `模型翻译服务暂不可用（HTTP ${response.status}），未生成新的翻译。` };
    }
    const responseJson = parseJson(responseText);
    const output = extractOutputText(responseJson) ?? responseText;
    const translations = translationSchema.safeParse(parseEmbeddedJson(output));
    if (!translations.success) {
      return { warning: '模型翻译结果格式不完整，未生成新的翻译。' };
    }
    const usage = extractOpenAiCompatibleUsage(responseJson, {
      provider: 'minimax',
      model: config.minimax.model
    }) ?? estimateAgentUsage(
      { provider: 'minimax', model: config.minimax.model },
      `${translationSystemPrompt}\n${prompt}`,
      output
    );
    return {
      translations: translations.data,
      usage,
      provider: 'minimax',
      model: config.minimax.model
    };
  } catch (error) {
    return { warning: formatWarning(error) };
  }
};

const translationSystemPrompt = [
  'You are a senior localization specialist for domain modeling and enterprise software.',
  'Translate only the supplied English UI/domain strings into the requested locale.',
  'Do not add, remove, infer, summarize, or reinterpret business facts.',
  'Keep identifiers, product names, acronyms, and established technical terms accurate.',
  'Return exactly one JSON object mapping every input string to its translated string.',
  'Every input string must appear as a key in the output object.',
  'Values must contain only the translation, without the English source in parentheses.'
].join('\n');

const buildPrompt = (sourceTexts: string[], locale: string): string =>
  JSON.stringify({ locale, sourceTexts });

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
  '模型翻译服务暂不可用，未生成新的翻译。';
