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
      'active',
      'actor',
      'as',
      'assert',
      'asyncJob',
      'automation',
      'background',
      'by',
      'cache',
      'capabilities',
      'clientEffect',
      'code',
      'command',
      'concept',
      'condition',
      'config',
      'confirm',
      'context',
      'copy',
      'decision',
      'deploy',
      'deployment',
      'derived',
      'detail',
      'dialog',
      'dictionary',
      'dictionaryProvider',
      'display',
      'domain',
      'download',
      'drawer',
      'each',
      'eligible',
      'emits',
      'endpoint',
      'enum',
      'error',
      'event',
      'example',
      'export',
      'expression',
      'external',
      'false',
      'field',
      'file',
      'for',
      'form',
      'format',
      'from',
      'frontend',
      'generated',
      'given',
      'hotspot',
      'id',
      'import',
      'includes',
      'inline',
      'integration',
      'key',
      'kind',
      'label',
      'length',
      'list',
      'lookup',
      'matches',
      'metric',
      'missing',
      'navigate',
      'note',
      'null',
      'on',
      'oneOf',
      'openExternal',
      'order',
      'policy',
      'port',
      'portOutput',
      'preview',
      'print',
      'projection',
      'protocol',
      'query',
      'range',
      'reactsTo',
      'readmodel',
      'reject',
      'result',
      'revealSecret',
      'risk',
      'rule',
      'scenario',
      'share',
      'slice',
      'source',
      'specification',
      'startsLifecycle',
      'state',
      'steps',
      'strategy',
      'stream',
      'subscribe',
      'sync',
      'tags',
      'target',
      'technical',
      'then',
      'todo',
      'true',
      'type',
      'ui',
      'unique',
      'uploadFile',
      'userJourney',
      'value',
      'view',
      'when',
      'where',
      'wizard'
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
