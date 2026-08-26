import { getViewportForBounds, type Node } from '@xyflow/react';
import { useState } from 'react';
import type { CreateModelingDocumentInput, ModelingDocument } from '../contracts/modelingDocument';
import { generateModelingDocument } from '../features/documentation/documentationClient';
import {
  generateModelTranslations,
  readCodegenModelJson,
  resolveModelTranslations
} from '../features/model-i18n/modelTranslationClient';
import { exportFlowViewportToPng, exportFlowViewportToSvg } from '../lib/exportFlowImage';
import type { DocumentationLanguage } from '../lib/generators/documentation';
import { getFlowBounds } from './flowBounds';
import {
  documentationKindFromAction,
  isDocumentationAction,
  type PreviewMode,
  type ToolbarAction
} from './studioTypes';

type DocumentNavigationTone = 'info' | 'warning';

interface UseToolbarActionsOptions {
  activeWorkspaceId?: string;
  dsl: string;
  emModelJson: string;
  codegenModelJson: string;
  configJson: string;
  medolSourceHash: string;
  flowNodes: Node[];
  createDocument: (
    input: Omit<CreateModelingDocumentInput, 'workspaceId'>
  ) => Promise<ModelingDocument>;
  onPreviewModeChange: (mode: PreviewMode) => void;
  onDocumentFocusSourceIdChange: (sourceId: string | undefined) => void;
  onDocumentNavigationMessageChange: (message: string | undefined) => void;
  onDocumentNavigationToneChange: (tone: DocumentNavigationTone) => void;
  onResetModel: () => void;
}

export const useToolbarActions = ({
  activeWorkspaceId,
  dsl,
  emModelJson,
  codegenModelJson,
  configJson,
  medolSourceHash,
  flowNodes,
  createDocument,
  onPreviewModeChange,
  onDocumentFocusSourceIdChange,
  onDocumentNavigationMessageChange,
  onDocumentNavigationToneChange,
  onResetModel
}: UseToolbarActionsOptions) => {
  const [toolbarAction, setToolbarAction] = useState<ToolbarAction | ''>('');
  const [toolbarActionPending, setToolbarActionPending] = useState(false);
  const [documentationLanguage, setDocumentationLanguage] = useState<DocumentationLanguage>('en');
  const [modelTranslationMessage, setModelTranslationMessage] = useState<string>();

  const runToolbarAction = async () => {
    if (!toolbarAction || toolbarActionPending) return;
    setToolbarActionPending(true);
    if (isModelTranslationAction(toolbarAction)) {
      setModelTranslationMessage(undefined);
    }

    try {
      if (toolbarAction === 'em-model') {
        downloadJson('em-model.json', emModelJson);
      } else if (toolbarAction === 'codegen-model') {
        const resolvedJson = await resolveCodegenModelJson({
          fallbackJson: codegenModelJson,
          locale: documentationLanguage,
          workspaceId: activeWorkspaceId
        });
        downloadJson(getCodegenModelFilename(documentationLanguage), resolvedJson);
      } else if (toolbarAction === 'config') {
        downloadJson('config.json', configJson);
      } else if (toolbarAction === 'png' && flowNodes.length > 0) {
        await exportFlowViewportToPng({
          ...getImageExportOptions(flowNodes, 'medol-model.png'),
          pixelRatio: 2
        });
      } else if (toolbarAction === 'svg' && flowNodes.length > 0) {
        exportFlowViewportToSvg(getImageExportOptions(flowNodes, 'medol-model.svg'));
      } else if (isDocumentationAction(toolbarAction)) {
        const kind = documentationKindFromAction(toolbarAction);
        const document = await generateModelingDocument({
          dsl,
          kind,
          language: documentationLanguage,
          enhanceWithAi: true,
          workspaceId: activeWorkspaceId
        });
        if (document.warning) console.warn(document.warning);
        const savedDocument = await createDocument({
          title: document.title,
          kind,
          language: documentationLanguage,
          markdown: document.markdown,
          sourceHash: medolSourceHash
        });
        const merge = savedDocument.mergeSummary;
        onDocumentNavigationMessageChange(merge
          ? merge.created
            ? `Created document with ${merge.added} generated sections.`
            : `Incremental update: ${merge.updated} updated, ${merge.added} added, ${merge.removed} removed, ${merge.preserved} manually edited sections preserved.`
          : undefined);
        onDocumentNavigationToneChange(merge?.preserved ? 'warning' : 'info');
        onDocumentFocusSourceIdChange(undefined);
        onPreviewModeChange('documents');
      } else if (toolbarAction === 'model-translations') {
        const locale = modelTranslationLocale(documentationLanguage);
        const result = await generateModelTranslations({
          dsl,
          locale,
          workspaceId: activeWorkspaceId,
          unitLimit: 1,
          onProgress: (progress) => {
            const nextUnit = progress.pendingUnits?.[0];
            setModelTranslationMessage(
              progress.warning
                ? progress.warning
                : nextUnit
                  ? `Translations ${progress.locale}: ${progress.translated}/${progress.total} stored · next ${nextUnit.name}`
                  : `Translations ${progress.locale}: ${progress.translated}/${progress.total} stored`
            );
          }
        });
        if (result.markdown && activeWorkspaceId) {
          await createDocument({
            title: result.title ?? `Model translations ${result.locale}`,
            kind: 'model-translations',
            language: locale,
            markdown: result.markdown,
            sourceHash: medolSourceHash
          });
          onPreviewModeChange('documents');
          onDocumentFocusSourceIdChange(undefined);
          onDocumentNavigationToneChange('info');
        }
        setModelTranslationMessage(
          result.warning
            ? result.warning
            : `Translations ${result.locale}: ${result.translated}/${result.total} stored`
        );
      } else if (toolbarAction === 'download-translations') {
        const locale = modelTranslationLocale(documentationLanguage);
        const result = await resolveModelTranslations({
          dsl,
          locale,
          workspaceId: activeWorkspaceId
        });
        if (result.translated === 0) {
          setModelTranslationMessage(`Translations ${result.locale}: no stored translations, run Translate model first`);
          return;
        }
        downloadJson(`model-translations.${result.locale}.json`, JSON.stringify(result.codegen, null, 2));
        setModelTranslationMessage(`Translations ${result.locale}: ${result.translated} downloaded`);
      } else if (toolbarAction === 'reset') {
        onResetModel();
      }
    } catch (error) {
      console.error(error);
      if (isModelTranslationAction(toolbarAction)) {
        setModelTranslationMessage(error instanceof Error ? error.message : 'Model translation failed');
      }
    } finally {
      setToolbarActionPending(false);
      setToolbarAction('');
    }
  };

  return {
    toolbarAction,
    setToolbarAction,
    toolbarActionPending,
    documentationLanguage,
    setDocumentationLanguage,
    modelTranslationMessage,
    runToolbarAction
  };
};

const isModelTranslationAction = (action: ToolbarAction): boolean => {
  return action === 'model-translations' || action === 'download-translations';
};

const modelTranslationLocale = (language: DocumentationLanguage): DocumentationLanguage =>
  language === 'en' ? 'zh-CN' : language;

const resolveCodegenModelJson = async (input: {
  fallbackJson: string;
  locale: DocumentationLanguage;
  workspaceId?: string;
}): Promise<string> => {
  if (!input.workspaceId || input.locale === 'en') {
    return input.fallbackJson;
  }
  return readCodegenModelJson({
    workspaceId: input.workspaceId,
    locale: input.locale
  });
};

const getCodegenModelFilename = (locale: DocumentationLanguage): string => {
  return locale === 'en' ? 'codegen-model.json' : `codegen-model.${locale}.json`;
};

const downloadJson = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const getImageExportOptions = (nodes: Node[], filename: string) => {
  const bounds = getFlowBounds(nodes);
  const padding = 180;
  const imageWidth = Math.max(1280, Math.ceil(bounds.width + padding * 2));
  const imageHeight = Math.max(720, Math.ceil(bounds.height + padding * 2));
  const paddedBounds = {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2
  };
  const viewport = getViewportForBounds(paddedBounds, imageWidth, imageHeight, 0.1, 1.5, 1);

  return {
    filename,
    width: imageWidth,
    height: imageHeight,
    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    backgroundColor: '#f4f7fb'
  };
};
