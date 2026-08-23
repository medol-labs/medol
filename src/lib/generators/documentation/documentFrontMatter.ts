import type { DocumentationLanguage } from './documentationModel';
import { medolSoftwareVersion } from './documentVersion';

export interface DocumentChangeLogRow {
  version: string;
  date: string;
  description: string;
  author: string;
}

export const documentFrontMatterLines = (
  generatedAt: string,
  language: DocumentationLanguage = 'en'
): string[] => {
  const text = frontMatterText[language];
  const row = defaultChangeLogRow(generatedAt, language);
  return [
    '<!-- em:section id="document.changeLog" -->',
    `## ${text.changeLog}`,
    '',
    `| ${text.version} | ${text.date} | ${text.description} | ${text.author} |`,
    '| --- | --- | --- | --- |',
    `| ${row.version} | ${row.date} | ${row.description} | ${row.author} |`,
    ''
  ];
};

export const defaultChangeLogRow = (
  generatedAt: string,
  language: DocumentationLanguage = 'en'
): DocumentChangeLogRow => ({
  version: medolSoftwareVersion,
  date: generatedAt.slice(0, 10),
  description: language === 'zh-CN' ? '初始发布' : 'Initial release',
  author: 'MEDOL'
});

const frontMatterText = {
  en: {
    changeLog: 'Change Log',
    version: 'Version',
    date: 'Date',
    description: 'Change Description',
    author: 'Author'
  },
  'zh-CN': {
    changeLog: '变更记录',
    version: '版本',
    date: '日期',
    description: '变更说明',
    author: '作者'
  }
} satisfies Record<DocumentationLanguage, {
  changeLog: string;
  version: string;
  date: string;
  description: string;
  author: string;
}>;
