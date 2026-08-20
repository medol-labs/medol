import {
  generateDocumentation,
  type GeneratedDocumentation
} from '../../lib/generators/documentation';
import type { EmModel } from '../../lib/model';
import type { AgentUsage } from '../agent-chat/agentUsage';
import type { ModelTranslations } from '../model-i18n/modelTranslation';
import {
  translateDocumentationModelWithModelTranslations
} from './documentationTranslation';

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
  modelTranslations?: ModelTranslations;
}): Promise<DocumentationAgentResult> => {
  if (input.document.language !== 'zh-CN') {
    return {
      markdown: input.document.markdown,
      enhanced: false
    };
  }

  const modelTranslations = input.modelTranslations ?? {};
  if (Object.keys(modelTranslations).length === 0) {
    return {
      markdown: input.document.markdown,
      enhanced: false,
      warning: '未找到模型国际化术语库，已使用基础中文模板。请先执行 Translate model 以获得统一术语。'
    };
  }

  const translatedModel = translateDocumentationModelWithModelTranslations(
    input.model,
    modelTranslations
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
    enhanced: true
  };
};
