import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { markdownHeadingAnchor } from '../lib/generators/documentation/documentTableOfContents';

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
    await writeFile(inputPath, prepareMarkdownForWord(input.markdown), 'utf8');
    await execFileAsync('pandoc', [
      inputPath,
      '--from',
      'markdown+raw_attribute',
      '--to',
      'docx',
      '--output',
      outputPath
    ]);
    await finalizeWordDocument(outputPath, directory);
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

export const prepareMarkdownForWord = (markdown: string): string =>
  renderWordTocField(addHeadingAnchorsForWord(markdown)).replace(pageBreakPattern, [
      '',
      '```{=openxml}',
      '<w:p><w:r><w:br w:type="page"/></w:r></w:p>',
      '```',
      ''
    ].join('\n'));

const pageBreakPattern =
  /(?:<!--\s*medol:pagebreak\s*-->|<div\s+style="page-break-before:\s*always;">\s*<\/div>)/giu;
const tocSectionPattern =
  /(?:<!--\s*em:section\s+id="document\.toc"\s*-->\s*)?(##\s+(?:目录|Table of Contents)\s*)\n+(?:\s*- \[[^\]]+\]\(#[^)]+\)\s*\n*)+/giu;

const renderWordTocField = (markdown: string): string =>
  markdown.replace(tocSectionPattern, (_match, title: string) => [
    title,
    '',
    '```{=openxml}',
    '<w:p><w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve">TOC \\o "1-3" \\h \\z \\u</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>',
    '```',
    ''
  ].join('\n'));

const addHeadingAnchorsForWord = (markdown: string): string => {
  let inFence = false;
  const usedAnchors = new Map<string, number>();
  return markdown.split(/\r?\n/).map((line) => {
    if (/^\s*(```|~~~)/u.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;
    const heading = line.match(/^(#{1,6})\s+(.+?)(?:\s+[{]#[A-Za-z0-9_-]+[}])?\s*$/u);
    if (!heading) return line;
    const title = heading[2].trim();
    if (!/\/[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*\s*$/u.test(title)) return line;
    const anchor = uniqueAnchor(markdownHeadingAnchor(title), usedAnchors);
    return `${heading[1]} ${title} {#${anchor}}`;
  }).join('\n');
};

const uniqueAnchor = (anchor: string, usedAnchors: Map<string, number>): string => {
  const count = usedAnchors.get(anchor) ?? 0;
  usedAnchors.set(anchor, count + 1);
  return count === 0 ? anchor : `${anchor}-${count}`;
};

const finalizeWordDocument = async (docxPath: string, directory: string): Promise<void> => {
  const unpackedPath = path.join(directory, 'docx-unpacked');
  await mkdir(unpackedPath, { recursive: true });
  await execFileAsync('unzip', ['-q', docxPath, '-d', unpackedPath]);
  await addWordFooterAndUpdateFields(unpackedPath);
  await rm(docxPath, { force: true });
  await execFileAsync('zip', ['-qr', docxPath, '.'], { cwd: unpackedPath });
};

const addWordFooterAndUpdateFields = async (unpackedPath: string): Promise<void> => {
  const documentPath = path.join(unpackedPath, 'word', 'document.xml');
  const relationshipsPath = path.join(unpackedPath, 'word', '_rels', 'document.xml.rels');
  const contentTypesPath = path.join(unpackedPath, '[Content_Types].xml');
  const settingsPath = path.join(unpackedPath, 'word', 'settings.xml');
  const footerPath = path.join(unpackedPath, 'word', 'footer1.xml');
  const footerRelationshipId = 'rIdMedolFooter';

  const documentXml = await readFile(documentPath, 'utf8');
  await writeFile(documentPath, ensureFooterReference(documentXml, footerRelationshipId), 'utf8');

  const relationshipsXml = await readFile(relationshipsPath, 'utf8');
  await writeFile(relationshipsPath, ensureFooterRelationship(relationshipsXml, footerRelationshipId), 'utf8');

  const contentTypesXml = await readFile(contentTypesPath, 'utf8');
  await writeFile(contentTypesPath, ensureFooterContentType(contentTypesXml), 'utf8');

  const settingsXml = await readFile(settingsPath, 'utf8');
  await writeFile(settingsPath, ensureUpdateFields(settingsXml), 'utf8');

  await writeFile(footerPath, footerXml, 'utf8');
};

const ensureFooterReference = (documentXml: string, relationshipId: string): string => {
  if (documentXml.includes(`r:id="${relationshipId}"`)) return documentXml;
  const footerReference = `<w:footerReference w:type="default" r:id="${relationshipId}"/>`;
  if (/<w:sectPr\s*\/>/u.test(documentXml)) {
    return documentXml.replace(/<w:sectPr\s*\/>/u, `<w:sectPr>${footerReference}</w:sectPr>`);
  }
  return documentXml.replace(/<w:sectPr([^>]*)>/u, `<w:sectPr$1>${footerReference}`);
};

const ensureFooterRelationship = (relationshipsXml: string, relationshipId: string): string => {
  if (relationshipsXml.includes(`Id="${relationshipId}"`)) return relationshipsXml;
  return relationshipsXml.replace(
    '</Relationships>',
    `<Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Id="${relationshipId}" Target="footer1.xml" /></Relationships>`
  );
};

const ensureFooterContentType = (contentTypesXml: string): string => {
  if (contentTypesXml.includes('PartName="/word/footer1.xml"')) return contentTypesXml;
  return contentTypesXml.replace(
    '</Types>',
    '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml" /></Types>'
  );
};

const ensureUpdateFields = (settingsXml: string): string => {
  if (/<w:updateFields\b/u.test(settingsXml)) return settingsXml;
  return settingsXml.replace('</w:settings>', '<w:updateFields w:val="true" /></w:settings>');
};

const footerXml = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
  '<w:p><w:pPr><w:jc w:val="center"/></w:pPr>',
  '<w:r><w:t xml:space="preserve">第 </w:t></w:r>',
  '<w:r><w:fldChar w:fldCharType="begin"/></w:r>',
  '<w:r><w:instrText xml:space="preserve">PAGE</w:instrText></w:r>',
  '<w:r><w:fldChar w:fldCharType="separate"/></w:r>',
  '<w:r><w:t>1</w:t></w:r>',
  '<w:r><w:fldChar w:fldCharType="end"/></w:r>',
  '<w:r><w:t xml:space="preserve"> 页</w:t></w:r>',
  '</w:p>',
  '</w:ftr>'
].join('');

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
