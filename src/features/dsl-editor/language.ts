import type { Monaco } from '@monaco-editor/react';

const languageId = 'medol';

export const medolLanguageId = languageId;

export const registerMedolLanguage = (monaco: Monaco): void => {
  const registered = monaco.languages
    .getLanguages()
    .some((language: { id: string }) => language.id === languageId);
  if (registered) return;

  monaco.languages.register({ id: languageId });
  monaco.languages.setMonarchTokensProvider(languageId, {
    defaultToken: '',
    tokenPostfix: '.medol',
    keywords: [
      'domain',
      'import',
      'context',
      'type',
      'enum',
      'value',
      'concept',
      'scenario',
      'expression',
      'unique',
      'required',
      'format',
      'length',
      'range',
      'matches',
      'oneOf',
      'assert',
      'state',
      'slice',
      'tags',
      'creates',
      'resulting',
      'actor',
      'ui',
      'command',
      'event',
      'reject',
      'error',
      'readmodel',
      'projection',
      'automation',
      'hotspot',
      'integration',
      'given',
      'when',
      'then',
      'field',
      'fields',
      'from',
      'derived',
      'display',
      'file',
      'rule',
      'example',
      'subscribes',
      'on',
      'emits',
      'updates'
    ],
    tokenizer: {
      root: [
        [/\/\/.*$/, 'comment'],
        [/"""/, 'string', '@multilineString'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string'],
        [/[{}[\]():,]/, 'delimiter'],
        [/\b[A-Z][\w-]*/, 'type.identifier'],
        [/[a-zA-Z_][\w-]*/, {
          cases: {
            '@keywords': 'keyword',
            '@default': 'identifier'
          }
        }],
        [/\d+/, 'number']
      ],
      string: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop']
      ],
      multilineString: [
        [/"""/, 'string', '@pop'],
        [/[^"]+/, 'string'],
        [/"/, 'string']
      ]
    }
  });

  monaco.editor.defineTheme('medol-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '1d4ed8', fontStyle: 'bold' },
      { token: 'type.identifier', foreground: '334155' },
      { token: 'comment', foreground: '64748b' },
      { token: 'string', foreground: 'b45309' }
    ],
    colors: {
      'editor.background': '#fbfdff',
      'editor.lineHighlightBackground': '#eef4fb',
      'editorLineNumber.foreground': '#94a3b8',
      'editorCursor.foreground': '#2563eb'
    }
  });
};
