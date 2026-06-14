import {
  generateDocumentation,
  type GeneratedDocumentation
} from '../../lib/generators/documentation';
import type { EmModel } from '../../lib/model';
import type { AgentUsage } from '../agent-chat/agentUsage';
import {
  buildDocumentationTranslationCatalog,
  translateDocumentationModel
} from './documentationTranslation';
import { requestDocumentationTranslations } from './documentationTranslationProvider';

export interface DocumentationAgentResult {
  markdown: string;
  enhanced: boolean;
  usage?: AgentUsage;
  warning?: string;
}

export const enhanceDocumentationWithAgent = async (input: {
  dsl: string;
  model: EmModel;
  document: GeneratedDocumentation;
}): Promise<DocumentationAgentResult> => {
  if (input.document.language !== 'zh-CN') {
    return {
      markdown: input.document.markdown,
      enhanced: false
    };
  }

  const catalog = buildDocumentationTranslationCatalog(input.model);
  if (!catalog.identifiers.length && !catalog.narratives.length) {
    return {
      markdown: input.document.markdown,
      enhanced: false
    };
  }

  const result = await requestDocumentationTranslations(catalog);
  if (!result.translations) {
    return {
      markdown: input.document.markdown,
      enhanced: false,
      ...(result.usage ? { usage: result.usage } : {}),
      ...(result.warning ? { warning: result.warning } : {})
    };
  }

  const translatedModel = translateDocumentationModel(
    input.model,
    result.translations
  );
  const translatedDocument = generateDocumentation(
    translatedModel,
    input.document.kind,
    {
      sourceText: input.dsl,
      language: 'zh-CN',
      generatedAt: input.document.bundle.generatedAt
    }
  );

  return {
    markdown: translatedDocument.markdown,
    enhanced: true,
    ...(result.usage ? { usage: result.usage } : {})
  };
};
