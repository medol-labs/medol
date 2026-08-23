import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  defaultChangeLogRow,
  type DocumentChangeLogRow
} from '../lib/generators/documentation/documentFrontMatter';
import { markdownHeadingAnchor } from '../lib/generators/documentation/documentTableOfContents';
import { renderSimpleMermaidSvg } from '../lib/generators/documentation/simpleMermaidRenderer';

const execFileAsync = promisify(execFile);
const maxExportMarkdownLength = 4_000_000;

export type WordExportProfileId = 'default' | 'zh-formal';

interface WordExportProfile {
  id: WordExportProfileId;
  referenceDoc?: string;
  cleanMedolMarkers: boolean;
  renderMermaid: boolean;
  cover: boolean;
  changeLog: boolean;
  toc: boolean;
  restartBodyPageNumbering: boolean;
  numberSections: boolean;
  tocDepth: number;
}

export interface ExportWordInput {
  title: string;
  markdown: string;
  profileId?: WordExportProfileId;
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
  const profileId = body.profileId === undefined
    ? 'default'
    : typeof body.profileId === 'string'
      ? body.profileId
      : undefined;
  if (!isWordExportProfileId(profileId)) {
    return { error: 'unsupported Word export profile' };
  }
  return {
    value: {
      title,
      markdown: body.markdown,
      profileId
    }
  };
};

export const exportMarkdownToWord = async (
  input: ExportWordInput
): Promise<{ filename: string; content: Buffer }> => {
  const directory = await mkdtemp(path.join(tmpdir(), 'medol-docx-'));
  const inputPath = path.join(directory, `${randomUUID()}.md`);
  const outputPath = path.join(directory, `${randomUUID()}.docx`);
  const profile = wordExportProfiles[input.profileId ?? 'default'];
  try {
    if (profile.referenceDoc) {
      await assertFileReadable(profile.referenceDoc, `Word reference document ${profile.referenceDoc} is not readable.`);
    }
    const markdownChangeLog = profile.changeLog
      ? extractMarkdownChangeLog(input.markdown)
      : undefined;
    const preparedMarkdown = await prepareMarkdownForWordExport(input.markdown, {
      workingDirectory: directory,
      profile,
      markdownChangeLog
    });
    await writeFile(inputPath, preparedMarkdown, 'utf8');

    const pandocArgs = [
      inputPath,
      '--from',
      'markdown+raw_attribute',
      '--to',
      'docx',
      '--output',
      outputPath
    ];
    if (profile.referenceDoc) {
      pandocArgs.push('--reference-doc', profile.referenceDoc);
    }
    if (profile.numberSections) {
      pandocArgs.push('--number-sections');
    }
    await execFileAsync('pandoc', pandocArgs);

    if (profile.id === 'default') {
      await finalizeWordDocument(outputPath, directory);
    }
    if (profile.cover || profile.changeLog || profile.toc || profile.restartBodyPageNumbering) {
      await postProcessDocx(outputPath, {
        title: input.title,
        profile,
        changeLogRows: markdownChangeLog?.rows
      });
    }

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

export const wordExportProfiles: Record<WordExportProfileId, WordExportProfile> = {
  default: {
    id: 'default',
    cleanMedolMarkers: true,
    renderMermaid: false,
    cover: false,
    changeLog: false,
    toc: false,
    restartBodyPageNumbering: false,
    numberSections: false,
    tocDepth: 3
  },
  'zh-formal': {
    id: 'zh-formal',
    referenceDoc: path.resolve(process.cwd(), 'templates', 'docx', 'zh-formal.reference.docx'),
    cleanMedolMarkers: true,
    renderMermaid: true,
    cover: true,
    changeLog: true,
    toc: true,
    restartBodyPageNumbering: true,
    numberSections: false,
    tocDepth: 3
  }
};

export const prepareMarkdownForWord = (markdown: string): string =>
  renderWordTocField(addHeadingAnchorsForWord(markdown)).replace(pageBreakPattern, [
    '',
    '```{=openxml}',
    '<w:p><w:r><w:br w:type="page"/></w:r></w:p>',
    '```',
    ''
  ].join('\n'));

export const removeMedolSectionMarkers = (markdown: string): string =>
  markdown
    .split(/\r?\n/)
    .filter((line) => !/^\s*<!--\s*em:section\b[^>]*-->\s*$/.test(line))
    .join('\n');

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

const prepareMarkdownForWordExport = async (
  markdown: string,
  input: {
    workingDirectory: string;
    profile: WordExportProfile;
    markdownChangeLog?: MarkdownChangeLog;
  }
): Promise<string> => {
  const sourceMarkdown = input.markdownChangeLog
    ? input.markdownChangeLog.markdownWithoutSection
    : markdown;
  const cleaned = input.profile.cleanMedolMarkers
    ? removeMedolSectionMarkers(sourceMarkdown)
    : sourceMarkdown;
  const prepared = input.profile.id === 'default'
    ? prepareMarkdownForWord(cleaned)
    : cleaned;
  return input.profile.renderMermaid
    ? renderMermaidBlocks(prepared, input.workingDirectory)
    : prepared;
};

const renderMermaidBlocks = async (
  markdown: string,
  workingDirectory: string
): Promise<string> => {
  const mermaidCli = await findMermaidCli();

  const pattern = /(^|\n)(```|~~~)[ \t]*mermaid[^\n]*\n([\s\S]*?)\n\2[ \t]*(?=\n|$)/g;
  const parts: string[] = [];
  let cursor = 0;
  let index = 0;
  for (const match of markdown.matchAll(pattern)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    parts.push(markdown.slice(cursor, start));
    const leadingBreak = match[1] ?? '';
    const source = match[3] ?? '';
    index += 1;
    const inputPath = path.join(workingDirectory, `mermaid-${index}.mmd`);
    const outputPath = path.join(workingDirectory, `mermaid-${index}.png`);
    try {
      if (mermaidCli) {
        await writeFile(inputPath, source, 'utf8');
        await execFileAsync(mermaidCli, [
          '-i',
          inputPath,
          '-o',
          outputPath,
          '-b',
          'transparent'
        ]);
        parts.push(`${leadingBreak}![Mermaid diagram ${index}](${outputPath})`);
      } else {
        const simpleSvg = renderSimpleMermaidSvg(source);
        if (!simpleSvg) {
          parts.push(match[0]);
        } else {
          const svgPath = path.join(workingDirectory, `mermaid-${index}.svg`);
          await writeFile(svgPath, simpleSvg, 'utf8');
          parts.push(`${leadingBreak}![Mermaid diagram ${index}](${svgPath})`);
        }
      }
    } catch (error) {
      console.warn('[document-export] Mermaid rendering failed; keeping source block.', error);
      parts.push(match[0]);
    }
    cursor = end;
  }
  parts.push(markdown.slice(cursor));
  return parts.join('');
};

const findMermaidCli = async (): Promise<string | undefined> => {
  const configured = process.env.MERMAID_CLI_PATH?.trim();
  if (configured) {
    try {
      await access(configured);
      return configured;
    } catch {
      return undefined;
    }
  }
  try {
    const { stdout } = await execFileAsync('which', ['mmdc']);
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
};

interface MarkdownChangeLog {
  rows: DocumentChangeLogRow[];
  markdownWithoutSection: string;
}

const extractMarkdownChangeLog = (markdown: string): MarkdownChangeLog | undefined => {
  const lines = markdown.split(/\r?\n/);
  const markerIndex = lines.findIndex(isDocumentChangeLogMarker);
  const headingIndex = markerIndex >= 0
    ? findChangeLogHeading(lines, markerIndex + 1)
    : lines.findIndex(isChangeLogHeading);
  if (headingIndex < 0) return undefined;

  const startIndex = markerIndex >= 0 ? markerIndex : headingIndex;
  const endIndex = findChangeLogEnd(lines, headingIndex + 1);
  const sectionLines = lines.slice(startIndex, endIndex);
  const rows = parseChangeLogTableRows(sectionLines);
  const markdownWithoutSection = [
    ...lines.slice(0, startIndex),
    ...lines.slice(endIndex)
  ].join('\n').replace(/\n{3,}/g, '\n\n').trimStart();

  return { rows, markdownWithoutSection };
};

const findChangeLogHeading = (lines: string[], startIndex: number): number => {
  for (let index = startIndex; index < lines.length; index += 1) {
    if (isChangeLogHeading(lines[index])) return index;
    if (index > startIndex && isSectionBoundary(lines[index])) return -1;
  }
  return -1;
};

const findChangeLogEnd = (lines: string[], startIndex: number): number => {
  for (let index = startIndex; index < lines.length; index += 1) {
    if (isSectionBoundary(lines[index])) return index;
  }
  return lines.length;
};

const isSectionBoundary = (line: string): boolean =>
  /^\s*<!--\s*em:section\b[^>]*-->\s*$/.test(line)
  || /^\s*#{1,2}\s+\S/.test(line);

const isDocumentChangeLogMarker = (line: string): boolean =>
  /^\s*<!--\s*em:section\b(?=[^>]*\bid=["']document\.changeLog["'])[^>]*-->\s*$/.test(line);

const isChangeLogHeading = (line: string): boolean =>
  /^\s*##\s+(?:变更记录|Change Log)\s*$/.test(line);

const parseChangeLogTableRows = (lines: string[]): DocumentChangeLogRow[] => {
  const tableLines = lines
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && line.endsWith('|'));
  const separatorIndex = tableLines.findIndex(isMarkdownTableSeparator);
  if (separatorIndex < 0) return [];
  return tableLines
    .slice(separatorIndex + 1)
    .map(splitMarkdownTableRow)
    .filter((columns) => columns.length >= 4)
    .map((columns) => ({
      version: columns[0],
      date: columns[1],
      description: columns[2],
      author: columns[3]
    }))
    .filter((row) => row.version || row.date || row.description || row.author);
};

const isMarkdownTableSeparator = (line: string): boolean => {
  const columns = splitMarkdownTableRow(line);
  return columns.length >= 4
    && columns.every((column) => /^:?-{3,}:?$/.test(column.replace(/\s/g, '')));
};

const splitMarkdownTableRow = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((column) => column.trim().replace(/\\\|/g, '|'));

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

const postProcessDocx = async (
  docxPath: string,
  input: {
    title: string;
    profile: WordExportProfile;
    changeLogRows?: DocumentChangeLogRow[];
  }
): Promise<void> => {
  const unpackDirectory = await mkdtemp(path.join(tmpdir(), 'medol-docx-unpack-'));
  const processedPath = path.join(tmpdir(), `${randomUUID()}.docx`);
  try {
    await execFileAsync('unzip', ['-q', docxPath, '-d', unpackDirectory]);
    const wordDirectory = path.join(unpackDirectory, 'word');
    await patchDocumentXml(path.join(wordDirectory, 'document.xml'), input);
    await patchFooterXmlFiles(wordDirectory, input.profile);
    await patchSettingsXml(path.join(wordDirectory, 'settings.xml'));
    await execFileAsync('zip', ['-qr', processedPath, '.'], { cwd: unpackDirectory });
    const processed = await readFile(processedPath);
    await writeFile(docxPath, processed);
  } catch (error) {
    if (isMissingZipTool(error)) {
      throw new DocumentExportError(
        'DOCX post-processing requires zip and unzip on the server PATH.',
        503
      );
    }
    throw error;
  } finally {
    await rm(unpackDirectory, { recursive: true, force: true });
    await rm(processedPath, { force: true });
  }
};

const patchDocumentXml = async (
  documentXmlPath: string,
  input: {
    title: string;
    profile: WordExportProfile;
    changeLogRows?: DocumentChangeLogRow[];
  }
): Promise<void> => {
  let xml = await readFile(documentXmlPath, 'utf8');
  if (input.profile.cleanMedolMarkers) {
    xml = xml.replace(/<w:p\b[\s\S]*?(?:em:section|&lt;!--\s*em:section)[\s\S]*?<\/w:p>/g, '');
  }
  const exportDate = currentIsoDate();
  const frontMatter = [
    input.profile.cover ? buildCoverXml(input.title, exportDate) : '',
    input.profile.changeLog ? buildChangeLogXml(exportDate, input.changeLogRows) : '',
    input.profile.toc ? buildTocXml(input.profile.tocDepth) : '',
    input.profile.restartBodyPageNumbering ? bodySectionBreakXml() : ''
  ].join('');
  if (frontMatter) {
    xml = xml.replace(/<w:body([^>]*)>/, `<w:body$1>${frontMatter}`);
  }
  if (input.profile.restartBodyPageNumbering) {
    xml = restartFinalSectionPageNumbering(xml);
  }
  await writeFile(documentXmlPath, xml, 'utf8');
};

const patchFooterXmlFiles = async (
  wordDirectory: string,
  profile: WordExportProfile
): Promise<void> => {
  if (!profile.restartBodyPageNumbering) return;
  const names = await readdir(wordDirectory);
  await Promise.all(
    names
      .filter((name) => /^footer\d+\.xml$/.test(name))
      .map(async (name) => {
        const footerPath = path.join(wordDirectory, name);
        const xml = await readFile(footerPath, 'utf8');
        const patched = xml.replace(
          /(<w:instrText\b[^>]*>\s*)NUMPAGES(\s*<\/w:instrText>)/g,
          '$1SECTIONPAGES$2'
        );
        if (patched !== xml) await writeFile(footerPath, patched, 'utf8');
      })
  );
};

const patchSettingsXml = async (settingsXmlPath: string): Promise<void> => {
  let xml: string;
  try {
    xml = await readFile(settingsXmlPath, 'utf8');
  } catch {
    return;
  }
  if (xml.includes('<w:updateFields')) return;
  await writeFile(
    settingsXmlPath,
    xml.replace('</w:settings>', '<w:updateFields w:val="true"/></w:settings>'),
    'utf8'
  );
};

const buildCoverXml = (title: string, exportDate: string): string => [
  paragraphXml('', { before: 1800, after: 0 }),
  paragraphXml(title, {
    align: 'center',
    before: 720,
    after: 240,
    fontSize: 32,
    eastAsiaFont: 'Heiti SC',
    asciiFont: 'Arial',
    bold: true
  }),
  paragraphXml('MEDOL 正式设计文档', {
    align: 'center',
    before: 0,
    after: 720,
    fontSize: 15,
    eastAsiaFont: 'PingFang SC',
    asciiFont: 'Arial',
    color: '666666'
  }),
  paragraphXml(`导出日期：${exportDate}`, {
    align: 'center',
    before: 0,
    after: 1440,
    fontSize: 11,
    eastAsiaFont: 'Songti SC',
    asciiFont: 'Times New Roman',
    color: '666666'
  }),
  pageBreakXml()
].join('');

const buildChangeLogXml = (
  exportDate: string,
  rows: DocumentChangeLogRow[] | undefined
): string => {
  const changeRows = rows?.length
    ? rows
    : [defaultChangeLogRow(exportDate, 'zh-CN')];
  return [
    paragraphXml('变更记录', {
      align: 'left',
      before: 0,
      after: 240,
      fontSize: 18,
      eastAsiaFont: 'Heiti SC',
      asciiFont: 'Arial',
      bold: true
    }),
    tableXml(
      ['版本', '日期', '变更说明', '作者'],
      changeRows.map((row) => [row.version, row.date, row.description, row.author])
    ),
    pageBreakXml()
  ].join('');
};

const buildTocXml = (tocDepth: number): string => [
  `<w:p><w:pPr><w:spacing w:before="0" w:after="240"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-${tocDepth}" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Heiti SC"/><w:sz w:val="36"/><w:szCs w:val="36"/><w:b/><w:bCs/></w:rPr><w:t>目录</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`
].join('');

const tableXml = (headers: string[], rows: string[][]): string => {
  const widths = [1200, 1800, 4200, 1500];
  return [
    '<w:tbl>',
    '<w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="B8C0CC"/><w:left w:val="single" w:sz="4" w:color="B8C0CC"/><w:bottom w:val="single" w:sz="4" w:color="B8C0CC"/><w:right w:val="single" w:sz="4" w:color="B8C0CC"/><w:insideH w:val="single" w:sz="4" w:color="D3D8E0"/><w:insideV w:val="single" w:sz="4" w:color="D3D8E0"/></w:tblBorders><w:tblCellMar><w:top w:w="120" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar></w:tblPr>',
    `<w:tblGrid>${widths.map((width) => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>`,
    tableRowXml(headers, widths, true),
    ...rows.map((row) => tableRowXml(row, widths, false)),
    '</w:tbl>'
  ].join('');
};

const tableRowXml = (cells: string[], widths: number[], header: boolean): string =>
  `<w:tr>${cells.map((cell, index) => tableCellXml(cell, widths[index] ?? widths[0], header)).join('')}</w:tr>`;

const tableCellXml = (text: string, width: number, header: boolean): string => [
  '<w:tc>',
  `<w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${header ? '<w:shd w:fill="F1F5F9"/>' : ''}</w:tcPr>`,
  `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Songti SC"/><w:sz w:val="21"/><w:szCs w:val="21"/>${header ? '<w:b/><w:bCs/>' : ''}</w:rPr><w:t>${escapeXml(text)}</w:t></w:r></w:p>`,
  '</w:tc>'
].join('');

const paragraphXml = (
  text: string,
  options: {
    align?: 'left' | 'center' | 'right';
    before?: number;
    after?: number;
    fontSize?: number;
    eastAsiaFont?: string;
    asciiFont?: string;
    color?: string;
    bold?: boolean;
  } = {}
): string => {
  const paragraphProperties = [
    options.align ? `<w:jc w:val="${options.align}"/>` : '',
    options.before !== undefined || options.after !== undefined
      ? `<w:spacing${options.before !== undefined ? ` w:before="${options.before}"` : ''}${options.after !== undefined ? ` w:after="${options.after}"` : ''}/>`
      : ''
  ].join('');
  const runProperties = [
    options.eastAsiaFont || options.asciiFont
      ? `<w:rFonts${options.asciiFont ? ` w:ascii="${escapeXml(options.asciiFont)}" w:hAnsi="${escapeXml(options.asciiFont)}"` : ''}${options.eastAsiaFont ? ` w:eastAsia="${escapeXml(options.eastAsiaFont)}"` : ''}/>`
      : '',
    options.fontSize ? `<w:sz w:val="${options.fontSize * 2}"/><w:szCs w:val="${options.fontSize * 2}"/>` : '',
    options.color ? `<w:color w:val="${options.color}"/>` : '',
    options.bold ? '<w:b/><w:bCs/>' : ''
  ].join('');
  return `<w:p><w:pPr>${paragraphProperties}</w:pPr><w:r><w:rPr>${runProperties}</w:rPr><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
};

const pageBreakXml = (): string =>
  '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

const bodySectionBreakXml = (): string =>
  '<w:p><w:pPr><w:sectPr><w:type w:val="nextPage"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1587" w:bottom="1440" w:left="1587" w:header="709" w:footer="709" w:gutter="0"/><w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr></w:pPr></w:p>';

const restartFinalSectionPageNumbering = (xml: string): string => {
  const start = xml.lastIndexOf('<w:sectPr');
  if (start < 0) return xml;
  const end = xml.indexOf('</w:sectPr>', start);
  if (end < 0) return xml;
  const closeTag = '</w:sectPr>';
  const section = xml.slice(start, end + closeTag.length);
  const patchedSection = section.includes('<w:pgNumType')
    ? section.replace(/<w:pgNumType\b[^>]*(?:\/>|>[\s\S]*?<\/w:pgNumType>)/, '<w:pgNumType w:start="1"/>')
    : section.replace(closeTag, '<w:pgNumType w:start="1"/></w:sectPr>');
  return `${xml.slice(0, start)}${patchedSection}${xml.slice(end + closeTag.length)}`;
};

const currentIsoDate = (): string =>
  new Date().toISOString().slice(0, 10);

const assertFileReadable = async (filePath: string, message: string): Promise<void> => {
  try {
    await access(filePath);
  } catch {
    throw new DocumentExportError(message, 500);
  }
};

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

const isMissingZipTool = isPandocMissing;

const isWordExportProfileId = (value: unknown): value is WordExportProfileId =>
  value === 'default' || value === 'zh-formal';

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
