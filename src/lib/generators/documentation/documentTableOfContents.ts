import type { DocumentationLanguage } from './documentationModel';

const ignoredSectionIds = new Set([
  'document.version-history',
  'document.changeLog',
  'document.toc'
]);

export const documentTableOfContentsSectionId = 'document.toc';

export const renderMarkdownTableOfContentsBlock = (
  markdown: string,
  language: DocumentationLanguage
): string => {
  const entries = collectMarkdownTableOfContentsEntries(markdown);
  if (entries.length === 0) return '';
  return [
    `<!-- em:section id="${documentTableOfContentsSectionId}" -->`,
    `## ${language === 'zh-CN' ? '目录' : 'Table of Contents'}`,
    '',
    ...entries.map((entry) =>
      `${'  '.repeat(Math.max(0, entry.level - 2))}- [${entry.title}](#${entry.anchor})`
    )
  ].join('\n');
};

export const insertMarkdownTableOfContentsAfterTitle = (
  markdown: string,
  language: DocumentationLanguage
): string => {
  const stripped = stripMarkdownTableOfContents(markdown);
  const toc = renderMarkdownTableOfContentsBlock(stripped, language);
  if (!toc) return stripped;
  const lines = stripped.split(/\r?\n/);
  const titleIndex = lines.findIndex((line) => /^#\s+.+/u.test(line));
  if (titleIndex < 0) return [toc, '', stripped].join('\n');
  return [
    ...lines.slice(0, titleIndex + 1),
    '',
    toc,
    '',
    ...lines.slice(titleIndex + 1).join('\n').replace(/^\s+/, '').split(/\r?\n/)
  ].join('\n').trim();
};

export const stripMarkdownTableOfContents = (markdown: string): string => {
  const lines = markdown.split(/\r?\n/);
  const output: string[] = [];
  let skipToc = false;
  let sawTocMarker = false;

  for (const line of lines) {
    const marker = line.match(/^\s*<!--\s*em:section\b([^>]*)-->\s*$/u);
    const markerId = marker?.[1].match(/\bid="([^"]+)"/u)?.[1];
    if (markerId === documentTableOfContentsSectionId) {
      skipToc = true;
      sawTocMarker = true;
      continue;
    }
    if (skipToc && marker) {
      skipToc = false;
    }
    if (skipToc) continue;
    output.push(line);
  }

  const stripped = output.join('\n');
  if (sawTocMarker) return stripped.replace(/\n{3,}/g, '\n\n').trim();
  return stripped
    .replace(
      /^\s*##\s+(?:目录|Table of Contents)\s*\n+(?:\s*- \[[^\]]+\]\(#[^)]+\)\s*\n*)+/gimu,
      ''
    )
    .replace(/^\s*(?:<!--\s*medol:toc\s*-->|\[TOC\])\s*\n*/gimu, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

interface TocEntry {
  level: number;
  title: string;
  anchor: string;
}

const collectMarkdownTableOfContentsEntries = (markdown: string): TocEntry[] => {
  const entries: TocEntry[] = [];
  const usedAnchors = new Map<string, number>();
  let inFence = false;
  let currentSectionId: string | undefined;

  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/u.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const marker = line.match(/^\s*<!--\s*em:section\b([^>]*)-->\s*$/u);
    if (marker) {
      currentSectionId = marker[1].match(/\bid="([^"]+)"/u)?.[1];
      continue;
    }
    if (currentSectionId && ignoredSectionIds.has(currentSectionId)) continue;

    const heading = line.match(/^(#{2,4})\s+(.+?)\s*$/u);
    if (!heading) continue;
    const title = heading[2].trim();
    const anchor = uniqueAnchor(markdownHeadingAnchor(title), usedAnchors);
    entries.push({
      level: heading[1].length,
      title,
      anchor
    });
  }

  return entries;
};

const uniqueAnchor = (anchor: string, usedAnchors: Map<string, number>): string => {
  const count = usedAnchors.get(anchor) ?? 0;
  usedAnchors.set(anchor, count + 1);
  return count === 0 ? anchor : `${anchor}-${count}`;
};

export const markdownHeadingAnchor = (title: string): string => {
  const code = extractHeadingCode(title);
  return code ? code.toLowerCase() : slugifyMarkdownHeading(title);
};

export const extractHeadingCode = (title: string): string | undefined =>
  title.match(/\/([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*)\s*$/u)?.[1];

export const slugifyMarkdownHeading = (title: string): string =>
  title
    .replace(/[`*_~[\]]/gu, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^-|-$/gu, '')
  || 'section';
