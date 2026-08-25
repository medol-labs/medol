import { readFileSync } from 'node:fs';
import { parseMedolFile } from '../../medolProject';
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
const outputJson = args.includes('--json');
const language: DocumentationLanguage = languageArgument === 'zh-CN' || languageArgument === 'zh'
  ? 'zh-CN'
  : 'en';

if (!input) {
  console.error('Usage: npm run docs:generate -- ./model.medol [--kind=prd|software-design|database-design|process|test-outline|user-journey|installation-manual|user-manual|all] [--language=en|zh-CN] [--json]');
  process.exitCode = 1;
} else {
  const sourceText = readFileSync(input, 'utf8');
  const model = parseMedolFile(input);
  const kind = parseKind(kindArgument);

  if (kind === 'all') {
    const documents = generateDocumentationBundle(model, { sourceText, language });
    console.log(outputJson
      ? JSON.stringify(documents, null, 2)
      : Object.values(documents).map((document) => document.markdown).join('\n\n---\n\n'));
  } else {
    const document = generateDocumentation(model, kind, { sourceText, language });
    console.log(outputJson ? JSON.stringify(document, null, 2) : document.markdown);
  }
}
