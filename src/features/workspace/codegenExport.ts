import { modelToCodegenModel } from '../../lib/codegenModel';
import { withCodegenProvenance } from '../../lib/codegenProvenance';
import { parseMedol } from '../../lib/dslParser';
import { withCodegenTranslations, type ModelTranslations } from '../model-i18n/modelTranslation';

export const resolveCodegenModelExport = async (
  input: { dsl: string; workspaceId?: string; locale: string },
  readRemote: (input: { workspaceId: string; locale?: string }) => Promise<string>,
  readTranslations?: (input: { dsl: string; workspaceId?: string; locale: string }) => Promise<{
    translations: ModelTranslations;
  }>
): Promise<string> => {
  // Export the captured editor source, independently of the debounced canvas model.
  const parsed = parseMedol(input.dsl);
  if (parsed.diagnostics.length) throw new Error(parsed.diagnostics.join('\n'));
  let draft = await withCodegenProvenance(modelToCodegenModel(parsed), input.dsl, {
    workspaceId: input.workspaceId
  });
  if (input.workspaceId) {
    try {
      const exported = await readRemote({
        workspaceId: input.workspaceId,
        locale: input.locale === 'en' ? undefined : input.locale
      });
      if (JSON.parse(exported).metadata?.source?.sha256 === draft.metadata?.source.sha256) return exported;
    } catch {
      // A valid local draft remains exportable when the workspace server is unavailable.
    }
  }
  if (input.locale !== 'en' && readTranslations) {
    try {
      const resolved = await readTranslations(input);
      draft = withCodegenTranslations(draft, input.locale, resolved.translations);
    } catch {
      // Offline exports retain source labels when stored translations cannot be read.
    }
  }
  return JSON.stringify(draft, null, 2);
};
