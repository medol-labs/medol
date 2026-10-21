import type { ModelingDocumentRevision } from '../../contracts/modelingDocument';

const internalCommentPattern = /^\s*<!--\s*(?:medol:pagebreak|medol:toc|empty document body|em:section\b[^>]*)\s*-->\s*$/gim;

export const toRenderableDocumentMarkdown = (markdown: string): string =>
  markdown
    .replace(internalCommentPattern, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export const toExportableDocumentMarkdown = (
  markdown: string,
  revisions: ModelingDocumentRevision[] = [],
  unsaved = false,
  format: 'markdown' | 'word' = 'markdown'
): string => {
  const body = format === 'word' ? markdown : toRenderableDocumentMarkdown(markdown);
  if (revisions.length === 0) return body;
  const cell = (value: string | number | undefined): string =>
    String(value ?? '').replace(/\|/g, '&#124;').replace(/[\r\n]+/g, ' ');
  return [
    body,
    '## Revision History',
    ...(unsaved ? ['Export includes unsaved changes after the latest revision.'] : []),
    [
      '| Revision | Date | Origin | Source Snapshot | Source Hash |',
      '| --- | --- | --- | --- | --- |',
      ...revisions.map((revision) => `| ${[
        revision.revisionNo,
        revision.createdAt,
        revision.origin,
        [revision.workspaceVersionNo === undefined ? '' : `#${revision.workspaceVersionNo}`,
          revision.workspaceVersionId, revision.workspaceReleaseLabel,
          revision.workspaceVersionMessage].filter(Boolean).join(' '),
        revision.sourceHash
      ].map(cell).join(' | ')} |`)
    ].join('\n')
  ].join('\n\n');
};
