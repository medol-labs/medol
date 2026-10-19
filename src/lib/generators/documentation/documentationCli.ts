import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseMedolFile } from '../../medolProject';
import { translateDocumentationModelWithModelTranslations } from '../../../features/documentation/documentationTranslation';
import type { ModelTranslations } from '../../../features/model-i18n/modelTranslation';
import { enhanceDocumentationWithAgent } from '../../../features/documentation/documentationAgent';
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
const enhanceWithAi = args.includes('--enhance-with-ai');
const outputPath = args.find((arg) => arg.startsWith('--out='))?.slice('--out='.length);
if (enhanceWithAi) {
  const envPath = join(process.cwd(), '.env');
  if (existsSync(envPath)) process.loadEnvFile(envPath);
}
const language: DocumentationLanguage = languageArgument === 'zh-CN' || languageArgument === 'zh'
  ? 'zh-CN'
  : 'en';

if (!input) {
  console.error('Usage: npm run docs:generate -- ./model.medol [--kind=prd|software-design|database-design|process|test-outline|user-journey|diagrams|installation-manual|user-manual|all] [--language=en|zh-CN] [--translations=path/to/model-translations.zh-CN.json] [--json] [--enhance-with-ai] [--out=path]');
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

  let output: string;
  if (kind === 'all') {
    const documents = generateDocumentationBundle(documentationModel, { sourceText, language });
    if (enhanceWithAi) {
      for (const document of Object.values(documents)) {
        const review = await enhanceDocumentationWithAgent(document);
        document.markdown = review.markdown;
        if (review.warning) console.error(`[docs] ${document.kind}: ${review.warning}`);
      }
    }
    output = outputJson
      ? JSON.stringify(documents, null, 2)
      : Object.values(documents).map((document) => document.markdown).join('\n\n---\n\n');
  } else {
    const document = generateDocumentation(documentationModel, kind, { sourceText, language });
    if (enhanceWithAi) {
      const review = await enhanceDocumentationWithAgent(document);
      document.markdown = review.markdown;
      if (review.warning) console.error(`[docs] ${kind}: ${review.warning}`);
    }
    output = outputJson ? JSON.stringify(document, null, 2) : document.markdown;
  }
  if (outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${output.trimEnd()}\n`, 'utf8');
    console.error(`Wrote ${outputPath}`);
  } else {
    console.log(output);
  }
}

function readTranslations(path: string): ModelTranslations {
  const data = JSON.parse(readFileSync(path, 'utf8')) as {
    translations?: Record<string, ModelTranslations>;
  };
  return data.translations?.['zh-CN'] ?? {};
}
