import type {
  DocumentationKind,
  DocumentationLanguage,
  GeneratedDocumentation
} from '../../lib/generators/documentation';
import type { AgentUsage } from '../agent-chat/agentUsage';

export interface DocumentationGenerationResult extends GeneratedDocumentation {
  enhanced: boolean;
  usage?: AgentUsage;
  warning?: string;
}

export const generateModelingDocument = async (input: {
  dsl: string;
  kind: DocumentationKind;
  language?: DocumentationLanguage;
  enhanceWithAi?: boolean;
  signal?: AbortSignal;
}): Promise<DocumentationGenerationResult> => {
  const response = await fetch('/api/modeling/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      medol: input.dsl,
      kind: input.kind,
      language: input.language ?? 'en',
      enhanceWithAi: Boolean(input.enhanceWithAi)
    }),
    signal: input.signal
  });
  if (!response.ok) {
    const body = await response.json().catch(() => undefined) as { error?: string } | undefined;
    throw new Error(body?.error ?? `Document generation failed with HTTP ${response.status}`);
  }
  return response.json() as Promise<DocumentationGenerationResult>;
};
