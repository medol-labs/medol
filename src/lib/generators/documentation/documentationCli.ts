import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseMedolFile } from '../../medolProject';
import { translateDocumentationModelWithModelTranslations } from '../../../features/documentation/documentationTranslation';
import type { ModelTranslations } from '../../../features/model-i18n/modelTranslation';
import {
  generateDocumentation,
  generateDocumentationBundle
} from './documentationGenerator';
import type { DocumentationKind, DocumentationLanguage } from './documentationModel';

function parseKind(value?: string): DocumentationKind | 'all' {
  if (
    value === 'prd'
    || value === 'software-design'
    || value === 'database-design'
    || value === 'process'
    || value === 'test-outline'
    || value === 'user-journey'
    || value === 'diagrams'
    || value === 'installation-manual'
    || value === 'user-manual'
    || value === 'all'
  ) {
    return value;
  }
  return 'all';
}

const args = process.argv.slice(2);
const input = args.find((arg) => !arg.startsWith('--'));
const kindArgument = args.find((arg) => arg.startsWith('--kind='))?.slice('--kind='.length);
const languageArgument = args.find((arg) => arg.startsWith('--language='))?.slice('--language='.length);
const translationsArgument = args.find((arg) => arg.startsWith('--translations='))?.slice('--translations='.length);
const outputJson = args.includes('--json');
const language: DocumentationLanguage = languageArgument === 'zh-CN' || languageArgument === 'zh'
  ? 'zh-CN'
  : 'en';

if (!input) {
  console.error('Usage: npm run docs:generate -- ./model.medol [--kind=prd|software-design|database-design|process|test-outline|user-journey|diagrams|installation-manual|user-manual|all] [--language=en|zh-CN] [--translations=path/to/model-translations.zh-CN.json] [--json]');
  process.exitCode = 1;
} else {
  const sourceText = readFileSync(input, 'utf8');
  const model = parseMedolFile(input);
  const translationsPath = translationsArgument ?? join(dirname(input), 'model-translations.zh-CN.json');
  const translations = language === 'zh-CN' && existsSync(translationsPath)
    ? readTranslations(translationsPath)
    : {};
  const documentationModel = Object.keys(translations).length > 0
    ? translateDocumentationModelWithModelTranslations(model, translations)
    : model;
  const kind = parseKind(kindArgument);

  if (kind === 'all') {
    const documents = generateDocumentationBundle(documentationModel, { sourceText, language });
    console.log(outputJson
      ? JSON.stringify(documents, null, 2)
      : Object.values(documents).map((document) => document.markdown).join('\n\n---\n\n'));
  } else {
    const document = generateDocumentation(documentationModel, kind, { sourceText, language });
    console.log(outputJson ? JSON.stringify(document, null, 2) : document.markdown);
  }
}

function readTranslations(path: string): ModelTranslations {
  const data = JSON.parse(readFileSync(path, 'utf8')) as {
    translations?: Record<string, ModelTranslations>;
  };
  return data.translations?.['zh-CN'] ?? {};
}
