import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ModelingDocument,
  ModelingDocumentSummary
} from '../../contracts/modelingDocument';
import { modelingDocumentClient } from './modelingDocumentClient';

export type DocumentPersistenceStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

export const useModelingDocuments = (workspaceId: string | undefined) => {
  const [documents, setDocuments] = useState<ModelingDocumentSummary[]>([]);
  const [activeDocument, setActiveDocument] = useState<ModelingDocument>();
  const [status, setStatus] = useState<DocumentPersistenceStatus>('idle');
  const [error, setError] = useState<string>();
  const loadController = useRef<AbortController | undefined>(undefined);

  const mergeDocument = useCallback((document: ModelingDocument) => {
    setDocuments((current) => [
      toSummary(document),
      ...current.filter((candidate) => candidate.id !== document.id)
    ]);
    setActiveDocument(document);
  }, []);

  const loadDocument = useCallback(async (documentId: string) => {
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setStatus('loading');
    setError(undefined);
    try {
      const document = await modelingDocumentClient.get(documentId, controller.signal);
      if (controller.signal.aborted) return;
      mergeDocument(document);
      setStatus('saved');
    } catch (loadError) {
      if (controller.signal.aborted) return;
      setError(messageOf(loadError));
      setStatus('error');
    }
  }, [mergeDocument]);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setDocuments([]);
      setActiveDocument(undefined);
      setStatus('idle');
      return;
    }
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setStatus('loading');
    setError(undefined);
    try {
      const listed = await modelingDocumentClient.list(workspaceId, controller.signal);
      if (controller.signal.aborted) return;
      setDocuments(listed);
      if (activeDocument && listed.some((document) => document.id === activeDocument.id)) {
        setStatus('saved');
      } else if (listed[0]) {
        await loadDocument(listed[0].id);
      } else {
        setActiveDocument(undefined);
        setStatus('idle');
      }
    } catch (loadError) {
      if (controller.signal.aborted) return;
      setError(messageOf(loadError));
      setStatus('error');
    }
  }, [activeDocument, loadDocument, workspaceId]);

  useEffect(() => {
    setActiveDocument(undefined);
    void refresh();
    return () => loadController.current?.abort();
    // activeDocument is intentionally reset when the workspace changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const createDocument = useCallback(async (
    input: Omit<Parameters<typeof modelingDocumentClient.create>[0], 'workspaceId'>
  ) => {
    if (!workspaceId) throw new Error('No active workspace');
    setStatus('saving');
    setError(undefined);
    try {
      const document = await modelingDocumentClient.create({ ...input, workspaceId });
      mergeDocument(document);
      setStatus('saved');
      return document;
    } catch (createError) {
      setError(messageOf(createError));
      setStatus('error');
      throw createError;
    }
  }, [mergeDocument, workspaceId]);

  const saveDocument = useCallback(async (title: string, markdown: string) => {
    if (!activeDocument) return undefined;
    setStatus('saving');
    setError(undefined);
    try {
      const document = await modelingDocumentClient.update(activeDocument.id, { title, markdown });
      mergeDocument(document);
      setStatus('saved');
      return document;
    } catch (saveError) {
      setError(messageOf(saveError));
      setStatus('error');
      throw saveError;
    }
  }, [activeDocument, mergeDocument]);

  const deleteDocument = useCallback(async () => {
    if (!activeDocument) return;
    const deletedId = activeDocument.id;
    setStatus('saving');
    setError(undefined);
    try {
      await modelingDocumentClient.remove(deletedId);
      const remaining = documents.filter((document) => document.id !== deletedId);
      setDocuments(remaining);
      setActiveDocument(undefined);
      if (remaining[0]) await loadDocument(remaining[0].id);
      else setStatus('idle');
    } catch (deleteError) {
      setError(messageOf(deleteError));
      setStatus('error');
      throw deleteError;
    }
  }, [activeDocument, documents, loadDocument]);

  return {
    documents,
    activeDocument,
    status,
    error,
    loadDocument,
    createDocument,
    saveDocument,
    deleteDocument,
    refresh
  };
};

const toSummary = (document: ModelingDocument): ModelingDocumentSummary => ({
  id: document.id,
  workspaceId: document.workspaceId,
  title: document.title,
  kind: document.kind,
  language: document.language,
  sourceRefs: document.sourceRefs,
  ...(document.sourceHash ? { sourceHash: document.sourceHash } : {}),
  createdAt: document.createdAt,
  updatedAt: document.updatedAt
});

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : 'Document operation failed';
