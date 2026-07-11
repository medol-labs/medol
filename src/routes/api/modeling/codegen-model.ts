import { createFileRoute } from '@tanstack/react-router';
import { hashMedolSource } from '../../../features/documentation/documentReferences';
import { withCodegenTranslations } from '../../../features/model-i18n/modelTranslation';
import { modelToCodegenModel } from '../../../lib/codegenModel';
import { parseMedol } from '../../../lib/dslParser';
import { readModelTranslations } from '../../../server/modelTranslationRepository';
import {
  listModelingWorkspaces,
  readModelingWorkspace
} from '../../../server/modelingWorkspaceRepository';

export const Route = createFileRoute('/api/modeling/codegen-model')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url);
        const workspaceId = url.searchParams.get('workspaceId')?.trim();
        const locale = url.searchParams.get('locale') ?? url.searchParams.get('language');
        const workspace = workspaceId
          ? readModelingWorkspace(workspaceId)
          : readLatestWorkspace();

        if (!workspace) {
          return Response.json({
            error: workspaceId ? 'workspace not found' : 'no workspaces found'
          }, { status: 404 });
        }

        const model = parseMedol(workspace.dsl);
        if (model.diagnostics.length > 0) {
          return Response.json({
            error: 'MEDOL validation failed',
            diagnostics: model.diagnostics
          }, { status: 400 });
        }

        let codegenModel = modelToCodegenModel(model);
        if (locale) {
          const translations = readModelTranslations({
            workspaceId: workspace.id,
            sourceHash: hashMedolSource(workspace.dsl),
            locale
          });
          codegenModel = withCodegenTranslations(codegenModel, locale, translations);
        }

        return new Response(JSON.stringify(codegenModel, null, 2), {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': contentDisposition('codegen-model.json'),
            'X-Medol-Workspace-Id': workspace.id,
            'X-Medol-Workspace-Name': encodeURIComponent(workspace.name),
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

const contentDisposition = (filename: string): string => {
  const fallback = filename.replace(/[^\w.-]+/g, '-');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
};
