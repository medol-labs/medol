import { createFileRoute } from '@tanstack/react-router';
import { hashMedolSource } from '../../../features/documentation/documentReferences';
import {
  buildModelTranslationCatalog,
  withCodegenTranslations,
  type ModelTranslations
} from '../../../features/model-i18n/modelTranslation';
import { modelToCodegenModel, type CodegenModel } from '../../../lib/codegenModel';
import { parseMedol } from '../../../lib/dslParser';
import { readResolvedModelTranslations } from '../../../server/modelTranslationResolver';
import {
  listModelingWorkspaces,
  readModelingWorkspace,
  readModelingWorkspaceVersion
} from '../../../server/modelingWorkspaceRepository';

export const Route = createFileRoute('/api/modeling/codegen-model')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url);
        const workspaceId = url.searchParams.get('workspaceId')?.trim();
        const versionId = url.searchParams.get('versionId')?.trim();
        const locale = url.searchParams.get('locale') ?? url.searchParams.get('language');
        if (versionId && !workspaceId) {
          return Response.json({
            error: 'workspaceId is required when versionId is provided'
          }, { status: 400 });
        }

        const workspace = workspaceId
          ? readModelingWorkspace(workspaceId)
          : readLatestWorkspace();

        if (!workspace) {
          return Response.json({
            error: workspaceId ? 'workspace not found' : 'no workspaces found'
          }, { status: 404 });
        }

        const version = versionId
          ? readModelingWorkspaceVersion(workspace.id, versionId)
          : undefined;
        if (versionId && !version) {
          return Response.json({ error: 'workspace version not found' }, { status: 404 });
        }

        const dsl = version?.dsl ?? workspace.dsl;
        const model = parseMedol(dsl);
        if (model.diagnostics.length > 0) {
          return Response.json({
            error: 'MEDOL validation failed',
            diagnostics: model.diagnostics
          }, { status: 400 });
        }

        const sourceHash = hashMedolSource(dsl);
        let codegenModel = modelToCodegenModel(model);
        if (locale) {
          const translations = readCurrentCodegenTranslations({
            codegenModel,
            workspaceId: workspace.id,
            sourceHash,
            locale
          });
          codegenModel = withCodegenTranslations(codegenModel, locale, translations);
        }

        return new Response(JSON.stringify(codegenModel, null, 2), {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': contentDisposition(codegenModelFilename(locale)),
            'X-Medol-Workspace-Id': workspace.id,
            'X-Medol-Workspace-Name': encodeURIComponent(workspace.name),
            ...(version ? {
              'X-Medol-Version-Id': version.id,
              'X-Medol-Version-No': String(version.versionNo),
              'X-Medol-Model-Hash': version.modelHash
            } : {}),
            'X-Medol-Source-Hash': sourceHash,
            ...(locale ? { 'X-Medol-Locale': locale } : {})
          }
        });
      }
    }
  }
});

const readLatestWorkspace = () => {
  const latest = listModelingWorkspaces()[0];
  return latest ? readModelingWorkspace(latest.id) : undefined;
};

const readCurrentCodegenTranslations = (input: {
  codegenModel: CodegenModel;
  workspaceId?: string;
  sourceHash: string;
  locale: string;
}): ModelTranslations => {
  const catalog = buildModelTranslationCatalog(input.codegenModel);
  return readResolvedModelTranslations(input, catalog.sourceTexts).translations;
};

const contentDisposition = (filename: string): string => {
  const fallback = filename.replace(/[^\w.-]+/g, '-');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
};

const codegenModelFilename = (locale: string | null): string =>
  locale ? `codegen-model.${locale}.json` : 'codegen-model.json';
