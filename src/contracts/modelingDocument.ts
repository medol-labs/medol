import type {
  DocumentationKind,
  DocumentationLanguage
} from '../lib/generators/documentation';

export interface ModelingDocumentSummary {
  id: string;
  workspaceId: string;
  title: string;
  kind: DocumentationKind;
  language: DocumentationLanguage;
  sourceRefs: string[];
  sourceHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ModelingDocument extends ModelingDocumentSummary {
  markdown: string;
  mergeSummary?: ModelingDocumentMergeSummary;
}

export interface ModelingDocumentMergeSummary {
  created: boolean;
  added: number;
  updated: number;
  preserved: number;
  removed: number;
}

export interface CreateModelingDocumentInput {
  workspaceId: string;
  title: string;
  kind: DocumentationKind;
  language: DocumentationLanguage;
  markdown: string;
  sourceHash?: string;
}

export interface UpdateModelingDocumentInput {
  title?: string;
  markdown?: string;
}

export interface ModelingDocumentClient {
  list(workspaceId: string, signal?: AbortSignal): Promise<ModelingDocumentSummary[]>;
  get(documentId: string, signal?: AbortSignal): Promise<ModelingDocument>;
  create(input: CreateModelingDocumentInput, signal?: AbortSignal): Promise<ModelingDocument>;
  update(
    documentId: string,
    input: UpdateModelingDocumentInput,
    signal?: AbortSignal
  ): Promise<ModelingDocument>;
  remove(documentId: string, signal?: AbortSignal): Promise<void>;
}
