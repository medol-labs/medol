import type {
  CreateModelingDocumentInput,
  ModelingDocument,
  ModelingDocumentClient,
  ModelingDocumentSummary,
  UpdateModelingDocumentInput
} from '../../contracts/modelingDocument';

export const createHttpModelingDocumentClient = (
  baseUrl: string
): ModelingDocumentClient => {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  return {
    list: async (workspaceId, signal) => {
      const body = await request<{ documents: ModelingDocumentSummary[] }>(
        `${normalizedBaseUrl}/document-records?workspaceId=${encodeURIComponent(workspaceId)}`,
        { signal }
      );
      return body.documents;
    },
    get: async (documentId, signal) => {
      const body = await request<{ document: ModelingDocument }>(
        documentUrl(normalizedBaseUrl, documentId),
        { signal }
      );
      return body.document;
    },
    create: async (input: CreateModelingDocumentInput, signal) => {
      const body = await request<{ document: ModelingDocument }>(
        `${normalizedBaseUrl}/document-records`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
          signal
        }
      );
      return body.document;
    },
    update: async (documentId, input: UpdateModelingDocumentInput, signal) => {
      const body = await request<{ document: ModelingDocument }>(
        documentUrl(normalizedBaseUrl, documentId),
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
          signal
        }
      );
      return body.document;
    },
    remove: async (documentId, signal) => {
      await request<void>(documentUrl(normalizedBaseUrl, documentId), {
        method: 'DELETE',
        signal
      });
    }
  };
};

const configuredBaseUrl = import.meta.env.VITE_DOCUMENT_API_BASE_URL?.trim();

export const modelingDocumentClient = createHttpModelingDocumentClient(
  configuredBaseUrl || '/api/modeling'
);

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => undefined) as { error?: string } | undefined;
    throw new Error(body?.error ?? `Document request failed with HTTP ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
};

const documentUrl = (baseUrl: string, documentId: string): string =>
  `${baseUrl}/document-records/${encodeURIComponent(documentId)}`;
