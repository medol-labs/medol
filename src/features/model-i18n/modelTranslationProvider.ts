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
  glossary?: ModelTranslations;
  scope?: {
    kind: string;
    name: string;
    contextName?: string;
  };
}): Promise<ModelTranslationProviderResult> => {
  const sourceTexts = input.sourceTexts.filter((text) => text.trim().length > 0);
  if (sourceTexts.length === 0) return { translations: {} };
  if (isIdentityLocale(input.locale)) {
    return {
      translations: Object.fromEntries(sourceTexts.map((text) => [text, text])),
      provider: 'local',
      model: 'identity'
    };
  }

  const config = getAgentProviderConfig();
  if (config.provider === 'mock') {
    return { warning: '模型翻译服务未配置，未生成新的翻译。' };
  }

  const prompt = buildPrompt({
    sourceTexts,
    locale: input.locale,
    glossary: input.glossary,
    scope: input.scope
  });
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
        translations: completeTranslations(translations, sourceTexts),
        usage,
        provider: 'openai',
        model: config.openai.model
      };
    } catch (error) {
      console.error('[model-i18n] OpenAI model translation request failed', error);
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
        max_output_tokens: Math.max(4096, Math.min(12000, sourceTexts.length * 96)),
        reasoning: { effort: 'low' }
      })
    });
    const responseText = await response.text();
    if (!response.ok) {
      console.error('[model-i18n] MiniMax model translation request failed', {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      });
      return { warning: `模型翻译服务暂不可用（HTTP ${response.status}），未生成新的翻译。` };
    }
    const responseJson = parseJson(responseText);
    const output = extractOutputText(responseJson) ?? responseText;
    const complete = normalizeModelTranslationResponse(
      parseEmbeddedJson(output),
      sourceTexts
    );
    if (!complete) {
      console.error('[model-i18n] Model translation response did not match schema', {
        output
      });
      return { warning: '模型翻译结果格式不完整，未生成新的翻译。' };
    }
    const missing = sourceTexts.filter((sourceText) => !complete[sourceText]);
    const usage = extractOpenAiCompatibleUsage(responseJson, {
      provider: 'minimax',
      model: config.minimax.model
    }) ?? estimateAgentUsage(
      { provider: 'minimax', model: config.minimax.model },
      `${translationSystemPrompt}\n${prompt}`,
      output
    );
    if (missing.length > 0 && Object.keys(complete).length > 0) {
      console.error('[model-i18n] Model translation response missed source strings', {
        missing,
        translated: Object.keys(complete).length,
        expected: sourceTexts.length
      });
      return {
        translations: complete,
        usage,
        provider: 'minimax',
        model: config.minimax.model,
        warning: `模型翻译结果缺少 ${missing.length} 个条目，已保存其余 ${Object.keys(complete).length} 个翻译。`
      };
    }
    return {
      translations: complete,
      usage,
      provider: 'minimax',
      model: config.minimax.model
    };
  } catch (error) {
    console.error('[model-i18n] MiniMax model translation request failed', error);
    return { warning: formatWarning(error) };
  }
};

const translationSystemPrompt = [
  'You are a senior localization specialist for domain modeling and enterprise software.',
  'Translate only the supplied English UI/domain strings into the requested locale.',
  'When a glossary is supplied, reuse those translations exactly for the same source terms and keep related terminology consistent.',
  'Do not add, remove, infer, summarize, or reinterpret business facts.',
  'Keep identifiers, product names, acronyms, and established technical terms accurate.',
  'Return exactly one JSON object mapping every input string to its translated string.',
  'Every input string must appear as a key in the output object.',
  'Values must contain only the translation, without the English source in parentheses.'
].join('\n');

const buildPrompt = (input: {
  sourceTexts: string[];
  locale: string;
  glossary?: ModelTranslations;
  scope?: {
    kind: string;
    name: string;
    contextName?: string;
  };
}): string =>
  JSON.stringify({
    locale: input.locale,
    ...(input.scope ? { scope: input.scope } : {}),
    sourceTexts: input.sourceTexts,
    ...(input.glossary && Object.keys(input.glossary).length > 0
      ? { glossary: input.glossary }
      : {})
  });

const isIdentityLocale = (locale: string): boolean => {
  const normalized = locale.trim().toLowerCase();
  return normalized === 'en' || normalized === 'en-us' || normalized === 'en_us';
};

const completeTranslations = (
  translations: ModelTranslations,
  sourceTexts: string[]
): ModelTranslations =>
  Object.fromEntries(sourceTexts
    .filter((sourceText) => translations[sourceText]?.trim())
    .map((sourceText) => [sourceText, translations[sourceText]]));

export const normalizeModelTranslationResponse = (
  value: unknown,
  sourceTexts: string[]
): ModelTranslations | undefined => {
  const direct = collectDirectTranslations(value, sourceTexts);
  const nested = collectNestedTranslations(value, sourceTexts);
  const best = [direct, ...nested]
    .filter((translations): translations is ModelTranslations => Boolean(translations))
    .sort((left, right) => Object.keys(right).length - Object.keys(left).length)[0];
  return best && Object.keys(best).length > 0 ? best : undefined;
};

const collectDirectTranslations = (
  value: unknown,
  sourceTexts: string[]
): ModelTranslations | undefined => {
  if (Array.isArray(value)) return collectEntryTranslations(value, sourceTexts);
  if (!isRecord(value)) return undefined;
  const literal: ModelTranslations = {};
  for (const sourceText of sourceTexts) {
    const valueForSource = value[sourceText];
    if (typeof valueForSource === 'string' && valueForSource.trim()) {
      literal[sourceText] = valueForSource.trim();
      continue;
    }
    if (isRecord(valueForSource)) {
      const translated = firstString(valueForSource, [
        'translation',
        'translated',
        'translatedText',
        'translated_text',
        'target',
        'value',
        'output',
        'zh-CN',
        'zh_CN',
        'zh',
        '中文',
        '译文'
      ]);
      if (translated) literal[sourceText] = translated;
    }
  }
  return completeTranslations(literal, sourceTexts);
};

const collectNestedTranslations = (
  value: unknown,
  sourceTexts: string[]
): ModelTranslations[] => {
  if (!isRecord(value)) return [];
  const candidates: ModelTranslations[] = [];
  for (const key of [
    'translations',
    'translation',
    'result',
    'results',
    'data',
    'items',
    'entries',
    'dictionary',
    'glossary'
  ]) {
    const nested = value[key];
    const direct = collectDirectTranslations(nested, sourceTexts);
    if (direct) candidates.push(direct);
    candidates.push(...collectNestedTranslations(nested, sourceTexts));
  }
  for (const nested of Object.values(value).filter(isRecord)) {
    const direct = collectDirectTranslations(nested, sourceTexts);
    if (direct) candidates.push(direct);
  }
  return candidates;
};

const collectEntryTranslations = (
  value: unknown[],
  sourceTexts: string[]
): ModelTranslations | undefined => {
  const translations: ModelTranslations = {};
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const source = firstString(entry, [
      'source',
      'sourceText',
      'source_text',
      'key',
      'original',
      'text',
      'input',
      '原文'
    ]);
    const translated = firstString(entry, [
      'translation',
      'translated',
      'translatedText',
      'translated_text',
      'target',
      'value',
      'output',
      'zh-CN',
      'zh_CN',
      'zh',
      '中文',
      '译文'
    ]);
    if (source && translated && sourceTexts.includes(source)) {
      translations[source] = translated;
    }
  }
  for (const entry of value) {
    if (
      Array.isArray(entry)
      && entry.length >= 2
      && typeof entry[0] === 'string'
      && typeof entry[1] === 'string'
      && sourceTexts.includes(entry[0])
    ) {
      translations[entry[0]] = entry[1];
    }
  }
  return completeTranslations(translations, sourceTexts);
};

const firstString = (
  record: Record<string, unknown>,
  keys: string[]
): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseEmbeddedJson = (value: string): unknown => {
  const trimmed = value.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const direct = parseJson(trimmed);
  if (direct) return direct;
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const object = parseJson(trimmed.slice(start, end + 1));
    if (object) return object;
  }
  const arrayStart = trimmed.indexOf('[');
  const arrayEnd = trimmed.lastIndexOf(']');
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    const array = parseJson(trimmed.slice(arrayStart, arrayEnd + 1));
    if (array) return array;
  }
  return undefined;
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
