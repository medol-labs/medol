export interface DocumentMarkdownSection {
  id: string;
  sourceRefs: string[];
  markdown: string;
  marker?: string;
  markerLine?: number;
  contentStartLine?: number;
  startLine?: number;
  endLine?: number;
}

export interface IncrementalDocumentMerge {
  markdown: string;
  added: number;
  updated: number;
  preserved: number;
  removed: number;
}

const sectionMarkerPattern = /^\s*<!--\s*em:section\b([^>]*)-->\s*$/;
const attributePattern = /(\w+)="([^"]*)"/g;

export const parseDocumentMarkdownSections = (
  markdown: string
): DocumentMarkdownSection[] => {
  const lines = markdown.split(/\r?\n/);
  const sections: DocumentMarkdownSection[] = [];
  let current: DocumentMarkdownSection = {
    id: 'document.preamble',
    sourceRefs: [],
    markdown: ''
  };
  let content: string[] = [];

  const flush = () => {
    const firstContentIndex = content.findIndex((line) => line.trim().length > 0);
    const sectionMarkdown = content.join('\n').replace(/^\n+|\n+$/g, '');
    if (sectionMarkdown || current.sourceRefs.length || sections.length === 0) {
      sections.push({
        ...current,
        markdown: sectionMarkdown,
        contentStartLine: (current.markerLine ? current.markerLine + 1 : 1)
          + Math.max(0, firstContentIndex)
      });
    }
  };

  lines.forEach((line, index) => {
    const marker = line.match(sectionMarkerPattern);
    if (!marker) {
      content.push(line);
      return;
    }

    flush();
    const attributes = parseAttributes(marker[1]);
    current = {
      id: attributes.id || `document.section.${sections.length + 1}`,
      sourceRefs: parseSourceRefs(attributes),
      markdown: '',
      marker: line,
      markerLine: index + 1
    };
    content = [];
  });
  flush();

  return sections.map((section, index) => ({
    ...section,
    startLine: section.markerLine ?? 1,
    endLine: Math.max(
      section.markerLine ?? 1,
      (sections[index + 1]?.markerLine ?? lines.length + 1) - 1
    )
  }));
};

export const extractDocumentSourceRefs = (markdown: string): string[] => [
  ...new Set(
    parseDocumentMarkdownSections(markdown)
      .flatMap((section) => section.sourceRefs)
  )
];

export const findDocumentSourceLine = (
  markdown: string,
  sourceId: string
): number | undefined =>
  parseDocumentMarkdownSections(markdown)
    .find((section) => section.sourceRefs.includes(sourceId))
    ?.markerLine;

export const hashMedolSource = (source: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

export const addDocumentSectionReferences = (
  markdown: string,
  references: Array<{ sectionId: string; sourceId: string; headings: string[] }>
): string => {
  if (extractDocumentSourceRefs(markdown).length > 0) return markdown;

  const remaining = new Map(
    references.map((reference) => [
      reference.sourceId,
      {
        ...reference,
        headings: reference.headings.map(normalizeHeading).filter(Boolean)
      }
    ])
  );
  const lines = markdown.split(/\r?\n/);
  const migrated: string[] = [];

  for (const line of lines) {
    const heading = line.match(/^#{2,4}\s+(.+?)\s*$/);
    if (heading) {
      const normalized = normalizeHeading(heading[1]);
      const reference = [...remaining.values()].find((candidate) =>
        candidate.headings.some((name) =>
          normalized === name
          || normalized.endsWith(`(${name})`)
          || normalized.endsWith(`（${name}）`)
        )
      );
      if (reference) {
        migrated.push(
          `<!-- em:section id="${reference.sectionId}" source="${reference.sourceId}" -->`
        );
        remaining.delete(reference.sourceId);
      }
    }
    migrated.push(line);
  }

  return migrated.join('\n');
};

export const mergeGeneratedDocument = (
  currentMarkdown: string,
  baselineMarkdown: string | undefined,
  nextGeneratedMarkdown: string
): IncrementalDocumentMerge => {
  const current = parseDocumentMarkdownSections(currentMarkdown);
  const baseline = baselineMarkdown
    ? parseDocumentMarkdownSections(baselineMarkdown)
    : [];
  const next = parseDocumentMarkdownSections(nextGeneratedMarkdown);
  const currentById = new Map(current.map((section) => [sectionKey(section), section]));
  const baselineById = new Map(baseline.map((section) => [sectionKey(section), section]));
  const nextIds = new Set(next.map(sectionKey));
  const merged: DocumentMarkdownSection[] = [];
  let added = 0;
  let updated = 0;
  let preserved = 0;
  let removed = 0;

  for (const nextSection of next) {
    const key = sectionKey(nextSection);
    const currentSection = currentById.get(key);
    const baselineSection = baselineById.get(key);
    if (!currentSection) {
      merged.push(nextSection);
      added += 1;
      continue;
    }

    const userEdited = !baselineSection
      || normalizeMarkdown(currentSection.markdown) !== normalizeMarkdown(baselineSection.markdown);
    if (userEdited) {
      merged.push(currentSection);
      preserved += 1;
      continue;
    }

    merged.push(nextSection);
    if (normalizeMarkdown(currentSection.markdown) !== normalizeMarkdown(nextSection.markdown)) {
      updated += 1;
    }
  }

  for (const currentSection of current) {
    const key = sectionKey(currentSection);
    if (nextIds.has(key)) continue;
    const baselineSection = baselineById.get(key);
    const userEdited = !baselineSection
      || normalizeMarkdown(currentSection.markdown) !== normalizeMarkdown(baselineSection.markdown);
    if (userEdited) {
      merged.push(currentSection);
      preserved += 1;
    } else {
      removed += 1;
    }
  }

  return {
    markdown: serializeDocumentSections(merged),
    added,
    updated,
    preserved,
    removed
  };
};

const parseAttributes = (text: string): Record<string, string> => {
  const attributes: Record<string, string> = {};
  for (const match of text.matchAll(attributePattern)) {
    attributes[match[1]] = match[2];
  }
  return attributes;
};

const parseSourceRefs = (attributes: Record<string, string>): string[] => [
  attributes.source,
  ...(attributes.sources?.split(/[\s,]+/) ?? [])
].filter((source): source is string => Boolean(source));

const normalizeHeading = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').toLowerCase();

const normalizeMarkdown = (value: string): string =>
  value.replace(/\r\n/g, '\n').trim();

const serializeDocumentSections = (
  sections: DocumentMarkdownSection[]
): string => sections
  .map((section) => [
    section.marker,
    section.markdown
  ].filter(Boolean).join('\n'))
  .filter(Boolean)
  .join('\n\n');

const sectionKey = (section: DocumentMarkdownSection): string =>
  section.sourceRefs.length
    ? `source:${[...section.sourceRefs].sort().join('|')}`
    : `id:${section.id}`;
