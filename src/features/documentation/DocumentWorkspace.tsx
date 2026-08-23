import Editor from '@monaco-editor/react';
import type { OnMount } from '@monaco-editor/react';
import { Download, FileDown, FileText, LocateFixed, PanelLeftClose, PanelLeftOpen, Save, Trash2 } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { Children, isValidElement, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ModelingDocument, ModelingDocumentSummary } from '../../contracts/modelingDocument';
import { Button } from '../../components/ui/button';
import { OverflowText } from '../../components/ui/overflow-text';
import { renderSimpleMermaidSvg } from '../../lib/generators/documentation/simpleMermaidRenderer';
import {
  findDocumentSourceLine,
  parseDocumentMarkdownSections
} from './documentReferences';
import { markdownHeadingAnchor } from '../../lib/generators/documentation/documentTableOfContents';
import { toRenderableDocumentMarkdown } from './documentMarkdownPresentation';
import { exportModelingDocumentWord, type WordExportProfileId } from './modelingDocumentClient';
import type { DocumentPersistenceStatus } from './useModelingDocuments';

interface DocumentWorkspaceProps {
  documents: ModelingDocumentSummary[];
  activeDocument?: ModelingDocument;
  status: DocumentPersistenceStatus;
  error?: string;
  navigationMessage?: string;
  navigationMessageTone?: 'info' | 'warning';
  focusSourceId?: string;
  focusVersion: number;
  currentSourceHash: string;
  onSelect: (documentId: string) => void;
  onSave: (title: string, markdown: string) => Promise<unknown>;
  onDelete: () => Promise<void>;
  onLocateSource: (sourceId: string) => void;
}

export function DocumentWorkspace({
  documents,
  activeDocument,
  status,
  error,
  navigationMessage,
  navigationMessageTone = 'warning',
  focusSourceId,
  focusVersion,
  currentSourceHash,
  onSelect,
  onSave,
  onDelete,
  onLocateSource
}: DocumentWorkspaceProps) {
  const [title, setTitle] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMode, setMobileMode] = useState<'edit' | 'preview'>('edit');
  const [wordExportStatus, setWordExportStatus] = useState<'idle' | 'exporting' | 'error'>('idle');
  const [wordExportError, setWordExportError] = useState<string | undefined>(undefined);
  const [wordExportProfile, setWordExportProfile] = useState<WordExportProfileId>('default');
  const editorRef = useRef<Parameters<OnMount>[0] | undefined>(undefined);
  const editorScrollSubscription = useRef<{ dispose: () => void } | undefined>(undefined);
  const editorInteractionCleanup = useRef<(() => void) | undefined>(undefined);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollDriver = useRef<'editor' | 'preview' | undefined>(undefined);
  const scrollDriverTimer = useRef<number | undefined>(undefined);
  const sectionRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    setTitle(activeDocument?.title ?? '');
    setMarkdown(activeDocument?.markdown ?? '');
    setWordExportProfile(activeDocument?.language === 'zh-CN' ? 'zh-formal' : 'default');
  }, [activeDocument]);

  const dirty = Boolean(activeDocument)
    && (title !== activeDocument?.title || markdown !== activeDocument?.markdown);
  const sourceStatus = !activeDocument?.sourceHash
    ? 'Untracked source'
    : activeDocument.sourceHash === currentSourceHash
      ? 'MEDOL current'
      : 'MEDOL changed';
  const statusLabel = status === 'saving'
    ? 'Saving'
    : status === 'loading'
      ? 'Loading'
      : dirty
        ? 'Unsaved'
        : status === 'error'
          ? 'Save failed'
          : 'Saved';
  const filename = useMemo(() => {
    const base = (title || activeDocument?.title || 'document')
      .trim()
      .replace(/[^\w\u4e00-\u9fff-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
    return `${base || 'document'}.md`;
  }, [activeDocument?.title, title]);
  const markdownSections = useMemo(
    () => parseDocumentMarkdownSections(markdown),
    [markdown]
  );
  const renderableMarkdownSections = useMemo(
    () => markdownSections.map((section) => ({
      ...section,
      markdown: toRenderableDocumentMarkdown(section.markdown)
    })),
    [markdownSections]
  );
  const downloadableMarkdown = useMemo(
    () => toRenderableDocumentMarkdown(markdown),
    [markdown]
  );

  useEffect(() => {
    if (!focusSourceId || markdown !== activeDocument?.markdown) return;
    const section = sectionRefs.current.get(focusSourceId);
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const line = findDocumentSourceLine(markdown, focusSourceId);
    if (line) {
      editorRef.current?.revealLineInCenter(line);
      editorRef.current?.setPosition({ lineNumber: line, column: 1 });
    }
  }, [activeDocument?.id, activeDocument?.markdown, focusSourceId, focusVersion, markdown]);

  useEffect(() => () => {
    editorScrollSubscription.current?.dispose();
    editorInteractionCleanup.current?.();
    if (scrollDriverTimer.current !== undefined) window.clearTimeout(scrollDriverTimer.current);
  }, []);

  const markScrollDriver = (source: 'editor' | 'preview') => {
    scrollDriver.current = source;
    if (scrollDriverTimer.current !== undefined) window.clearTimeout(scrollDriverTimer.current);
    scrollDriverTimer.current = window.setTimeout(() => {
      scrollDriver.current = undefined;
      scrollDriverTimer.current = undefined;
    }, 180);
  };

  const syncPreviewFromEditor = (scrollTop: number) => {
    if (scrollDriver.current === 'preview') return;
    markScrollDriver('editor');
    const editor = editorRef.current;
    const preview = previewScrollRef.current;
    if (!editor || !preview) return;
    const anchors = collectPreviewAnchors(preview);
    if (anchors.length === 0) return;
    const visibleLine = editor.getVisibleRanges()[0]?.startLineNumber ?? 1;
    const [anchor, nextAnchor] = findLineAnchors(anchors, visibleLine);
    const sourceEnd = nextAnchor?.line ?? anchor.endLine;
    const progress = clamp((visibleLine - anchor.line) / Math.max(1, sourceEnd - anchor.line));
    const previewMax = Math.max(0, preview.scrollHeight - preview.clientHeight);
    const previewEnd = nextAnchor?.top ?? Math.min(previewMax, anchor.top + anchor.height);
    const target = anchor.top + progress * Math.max(0, previewEnd - anchor.top);
    preview.scrollTop = Math.min(previewMax, Math.max(0, target));
  };

  const syncEditorFromPreview = () => {
    if (scrollDriver.current === 'editor') return;
    markScrollDriver('preview');
    const editor = editorRef.current;
    const preview = previewScrollRef.current;
    if (!editor || !preview) return;
    const anchors = collectPreviewAnchors(preview);
    if (anchors.length === 0) return;
    const [anchor, nextAnchor] = findPreviewAnchors(anchors, preview.scrollTop);
    const previewEnd = nextAnchor?.top ?? anchor.top + anchor.height;
    const progress = clamp(
      (preview.scrollTop - anchor.top) / Math.max(1, previewEnd - anchor.top)
    );
    const sourceEnd = nextAnchor?.line ?? anchor.endLine;
    const sourceLine = anchor.line + progress * Math.max(0, sourceEnd - anchor.line);
    editor.setScrollTop(editor.getTopForLineNumber(Math.max(1, Math.round(sourceLine))));
  };

  const handlePreviewClick = (event: MouseEvent<HTMLDivElement>) => {
    const link = (event.target as Element | null)?.closest?.('a[href^="#"]');
    const href = link?.getAttribute('href');
    const preview = previewScrollRef.current;
    if (!href || !preview) return;
    const targetId = decodeURIComponent(href.slice(1));
    const target = [...preview.querySelectorAll<HTMLElement>('[id]')]
      .find((element) => element.id === targetId);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const download = () => {
    const blob = new Blob([downloadableMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadWord = async () => {
    if (!title.trim()) return;
    setWordExportStatus('exporting');
    setWordExportError(undefined);
    try {
      const exported = await exportModelingDocumentWord({
        title: title.trim(),
        markdown,
        profileId: wordExportProfile
      });
      downloadBlob(exported.blob, exported.filename);
      setWordExportStatus('idle');
    } catch (error) {
      setWordExportStatus('error');
      setWordExportError(error instanceof Error ? error.message : String(error));
    }
  };

  if (!activeDocument) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-white text-center">
        <div className="max-w-sm px-8">
          <FileText className="mx-auto mb-4 size-9 text-slate-400" aria-hidden="true" />
          <h2 className="text-base font-semibold text-slate-800">No generated documents</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Choose a document action from the toolbar. The generated Markdown will be saved and opened here.
          </p>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          {navigationMessage && (
            <p className={`mt-3 border px-3 py-2 text-sm ${
              navigationMessageTone === 'info'
                ? 'border-blue-200 bg-blue-50 text-blue-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}>
              {navigationMessage}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`grid h-full min-h-0 bg-white ${sidebarOpen ? 'grid-cols-[220px_minmax(0,1fr)]' : 'grid-cols-[42px_minmax(0,1fr)]'}`}>
      <aside className="flex min-h-0 flex-col overflow-hidden border-r border-slate-200 bg-slate-50">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-200 px-2">
          {sidebarOpen && <strong className="px-1 text-xs uppercase text-slate-500">Documents</strong>}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            title={sidebarOpen ? 'Collapse document list' : 'Expand document list'}
            onClick={() => setSidebarOpen((open) => !open)}
          >
            {sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
          </Button>
        </div>
        {sidebarOpen && (
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {documents.map((document) => (
              <button
                key={document.id}
                type="button"
                className={`mb-1 w-full border px-2.5 py-2 text-left ${
                  document.id === activeDocument.id
                    ? 'border-blue-300 bg-blue-50 text-blue-950'
                    : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-white'
                }`}
                onClick={() => {
                  if (!dirty || window.confirm('Discard unsaved document changes?')) onSelect(document.id);
                }}
              >
                <OverflowText
                  text={document.title}
                  className="block truncate text-xs font-semibold"
                />
                <span className="mt-1 block text-[11px] text-slate-500">
                  {labelKind(document.kind)} · {document.language === 'zh-CN' ? '中文' : 'EN'}
                </span>
              </button>
            ))}
          </div>
        )}
      </aside>

      <section className="relative grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)]">
        <div>
          <header className="flex min-h-12 items-center gap-2 border-b border-slate-200 bg-white px-3">
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-slate-900 outline-none"
              value={title}
              aria-label="Document title"
              onChange={(event) => setTitle(event.target.value)}
            />
            <span className={`shrink-0 text-xs ${dirty ? 'text-amber-700' : 'text-slate-500'}`}>{statusLabel}</span>
            <span
              className={`shrink-0 border px-2 py-1 text-[11px] ${
                activeDocument.sourceHash === currentSourceHash
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}
              title="Whether this document was generated from the current MEDOL content"
            >
              {sourceStatus}
            </span>
            <div className="flex shrink-0 rounded border border-slate-200 p-0.5 lg:hidden">
              <button
                type="button"
                className={`px-2 py-1 text-xs ${mobileMode === 'edit' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                onClick={() => setMobileMode('edit')}
              >
                Edit
              </button>
              <button
                type="button"
                className={`px-2 py-1 text-xs ${mobileMode === 'preview' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                onClick={() => setMobileMode('preview')}
              >
                Preview
              </button>
            </div>
            <Button type="button" variant="outline" size="icon" title="Download Markdown" onClick={download}>
              <Download />
            </Button>
            <select
              className="h-9 shrink-0 border border-slate-200 bg-white px-2 text-xs text-slate-700"
              value={wordExportProfile}
              aria-label="Word export format"
              title="Word export format"
              onChange={(event) => setWordExportProfile(event.target.value as WordExportProfileId)}
            >
              <option value="default">Default DOCX</option>
              <option value="zh-formal">中文正式</option>
            </select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Download Word"
              disabled={wordExportStatus === 'exporting' || !title.trim()}
              onClick={() => void downloadWord()}
            >
              <FileDown />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Delete document"
              onClick={() => {
                if (window.confirm(`Delete "${activeDocument.title}"?`)) void onDelete();
              }}
            >
              <Trash2 />
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!dirty || !title.trim() || status === 'saving'}
              onClick={() => void onSave(title.trim(), markdown)}
            >
              <Save />
              Save
            </Button>
          </header>
          {navigationMessage && (
            <div className={`border-b px-4 py-2 text-xs ${
              navigationMessageTone === 'info'
                ? 'border-blue-200 bg-blue-50 text-blue-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}>
              {navigationMessage}
            </div>
          )}
        </div>

        <div className="grid min-h-0 min-w-0 lg:grid-cols-2">
          <div className={`min-h-0 min-w-0 border-r border-slate-200 ${mobileMode === 'preview' ? 'hidden lg:block' : 'block'}`}>
            <Editor
              height="100%"
              language="markdown"
              theme="vs"
              value={markdown}
              onChange={(value) => setMarkdown(value ?? '')}
              onMount={(editor) => {
                editorRef.current = editor;
                editorScrollSubscription.current?.dispose();
                editorInteractionCleanup.current?.();
                const editorElement = editor.getDomNode();
                const takeEditorControl = () => markScrollDriver('editor');
                editorElement?.addEventListener('wheel', takeEditorControl, { passive: true });
                editorElement?.addEventListener('pointerdown', takeEditorControl);
                editorElement?.addEventListener('keydown', takeEditorControl);
                editorInteractionCleanup.current = () => {
                  editorElement?.removeEventListener('wheel', takeEditorControl);
                  editorElement?.removeEventListener('pointerdown', takeEditorControl);
                  editorElement?.removeEventListener('keydown', takeEditorControl);
                };
                editorScrollSubscription.current = editor.onDidScrollChange((event) => {
                  if (event.scrollTopChanged) syncPreviewFromEditor(event.scrollTop);
                });
              }}
              options={{
                minimap: { enabled: false },
                wordWrap: 'on',
                fontSize: 13,
                lineHeight: 21,
                padding: { top: 16, bottom: 24 },
                scrollBeyondLastLine: false,
                automaticLayout: true
              }}
            />
          </div>
          <div
            ref={previewScrollRef}
            data-document-preview
            className={`min-h-0 overflow-y-auto bg-white ${mobileMode === 'edit' ? 'hidden lg:block' : 'block'}`}
            onScroll={syncEditorFromPreview}
            onWheel={() => markScrollDriver('preview')}
            onPointerDown={() => markScrollDriver('preview')}
            onClick={handlePreviewClick}
          >
            <article className="document-markdown mx-auto max-w-4xl px-8 py-7">
              {renderableMarkdownSections.map((section) => (
                <section
                  key={section.id}
                  className={focusSourceId && section.sourceRefs.includes(focusSourceId)
                    ? 'document-markdown__section is-focused'
                    : 'document-markdown__section'}
                  ref={(element) => {
                    for (const sourceRef of section.sourceRefs) {
                      if (element) sectionRefs.current.set(sourceRef, element);
                      else sectionRefs.current.delete(sourceRef);
                    }
                  }}
                >
                  {section.sourceRefs.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="document-markdown__locate"
                      title="Locate in MEDOL"
                      onClick={() => onLocateSource(section.sourceRefs[0])}
                    >
                      <LocateFixed />
                    </Button>
                  )}
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[
                      createSourceLinePlugin((section.contentStartLine ?? section.startLine ?? 1) - 1),
                      createHeadingAnchorPlugin()
                    ]}
                    components={markdownComponents}
                  >
                    {section.markdown}
                  </ReactMarkdown>
                </section>
              ))}
            </article>
          </div>
        </div>
        {error && (
          <div className="absolute bottom-8 right-8 border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 shadow-sm">
            {error}
          </div>
        )}
        {wordExportStatus === 'error' && wordExportError && (
          <div className="absolute bottom-8 right-8 max-w-sm border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 shadow-sm">
            {wordExportError}
          </div>
        )}
      </section>
    </div>
  );
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const labelKind = (kind: ModelingDocumentSummary['kind']): string => ({
  prd: 'PRD',
  'software-design': 'Software',
  'database-design': 'Database',
  process: 'Process',
  'test-outline': 'Test',
  'installation-manual': 'Install',
  'user-manual': 'User',
  'model-translations': 'I18N'
})[kind];

const markdownComponents: Components = {
  pre({ children, node: _node, ...props }) {
    if (containsMermaidCode(children)) {
      return <div className="document-mermaid-source" {...props}>{children}</div>;
    }
    return <pre {...props}>{children}</pre>;
  },
  code({ className, children, node: _node, ...props }) {
    const language = className?.split(/\s+/).find((name) => name.startsWith('language-'))?.replace('language-', '');
    if (language === 'mermaid') {
      return <MermaidDiagram source={String(children).replace(/\n$/, '')} />;
    }
    return <code className={className} {...props}>{children}</code>;
  }
};

function MermaidDiagram({ source }: { source: string }) {
  const svg = useMemo(() => renderSimpleMermaidSvg(source), [source]);
  if (!svg) {
    return (
      <pre className="document-mermaid-fallback">
        <code>{source}</code>
      </pre>
    );
  }
  return (
    <div
      className="document-mermaid"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

const containsMermaidCode = (children: ReactNode): boolean => {
  const items = Children.toArray(children);
  return items.length === 1
    && isValidElement<{ className?: string }>(items[0])
    && typeof items[0].props.className === 'string'
    && items[0].props.className.split(/\s+/).includes('language-mermaid');
};

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

interface PreviewAnchor {
  line: number;
  endLine: number;
  top: number;
  height: number;
}

interface PositionedNode {
  type?: string;
  tagName?: string;
  value?: string;
  position?: {
    start?: { line?: number };
    end?: { line?: number };
  };
  properties?: Record<string, unknown>;
  children?: PositionedNode[];
}

const sourceMappedTags = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'li', 'blockquote', 'pre', 'table', 'hr'
]);

const createSourceLinePlugin = (lineOffset: number) => () => (tree: PositionedNode) => {
  const visit = (node: PositionedNode) => {
    if (
      node.type === 'element'
      && node.tagName
      && sourceMappedTags.has(node.tagName)
      && node.position?.start?.line
    ) {
      node.properties ??= {};
      node.properties['data-source-line'] = node.position.start.line + lineOffset;
      node.properties['data-source-end-line'] =
        (node.position.end?.line ?? node.position.start.line) + lineOffset;
    }
    node.children?.forEach(visit);
  };
  visit(tree);
};

const createHeadingAnchorPlugin = () => () => (tree: PositionedNode) => {
  const usedAnchors = new Map<string, number>();
  const visit = (node: PositionedNode) => {
    if (
      node.type === 'element'
      && node.tagName
      && /^h[1-6]$/u.test(node.tagName)
    ) {
      const title = extractNodeText(node).trim();
      if (title) {
        node.properties ??= {};
        node.properties.id = uniqueAnchor(markdownHeadingAnchor(title), usedAnchors);
      }
    }
    node.children?.forEach(visit);
  };
  visit(tree);
};

const extractNodeText = (node: PositionedNode): string =>
  node.children?.map((child) =>
    typeof child.value === 'string'
      ? child.value
      : extractNodeText(child)
  ).join('') ?? '';

const uniqueAnchor = (anchor: string, usedAnchors: Map<string, number>): string => {
  const count = usedAnchors.get(anchor) ?? 0;
  usedAnchors.set(anchor, count + 1);
  return count === 0 ? anchor : `${anchor}-${count}`;
};

const getPreviewOffset = (preview: HTMLElement, element: HTMLElement): number =>
  element.getBoundingClientRect().top
  - preview.getBoundingClientRect().top
  + preview.scrollTop;

const collectPreviewAnchors = (preview: HTMLElement): PreviewAnchor[] =>
  [...preview.querySelectorAll<HTMLElement>('[data-source-line]')]
    .map((element) => ({
      line: Number(element.dataset.sourceLine),
      endLine: Number(element.dataset.sourceEndLine ?? element.dataset.sourceLine),
      top: getPreviewOffset(preview, element),
      height: element.offsetHeight
    }))
    .filter((anchor) => Number.isFinite(anchor.line))
    .sort((left, right) => left.line - right.line || left.top - right.top);

const findLineAnchors = (
  anchors: PreviewAnchor[],
  line: number
): [PreviewAnchor, PreviewAnchor | undefined] => {
  let index = 0;
  while (index + 1 < anchors.length && anchors[index + 1].line <= line) index += 1;
  return [anchors[index], anchors[index + 1]];
};

const findPreviewAnchors = (
  anchors: PreviewAnchor[],
  scrollTop: number
): [PreviewAnchor, PreviewAnchor | undefined] => {
  let index = 0;
  while (index + 1 < anchors.length && anchors[index + 1].top <= scrollTop + 1) index += 1;
  return [anchors[index], anchors[index + 1]];
};
