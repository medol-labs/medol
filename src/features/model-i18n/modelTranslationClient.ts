import type { AgentUsage } from '../agent-chat/agentUsage';
import type { ModelTranslations } from './modelTranslation';

export interface ModelTranslationGenerationResult {
  locale: string;
  sourceHash: string;
  total: number;
  translated: number;
  missing: string[];
  translations: ModelTranslations;
  codegen: {
    locales: string[];
    defaultLocale: string;
    translations: Record<string, ModelTranslations>;
  };
  usage?: AgentUsage;
  warning?: string;
}

export interface StoredModelTranslationsResult {
  locale: string;
  sourceHash: string;
  translated: number;
  translations: ModelTranslations;
  codegen: {
    locales: string[];
    defaultLocale: string;
    translations: Record<string, ModelTranslations>;
  };
}

export const generateModelTranslations = async (input: {
  dsl: string;
  locale: string;
  workspaceId?: string;
  regenerate?: boolean;
  signal?: AbortSignal;
}): Promise<ModelTranslationGenerationResult> => {
  const response = await fetch('/api/modeling/translations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      medol: input.dsl,
      locale: input.locale,
      workspaceId: input.workspaceId,
      regenerate: Boolean(input.regenerate)
    }),
    signal: input.signal
  });
  if (!response.ok) {
    const body = await response.json().catch(() => undefined) as { error?: string } | undefined;
    throw new Error(body?.error ?? `Model translation failed with HTTP ${response.status}`);
  }
  return response.json() as Promise<ModelTranslationGenerationResult>;
};

export const readStoredModelTranslations = async (input: {
  locale: string;
  sourceHash: string;
  workspaceId?: string;
  signal?: AbortSignal;
}): Promise<StoredModelTranslationsResult> => {
  const searchParams = new URLSearchParams({
    locale: input.locale,
    sourceHash: input.sourceHash
  });
  if (input.workspaceId) {
    searchParams.set('workspaceId', input.workspaceId);
  }

  const response = await fetch(`/api/modeling/translations?${searchParams.toString()}`, {
    signal: input.signal
  });
  if (!response.ok) {
    const body = await response.json().catch(() => undefined) as { error?: string } | undefined;
    throw new Error(body?.error ?? `Reading model translations failed with HTTP ${response.status}`);
  }
  return response.json() as Promise<StoredModelTranslationsResult>;
};
