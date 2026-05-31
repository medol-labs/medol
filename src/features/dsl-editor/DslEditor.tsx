import { Editor, type BeforeMount, type OnMount } from '@monaco-editor/react';
import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react';
import type { editor } from 'monaco-editor';
import { eventModelingLanguageId, registerEventModelingLanguage } from './language';

interface DslEditorProps {
  value: string;
  diagnostics: string[];
  focusLine?: number;
  focusVersion?: number;
  onChange: (value: string) => void;
}

export function DslEditor({ value, diagnostics, focusLine, focusVersion, onChange }: DslEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);

  const beforeMount = useCallback<BeforeMount>((monaco) => {
    registerEventModelingLanguage(monaco);
  }, []);

  const onMount = useCallback<OnMount>((mountedEditor, monaco) => {
    editorRef.current = mountedEditor;
    monacoRef.current = monaco;
    monaco.editor.setTheme('event-modeling-light');
  }, []);

  useEffect(() => {
    const monaco = monacoRef.current;
    const model = editorRef.current?.getModel();
    if (!monaco || !model) return;

    monaco.editor.setModelMarkers(model, 'event-modeling-dsl', diagnostics.map((message, index) => ({
      severity: monaco.MarkerSeverity.Warning,
      message,
      startLineNumber: Math.max(index + 1, 1),
      startColumn: 1,
      endLineNumber: Math.max(index + 1, 1),
      endColumn: 1
    })));
  }, [diagnostics]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !focusLine) return;

    editor.revealLineInCenter(focusLine);
    editor.setPosition({ lineNumber: focusLine, column: 1 });
    editor.focus();
  }, [focusVersion]);

  const stopKeyboardPropagation = (event: KeyboardEvent) => {
    event.stopPropagation();
  };

  return (
    <div className="dsl-editor-host" onKeyDown={stopKeyboardPropagation} onKeyUp={stopKeyboardPropagation}>
      <Editor
        height="100%"
        path="model.em"
        language={eventModelingLanguageId}
        theme="event-modeling-light"
        defaultValue={value}
        beforeMount={beforeMount}
        onMount={onMount}
        onChange={(nextValue) => onChange(nextValue ?? '')}
        loading="Loading editor"
        options={{
          automaticLayout: true,
          fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
          fontSize: 13,
          lineHeight: 21,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          tabSize: 2,
          folding: true,
          renderLineHighlight: 'all',
          fixedOverflowWidgets: true
        }}
      />
    </div>
  );
}
