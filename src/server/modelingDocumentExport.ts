import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

const execFileAsync = promisify(execFile);
const maxExportMarkdownLength = 4_000_000;

export interface ExportWordInput {
  title: string;
  markdown: string;
}

export class DocumentExportError extends Error {
  constructor(
    message: string,
    readonly status = 500
  ) {
    super(message);
    this.name = 'DocumentExportError';
  }
}

export const validateExportWordInput = (
  body: Record<string, unknown>
): { value?: ExportWordInput; error?: string } => {
  const title = typeof body.title === 'string' && body.title.trim()
    ? body.title.trim()
    : undefined;
  if (!title) return { error: 'title is required' };
  if (title.length > 240) return { error: 'title is too long' };
  if (typeof body.markdown !== 'string') return { error: 'markdown must be a string' };
  if (body.markdown.length > maxExportMarkdownLength) return { error: 'markdown is too large' };
  return {
    value: {
      title,
      markdown: body.markdown
    }
  };
};

export const exportMarkdownToWord = async (
  input: ExportWordInput
): Promise<{ filename: string; content: Buffer }> => {
  const directory = await mkdtemp(path.join(tmpdir(), 'medol-docx-'));
  const inputPath = path.join(directory, `${randomUUID()}.md`);
  const outputPath = path.join(directory, `${randomUUID()}.docx`);
  try {
    await writeFile(inputPath, input.markdown, 'utf8');
    await execFileAsync('pandoc', [
      inputPath,
      '--from',
      'gfm',
      '--to',
      'docx',
      '--output',
      outputPath
    ]);
    const content = await readFile(outputPath);
    return {
      filename: `${safeFilename(input.title)}.docx`,
      content
    };
  } catch (error) {
    if (isPandocMissing(error)) {
      throw new DocumentExportError(
        'Pandoc is not installed on the server. Install pandoc to enable Word export.',
        503
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new DocumentExportError(`Word export failed: ${message}`, 500);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

export const wordMimeType =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const safeFilename = (value: string): string =>
  value
    .trim()
    .replace(/[^\w\u4e00-\u9fff-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  || 'document';

const isPandocMissing = (error: unknown): boolean =>
  typeof error === 'object'
  && error !== null
  && 'code' in error
  && (error as { code?: unknown }).code === 'ENOENT';
