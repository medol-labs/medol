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

export type WordExportProfileId = 'default' | 'zh-formal';

export const exportModelingDocumentWord = async (
  input: { title: string; markdown: string; profileId?: WordExportProfileId },
  signal?: AbortSignal
): Promise<{ blob: Blob; filename: string }> => {
  const response = await fetch('/api/modeling/document-export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal
  });
  if (!response.ok) {
    const body = await response.json().catch(() => undefined) as { error?: string } | undefined;
    throw new Error(body?.error ?? `Word export failed with HTTP ${response.status}`);
  }
  return {
    blob: await response.blob(),
    filename: filenameFromDisposition(response.headers.get('Content-Disposition'))
      ?? `${safeFilename(input.title)}.docx`
  };
};

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

const filenameFromDisposition = (value: string | null): string | undefined => {
  if (!value) return undefined;
  const encoded = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) return decodeURIComponent(encoded);
  return value.match(/filename="([^"]+)"/i)?.[1];
};

const safeFilename = (value: string): string =>
  value
    .trim()
    .replace(/[^\w\u4e00-\u9fff-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  || 'document';
