import type {
  CreateModelingDocumentInput,
  UpdateModelingDocumentInput
} from '../contracts/modelingDocument';
import type {
  DocumentationKind,
  DocumentationLanguage
} from '../lib/generators/documentation';

const kinds = new Set<DocumentationKind>([
  'prd',
  'software-design',
  'database-design',
  'process'
]);
const languages = new Set<DocumentationLanguage>(['en', 'zh-CN']);
const maxTitleLength = 240;
const maxMarkdownLength = 4_000_000;

export const validateCreateDocumentInput = (
  body: Record<string, unknown>
): { value?: CreateModelingDocumentInput; error?: string } => {
  const workspaceId = text(body.workspaceId);
  const title = text(body.title);
  const markdown = typeof body.markdown === 'string' ? body.markdown : undefined;
  if (!workspaceId) return { error: 'workspaceId is required' };
  if (!title) return { error: 'title is required' };
  if (title.length > maxTitleLength) return { error: 'title is too long' };
  if (!isKind(body.kind)) return { error: 'unsupported document kind' };
  if (!isLanguage(body.language)) return { error: 'unsupported document language' };
  if (markdown === undefined) return { error: 'markdown must be a string' };
  if (markdown.length > maxMarkdownLength) return { error: 'markdown is too large' };
  const sourceHash = body.sourceHash === undefined ? undefined : text(body.sourceHash);
  if (body.sourceHash !== undefined && !sourceHash) {
    return { error: 'sourceHash must be a non-empty string' };
  }
  return {
    value: {
      workspaceId,
      title,
      kind: body.kind,
      language: body.language,
      markdown,
      ...(sourceHash ? { sourceHash } : {})
    }
  };
};

export const validateUpdateDocumentInput = (
  body: Record<string, unknown>
): { value?: UpdateModelingDocumentInput; error?: string } => {
  const value: UpdateModelingDocumentInput = {};
  if (body.title !== undefined) {
    const title = text(body.title);
    if (!title) return { error: 'title must not be empty' };
    if (title.length > maxTitleLength) return { error: 'title is too long' };
    value.title = title;
  }
  if (body.markdown !== undefined) {
    if (typeof body.markdown !== 'string') return { error: 'markdown must be a string' };
    if (body.markdown.length > maxMarkdownLength) return { error: 'markdown is too large' };
    value.markdown = body.markdown;
  }
  if (value.title === undefined && value.markdown === undefined) {
    return { error: 'title or markdown is required' };
  }
  return { value };
};

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const isKind = (value: unknown): value is DocumentationKind =>
  typeof value === 'string' && kinds.has(value as DocumentationKind);

const isLanguage = (value: unknown): value is DocumentationLanguage =>
  typeof value === 'string' && languages.has(value as DocumentationLanguage);
