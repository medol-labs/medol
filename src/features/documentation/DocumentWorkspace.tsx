import Editor from '@monaco-editor/react';
import type { OnMount } from '@monaco-editor/react';
import { Download, FileText, LocateFixed, PanelLeftClose, PanelLeftOpen, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ModelingDocument, ModelingDocumentSummary } from '../../contracts/modelingDocument';
import { Button } from '../../components/ui/button';
import {
  findDocumentSourceLine,
  parseDocumentMarkdownSections
} from './documentReferences';
import type { DocumentPersistenceStatus } from './useModelingDocuments';

interface DocumentWorkspaceProps {
  documents: ModelingDocumentSummary[];
  activeDocument?: ModelingDocument;
  status: DocumentPersistenceStatus;
  error?: string;
  navigationMessage?: string;
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
  const editorRef = useRef<Parameters<OnMount>[0] | undefined>(undefined);
  const sectionRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    setTitle(activeDocument?.title ?? '');
    setMarkdown(activeDocument?.markdown ?? '');
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

  const download = () => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
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
            <p className="mt-3 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
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
                <span className="block truncate text-xs font-semibold">{document.title}</span>
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
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
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
          <div className={`min-h-0 overflow-y-auto bg-white ${mobileMode === 'edit' ? 'hidden lg:block' : 'block'}`}>
            <article className="document-markdown mx-auto max-w-4xl px-8 py-7">
              {markdownSections.map((section) => (
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
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.markdown}</ReactMarkdown>
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
      </section>
    </div>
  );
}

const labelKind = (kind: ModelingDocumentSummary['kind']): string => ({
  prd: 'PRD',
  'software-design': 'Software',
  'database-design': 'Database',
  process: 'Process'
})[kind];
