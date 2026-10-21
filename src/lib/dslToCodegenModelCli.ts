import { MedolValidationError } from './dslToConfig';
import { medolFileToCodegenModel } from './dslToConfigFile';
import { readFileSync } from 'node:fs';
import { hashMedolSource } from '../features/documentation/documentReferences';
import { buildModelTranslationCatalog, withCodegenTranslations } from '../features/model-i18n/modelTranslation';
import { withCodegenProvenance } from './codegenProvenance';

const input = process.argv[2];
const locale = readOption('--locale') ?? readOption('--language');
const workspaceId = readOption('--workspace-id');

if (!input) {
  console.error('Usage: npm run medol:to-codegen-model -- ./model.medol [--locale zh-CN] [--workspace-id default] [--release v1.0.0]');
  process.exitCode = 1;
} else {
  try {
    let model = medolFileToCodegenModel(input);
    const sourceText = readFileSync(input, 'utf8');
    if (locale) {
      const { readResolvedModelTranslations } = await import('../server/modelTranslationResolver');
      const sourceHash = hashMedolSource(sourceText);
      const catalog = buildModelTranslationCatalog(model);
      const translations = readResolvedModelTranslations({
        workspaceId,
        sourceHash,
        locale
      }, catalog.sourceTexts).translations;
      model = withCodegenTranslations(model, locale, translations);
    }
    model = await withCodegenProvenance(model, sourceText, { workspaceId, releaseLabel: readOption('--release') });
    console.log(JSON.stringify(model, null, 2));
  } catch (error) {
    console.error(error instanceof MedolValidationError ? error.message : error);
    process.exitCode = 1;
  }
}

function readOption(name: string): string | undefined {
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline !== undefined) {
    const value = inline.slice(name.length + 1).trim();
    if (!value) throw new Error(`Missing value for ${name}`);
    return value;
  }
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  return value;
}
