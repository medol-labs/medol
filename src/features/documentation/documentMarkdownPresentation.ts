const internalCommentPattern = /^\s*<!--\s*(?:medol:pagebreak|medol:toc|empty document body|em:section\b[^>]*)\s*-->\s*$/gim;

export const toRenderableDocumentMarkdown = (markdown: string): string =>
  markdown
    .replace(internalCommentPattern, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
