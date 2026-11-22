import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseMedolFile } from '../../medolProject';
import { translateDocumentationModelWithModelTranslations } from '../../../features/documentation/documentationTranslation';
import type { ModelTranslations } from '../../../features/model-i18n/modelTranslation';
import { enhanceDocumentationWithAgent } from '../../../features/documentation/documentationAgent';
import {
  generateDocumentation,
  generateDocumentationBundle
} from './documentationGenerator';
import type { DocumentationKind, DocumentationLanguage } from './documentationModel';
import { generateGbt8567Documents, GBT8567_PROFILE, gbt8567Kinds, type Gbt8567Kind } from './gbt8567';
import { generateGbt8567Srs, gbt8567SrsSchema } from './gbt8567Srs';

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
const argument = (name: string) => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const profile = argument('profile');
const materialsPath = argument('materials');
const outputDirectory = argument('out-dir');
if (enhanceWithAi) {
  const envPath = join(process.cwd(), '.env');
  if (existsSync(envPath)) process.loadEnvFile(envPath);
}
const language: DocumentationLanguage = languageArgument === 'zh-CN' || languageArgument === 'zh'
  ? 'zh-CN'
  : 'en';

if (profile !== undefined) {
  await runProfile();
} else if (materialsPath !== undefined || outputDirectory !== undefined || gbt8567Kinds.includes(kindArgument as Gbt8567Kind)) {
  throw new Error(`GB/T document options require --profile=${GBT8567_PROFILE}`);
} else if (!input) {
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

async function runProfile() {
  if (profile !== GBT8567_PROFILE) throw new Error(`Unknown documentation profile: ${profile}`);
  if (!input || !materialsPath) throw new Error(`Usage: docs:generate -- model.medol --profile=${GBT8567_PROFILE} --materials=materials.json [--kind=srs|sdd|dbdd|std|all] [--out-dir=path]`);
  if (languageArgument && !['zh-CN', 'zh'].includes(languageArgument)) throw new Error('This profile currently supports zh-CN only');
  if (enhanceWithAi || translationsArgument) throw new Error('The GB/T profile uses reviewed project materials and original model identifiers');
  const selected = kindArgument ?? 'all';
  if (selected !== 'all' && !gbt8567Kinds.includes(selected as Gbt8567Kind)) throw new Error(`Unsupported GB/T document kind: ${selected}`);
  if (outputDirectory !== undefined && (!outputDirectory || outputPath !== undefined || outputJson || selected !== 'all')) {
    throw new Error('--out-dir emits the full GB/T package and cannot be combined with --out, --json or a single kind');
  }

  const materialsText = readFileSync(materialsPath, 'utf8');
  const materials: unknown = JSON.parse(materialsText);
  const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
  if (materials && typeof materials === 'object' && 'documentKind' in materials) {
    if ((kindArgument && selected !== 'srs') || outputDirectory !== undefined) {
      throw new Error('Standalone SRS materials support --kind=srs with --out or standard output');
    }
    const spec = gbt8567SrsSchema.parse(materials);
    const approvedCases = new Map<string, ReadonlySet<string>>();
    const sources = spec.sources.map(source => {
      const path = resolve(dirname(materialsPath), source.path);
      const bytes = readFileSync(path);
      if (source.kind === 'model' && realpathSync(path) !== realpathSync(input)) {
        throw new Error(`${source.id}: documented primary model must match the CLI input`);
      }
      if (source.kind === 'approved-cases') {
        const registry = JSON.parse(bytes.toString('utf8')) as { cases?: Array<{ id?: string; status?: string }> };
        if (!Array.isArray(registry.cases)) throw new Error(`${source.id}: missing cases registry`);
        approvedCases.set(source.id, new Set(registry.cases.flatMap(item =>
          typeof item.id === 'string' && item.status === 'approved' ? [item.id] : [])));
      }
      return { ...source, sha256: sha256(bytes) };
    });
    const document = generateGbt8567Srs(parseMedolFile(input), spec, approvedCases);
    const output = outputJson ? JSON.stringify({
      profile, ...document, sources, materialsSha256: sha256(materialsText),
      documentSha256: sha256(document.markdown),
    }, null, 2) + '\n' : document.markdown;
    if (outputPath) {
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, output, 'utf8');
    } else {
      process.stdout.write(output);
    }
    return;
  }
  const result = generateGbt8567Documents(parseMedolFile(input), materials);
  const sources = result.sources.map(source => {
    const path = resolve(dirname(materialsPath), source.path);
    if (!existsSync(path) || !statSync(path).isFile()) throw new Error(`${source.id}: source is not a file: ${source.path}`);
    return { ...source, sha256: sha256(readFileSync(path)) };
  });
  const { documents, sources: _sources, ...trace } = result;
  const manifest = {
    schemaVersion: 1,
    ...trace,
    sources,
    materialsSha256: sha256(materialsText),
    modelFileSha256: sha256(readFileSync(input)),
    documents: Object.values(documents).map(({ kind, title, clause, markdown }) => ({
      kind, title, clause, file: `${kind}.md`, sha256: sha256(markdown),
    })),
  };
  if (outputDirectory) {
    mkdirSync(outputDirectory, { recursive: true });
    for (const document of Object.values(documents)) {
      writeFileSync(join(outputDirectory, `${document.kind}.md`), document.markdown, 'utf8');
    }
    writeFileSync(join(outputDirectory, 'traceability.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.error(`Wrote SRS, SDD, DBDD, STD and traceability.json to ${outputDirectory}`);
    return;
  }
  const output = selected === 'all'
    ? outputJson ? JSON.stringify({ ...manifest, documents }, null, 2) : Object.values(documents).map(doc => doc.markdown.trimEnd()).join('\n\n---\n\n')
    : outputJson ? JSON.stringify(documents[selected as Gbt8567Kind], null, 2) : documents[selected as Gbt8567Kind].markdown;
  if (outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, output.trimEnd() + '\n', 'utf8');
  } else {
    console.log(output.trimEnd());
  }
}

function readTranslations(path: string): ModelTranslations {
  const data = JSON.parse(readFileSync(path, 'utf8')) as {
    translations?: Record<string, ModelTranslations>;
  };
  return data.translations?.['zh-CN'] ?? {};
}
