import { flattenElements } from '../../dslParser';
import type { EmElement, EmField, EmModel, EmSlice } from '../../model';
import { humanize } from '../../name';
import { generatePrd } from '../prd/prdGenerator';
import { renderPrdMarkdown } from '../prd/prdMarkdownRenderer';
import type {
  DocumentationBundle,
  DocumentationField,
  DocumentationKind,
  DocumentationLanguage,
  DocumentationValueType,
  DocumentationReadModel,
  DocumentationSpecification,
  GeneratedDocumentation
} from './documentationModel';
import {
  renderDatabaseDesignMarkdown,
  renderInstallationManualMarkdown,
  renderProcessMarkdown,
  renderSoftwareDesignMarkdown,
  renderTestOutlineMarkdown,
  renderUserJourneyMarkdown,
  renderUserManualMarkdown
} from './documentationMarkdownRenderer';
import { numberMarkdownHeadings } from './documentHeadingNumbering';
import { insertMarkdownTableOfContentsAfterTitle } from './documentTableOfContents';
import { localizeDocumentationMarkdown } from './documentationLocalization';
import { coveredSpecificationExpressions } from '../../specificationCoverage';

export interface GenerateDocumentationOptions {
  generatedAt?: string;
  sourceText?: string;
  language?: DocumentationLanguage;
}

export const generateDocumentation = (
  model: EmModel,
  kind: DocumentationKind,
  options: GenerateDocumentationOptions = {}
): GeneratedDocumentation => {
  const language = options.language ?? 'en';
  const bundle = buildDocumentationBundle(model, options.generatedAt);
  const title = documentTitle(bundle.title, kind, language);
  const baseMarkdown = kind === 'prd'
    ? renderPrdMarkdown(generatePrd(model, { ...options, generatedAt: bundle.generatedAt }).document, language)
    : kind === 'software-design'
      ? renderSoftwareDesignMarkdown(bundle, language)
      : kind === 'database-design'
        ? renderDatabaseDesignMarkdown(bundle, language)
        : kind === 'test-outline'
          ? renderTestOutlineMarkdown(bundle, language)
          : kind === 'user-journey'
            ? renderUserJourneyMarkdown(bundle, language)
            : kind === 'installation-manual'
              ? renderInstallationManualMarkdown(bundle, language)
              : kind === 'user-manual'
                ? renderUserManualMarkdown(bundle, language)
                : renderProcessMarkdown(bundle, language);
  const localizedMarkdown = language === 'zh-CN' && kind === 'process'
    ? localizeDocumentationMarkdown(baseMarkdown, kind)
    : baseMarkdown;
  const numberedMarkdown = numberMarkdownHeadings(localizedMarkdown, language);
  const markdown = kind === 'prd'
    ? insertMarkdownTableOfContentsAfterTitle(numberedMarkdown, language)
    : numberedMarkdown;

  return { kind, language, title, markdown, bundle };
};

export const generateDocumentationBundle = (
  model: EmModel,
  options: GenerateDocumentationOptions = {}
): Record<DocumentationKind, GeneratedDocumentation> => ({
  prd: generateDocumentation(model, 'prd', options),
  'software-design': generateDocumentation(model, 'software-design', options),
  'database-design': generateDocumentation(model, 'database-design', options),
  process: generateDocumentation(model, 'process', options),
  'test-outline': generateDocumentation(model, 'test-outline', options),
  'user-journey': generateDocumentation(model, 'user-journey', options),
  'installation-manual': generateDocumentation(model, 'installation-manual', options),
  'user-manual': generateDocumentation(model, 'user-manual', options)
});

export const buildDocumentationBundle = (
  model: EmModel,
  generatedAt = new Date().toISOString()
): DocumentationBundle => {
  const elements = flattenElements(model);
  const elementsById = new Map(elements.map((element) => [element.id, element]));
  const domainsByContextId = new Map(
    model.domains.flatMap((domain) =>
      domain.contexts.map((context) => [context.id, domain.name] as const)
    )
  );

  const contexts = model.contexts.map((context) => ({
    id: context.id,
    name: context.name,
    ...(domainsByContextId.get(context.id)
      ? { domain: domainsByContextId.get(context.id) }
      : {}),
    notes: context.notes,
    risks: context.risks,
    decisions: context.decisions,
    metrics: context.metrics,
    aggregates: [
      ...context.aggregates.map((aggregate) => ({
        id: aggregate.id,
        name: aggregate.name,
        type: 'aggregate' as const,
        states: aggregate.states,
        sliceNames: aggregate.slices.map((slice) => slice.name)
      })),
      ...context.concepts.map((concept) => ({
        id: concept.id,
        name: concept.name,
        type: 'concept' as const,
        states: concept.states,
        sliceNames: concept.sliceNames
      }))
    ],
    valueTypes: context.valueTypes.map(toDocumentationValueType),
    externalSystems: (context.externalSystems ?? []).map((system) => ({
      id: system.id,
      name: system.name,
      context: context.name,
      ...(system.kind ? { kind: system.kind } : {}),
      ...(system.protocol ? { protocol: system.protocol } : {}),
      capabilities: system.capabilities
    }))
  }));

  const workflows = model.contexts.flatMap((context) =>
    [
      ...context.aggregates.flatMap((aggregate) =>
        aggregate.slices.map((slice) => toWorkflow(context.name, aggregate.name, slice))
      ),
      ...context.slices.map((slice) => toWorkflow(
        context.name,
        context.concepts.filter((concept) => concept.sliceIds.includes(slice.id)).map((concept) => concept.name).join(', ') || 'Context',
        slice
      ))
    ]
  );

  function toWorkflow(contextName: string, owner: string, slice: EmSlice) {
        const actor = slice.elements.find((element) => element.kind === 'actor');
        const screen = slice.elements.find((element) => element.kind === 'screen');
        return {
          id: slice.id,
          context: contextName,
          aggregate: owner,
          slice: slice.name,
          ...(actor ? { actor: actor.name } : {}),
          ...(screen
            ? {
                ui: {
                  name: screen.name,
                  ...(screen.ui?.type ? { type: screen.ui.type } : {})
                }
              }
            : {}),
          commands: slice.elements.filter(isKind('command')).map(toDocumentationElement),
          events: slice.elements.filter(isKind('event')).map(toDocumentationElement),
          readmodels: slice.elements.filter(isKind('readmodel')).map((element) => element.name),
          processors: slice.elements
            .filter((element) => element.kind === 'automation')
            .map((element) => element.name),
          specifications: slice.elements
            .filter(isKind('gwt'))
            .map(toDocumentationSpecification),
          startsLifecycle: Boolean(slice.startsLifecycle),
          ...(slice.resultingState ? { resultingState: slice.resultingState } : {}),
          hotspots: slice.hotspots
        };
  }

  const readmodels = model.contexts.flatMap((context) =>
    [
      ...context.aggregates.flatMap((aggregate) =>
        aggregate.slices.flatMap((slice) =>
          toDocumentationReadModels(context.name, aggregate.name, slice)
        )
      ),
      ...context.slices.flatMap((slice) =>
        toDocumentationReadModels(
          context.name,
          context.concepts.filter((concept) => concept.sliceIds.includes(slice.id)).map((concept) => concept.name).join(', ') || 'Context',
          slice
        )
      )
    ]
  );

  function toDocumentationReadModels(contextName: string, owner: string, slice: EmSlice): DocumentationReadModel[] {
    return slice.elements
      .filter(isKind('readmodel'))
      .map<DocumentationReadModel>((readmodel) => ({
            id: readmodel.id,
            sliceId: slice.id,
            name: readmodel.name,
            context: contextName,
            aggregate: owner,
            slice: slice.name,
            collection: Boolean(readmodel.listElement),
            fields: readmodel.fields.map(toDocumentationField),
            sourceEvents: model.edges
              .filter((edge) => edge.target === readmodel.id && edge.label === 'updates')
              .map((edge) => elementsById.get(edge.source)?.name)
              .filter((name): name is string => Boolean(name)),
            queryFields: readmodel.fields
              .filter((field) => field.attributes.includes('query'))
              .map((field) => field.name),
            identifierFields: readmodel.fields
              .filter((field) => field.attributes.includes('id'))
              .map((field) => field.name)
          }));
  }

  const integrations = model.contexts.flatMap((context) =>
    (context.looseElements ?? [])
      .filter(isKind('integration'))
      .map((integration) => ({
        id: integration.id,
        name: integration.name,
        context: context.name,
        ...(integration.fields.find((field) => field.name === 'source')?.type
          ? { source: integration.fields.find((field) => field.name === 'source')?.type }
          : {}),
        ...(integration.fields.find((field) => field.name === 'target')?.type
          ? { target: integration.fields.find((field) => field.name === 'target')?.type }
          : {})
      }))
  );

  const titleSource = model.domains.length === 1
    ? model.domains[0].name
    : model.domains.length > 1
      ? 'Event Modeling Workspace'
      : model.contexts[0]?.name ?? 'Event Modeling Workspace';

  const deployments = uniqueById([
    ...(model.deployments ?? []),
    ...model.domains.flatMap((domain) => domain.deployments ?? [])
  ]);
  const frontendApplications = uniqueById([
    ...(model.frontendApplications ?? []),
    ...model.domains.flatMap((domain) => domain.frontendApplications ?? [])
  ]);

  return {
    title: humanize(titleSource),
    generatedAt,
    domains: model.domains.map((domain) => domain.name),
    contexts,
    workflows,
    readmodels,
    integrations,
    deployments: deployments.map((deployment) => ({
      id: deployment.id,
      name: deployment.name,
      ...(deployment.domain ? { domain: deployment.domain } : {}),
      contexts: deployment.contexts
    })),
    frontendApplications: frontendApplications.map((application) => ({
      id: application.id,
      name: application.name,
      ...(application.domain ? { domain: application.domain } : {}),
      includes: application.includes
    })),
    diagnostics: model.diagnostics
  };
};

const uniqueById = <TItem extends { id: string }>(items: TItem[]): TItem[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

const toDocumentationElement = (element: EmElement) => ({
  id: element.id,
  name: element.name,
  kind: element.kind,
  fields: element.fields.map(toDocumentationField)
});

const toDocumentationField = (field: EmField): DocumentationField => ({
  name: field.name,
  type: field.type,
  cardinality: field.cardinality ?? 'Single',
  attributes: field.attributes,
  ...(field.example ? { example: field.example } : {}),
  ...(field.mapping
    ? {
        mapping: {
          kind: field.mapping.kind,
          sources: field.mapping.sources,
          ...(field.mapping.rule ? { rule: field.mapping.rule } : {})
        }
      }
    : {})
});

const toDocumentationValueType = (valueType: {
  id: string;
  name: string;
  kind: DocumentationValueType['kind'];
  baseType: string;
  values: string[];
  fields: EmField[];
}): DocumentationValueType => ({
  id: valueType.id,
  name: valueType.name,
  kind: valueType.kind,
  baseType: valueType.baseType,
  values: valueType.values,
  fields: valueType.fields.map(toDocumentationField)
});

const toDocumentationSpecification = (element: EmElement): DocumentationSpecification => {
  const metadata = element.metadata ?? {};
  const expressions = Object.entries(metadata)
    .filter(([key]) => /^expression\d+$/.test(key))
    .sort(([left], [right]) => Number(left.slice(10)) - Number(right.slice(10)))
    .map(([, expression]) => expression);
  return {
    name: element.name,
    ...(metadata.specification ? { specification: metadata.specification } : {}),
    ...(metadata.rule ? { rule: metadata.rule } : {}),
    expressions,
    validates: coveredSpecificationExpressions({ expressions, metadata }),
    given: Object.entries(metadata)
      .filter(([key]) => /^given\d+$/.test(key))
      .sort(([left], [right]) => Number(left.slice(5)) - Number(right.slice(5)))
      .map(([, value]) => value),
    ...(metadata.when ? { when: metadata.when } : {}),
    ...(metadata.then ? { then: metadata.then } : {}),
    ...(metadata.thenReject ? { reject: metadata.thenReject } : {}),
    ...(metadata.thenError ? { error: metadata.thenError } : {}),
    examples: Object.fromEntries(
      Object.entries(metadata)
        .filter(([key]) => key.startsWith('example:'))
        .map(([key, value]) => [key.slice('example:'.length), value])
    )
  };
};

const isKind = <TKind extends EmElement['kind']>(kind: TKind) =>
  (element: EmElement): element is EmElement & { kind: TKind } => element.kind === kind;

const documentTitle = (
  title: string,
  kind: DocumentationKind,
  language: DocumentationLanguage
): string => {
  if (language === 'zh-CN') {
    if (kind === 'prd') return `${title} 产品需求文档`;
    if (kind === 'software-design') return `${title} 软件设计`;
    if (kind === 'database-design') return `${title} 数据库设计`;
    if (kind === 'test-outline') return `${title} 测试大纲`;
    if (kind === 'user-journey') return `${title} 用户旅程总结`;
    if (kind === 'installation-manual') return `${title} 安装部署手册`;
    if (kind === 'user-manual') return `${title} 使用手册`;
    return `${title} 业务流程`;
  }
  if (kind === 'prd') return `${title} Product Requirements and Acceptance`;
  if (kind === 'software-design') return `${title} Software Design`;
  if (kind === 'database-design') return `${title} Database Design`;
  if (kind === 'test-outline') return `${title} Test Outline`;
  if (kind === 'user-journey') return `${title} User Journey Summary`;
  if (kind === 'installation-manual') return `${title} Installation And Deployment Guide`;
  if (kind === 'user-manual') return `${title} User Manual`;
  return `${title} Business Process`;
};
