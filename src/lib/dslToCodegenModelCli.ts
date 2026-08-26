import { MedolValidationError } from './dslToConfig';
import { medolFileToCodegenModel } from './dslToConfigFile';
import { readFileSync } from 'node:fs';
import { hashMedolSource } from '../features/documentation/documentReferences';
import { buildModelTranslationCatalog, withCodegenTranslations } from '../features/model-i18n/modelTranslation';

const input = process.argv[2];
const locale = readOption('--locale') ?? readOption('--language');
const workspaceId = readOption('--workspace-id');

if (!input) {
  console.error('Usage: npm run medol:to-codegen-model -- ./model.medol [--locale zh-CN] [--workspace-id default]');
  process.exitCode = 1;
} else {
  try {
    let model = medolFileToCodegenModel(input);
    if (locale) {
      const { readResolvedModelTranslations } = await import('../server/modelTranslationResolver');
      const sourceText = readFileSync(input, 'utf8');
      const sourceHash = hashMedolSource(sourceText);
      const catalog = buildModelTranslationCatalog(model);
      const translations = readResolvedModelTranslations({
        workspaceId,
        sourceHash,
        locale
      }, catalog.sourceTexts).translations;
      model = withCodegenTranslations(model, locale, translations);
    }
    console.log(JSON.stringify(model, null, 2));
  } catch (error) {
    console.error(error instanceof MedolValidationError ? error.message : error);
    process.exitCode = 1;
  }
}

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
}
