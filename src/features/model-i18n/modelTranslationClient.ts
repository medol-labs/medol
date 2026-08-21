import type { AgentUsage } from '../agent-chat/agentUsage';
import type { ModelTranslations } from './modelTranslation';

export interface ModelTranslationGenerationResult {
  locale: string;
  sourceHash: string;
  total: number;
  translated: number;
  reused?: number;
  missing: string[];
  pendingUnits?: ModelTranslationUnitProgress[];
  pendingGroups?: ModelTranslationUnitProgress[];
  processedUnits?: Array<{
    id: string;
    kind: string;
    name: string;
    translated: number;
    total: number;
  }>;
  translations: ModelTranslations;
  codegen: {
    locales: string[];
    defaultLocale: string;
    translations: Record<string, ModelTranslations>;
  };
  title?: string;
  markdown?: string;
  usage?: AgentUsage;
  warning?: string;
}

export interface ModelTranslationUnitProgress {
  id: string;
  kind: string;
  name: string;
  missing: number;
  total: number;
  sourceRefs?: string[];
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
  unitLimit?: number;
  onProgress?: (result: ModelTranslationGenerationResult) => void;
  signal?: AbortSignal;
}): Promise<ModelTranslationGenerationResult> => {
  let latest: ModelTranslationGenerationResult | undefined;
  let first = true;
  let iteration = 0;
  do {
    latest = await requestModelTranslations({
      ...input,
      regenerate: Boolean(input.regenerate && first),
      unitLimit: input.unitLimit ?? 1,
      includeMarkdown: false
    });
    input.onProgress?.(latest);
    first = false;
    iteration += 1;
  } while (
    !input.signal?.aborted
    && !latest.warning
    && latest.missing.length > 0
    && (latest.processedUnits?.length ?? 0) > 0
    && iteration < 10_000
  );

  if (!latest) {
    throw new Error('Model translation did not return a result');
  }
  const warning = latest.warning;
  if (!input.signal?.aborted) {
    const finalResult = await requestModelTranslations({
      ...input,
      regenerate: false,
      unitLimit: 0,
      includeMarkdown: true
    });
    latest = {
      ...finalResult,
      ...(warning ? { warning } : {})
    };
    input.onProgress?.(latest);
  }
  return latest;
};

const requestModelTranslations = async (input: {
  dsl: string;
  locale: string;
  workspaceId?: string;
  regenerate?: boolean;
  unitLimit?: number;
  includeMarkdown?: boolean;
  signal?: AbortSignal;
}): Promise<ModelTranslationGenerationResult> => {
  const response = await fetch('/api/modeling/translations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      medol: input.dsl,
      locale: input.locale,
      workspaceId: input.workspaceId,
      regenerate: Boolean(input.regenerate),
      unitLimit: input.unitLimit,
      includeMarkdown: input.includeMarkdown
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
