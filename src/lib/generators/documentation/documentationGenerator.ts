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
  DocumentationReadModel,
  DocumentationSpecification,
  GeneratedDocumentation
} from './documentationModel';
import {
  renderDatabaseDesignMarkdown,
  renderProcessMarkdown,
  renderSoftwareDesignMarkdown
} from './documentationMarkdownRenderer';
import { localizeDocumentationMarkdown } from './documentationLocalization';

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
    ? renderPrdMarkdown(generatePrd(model, options).document, language)
    : kind === 'software-design'
      ? renderSoftwareDesignMarkdown(bundle)
      : kind === 'database-design'
        ? renderDatabaseDesignMarkdown(bundle)
        : renderProcessMarkdown(bundle);
  const markdown = language === 'zh-CN' && kind !== 'prd'
    ? localizeDocumentationMarkdown(baseMarkdown, kind)
    : baseMarkdown;

  return { kind, language, title, markdown, bundle };
};

export const generateDocumentationBundle = (
  model: EmModel,
  options: GenerateDocumentationOptions = {}
): Record<DocumentationKind, GeneratedDocumentation> => ({
  prd: generateDocumentation(model, 'prd', options),
  'software-design': generateDocumentation(model, 'software-design', options),
  'database-design': generateDocumentation(model, 'database-design', options),
  process: generateDocumentation(model, 'process', options)
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
    aggregates: context.aggregates.map((aggregate) => ({
      id: aggregate.id,
      name: aggregate.name,
      states: aggregate.states,
      sliceNames: aggregate.slices.map((slice) => slice.name)
    }))
  }));

  const workflows = model.contexts.flatMap((context) =>
    [
      ...context.aggregates.flatMap((aggregate) =>
        aggregate.slices.map((slice) => toWorkflow(context.name, aggregate.name, slice))
      ),
      ...context.slices.map((slice) => toWorkflow(
        context.name,
        context.constraints.filter((constraint) => constraint.sliceIds.includes(slice.id)).map((constraint) => `Constraint:${constraint.name}`).join(', ') || 'Context',
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
            .filter((element) => element.kind === 'automation' || element.kind === 'policy')
            .map((element) => element.name),
          specifications: slice.elements
            .filter(isKind('gwt'))
            .map(toDocumentationSpecification),
          createsAggregate: Boolean(slice.createsAggregate),
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
          context.constraints.filter((constraint) => constraint.sliceIds.includes(slice.id)).map((constraint) => `Constraint:${constraint.name}`).join(', ') || 'Context',
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
    context.looseElements
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

  return {
    title: humanize(titleSource),
    generatedAt,
    domains: model.domains.map((domain) => domain.name),
    contexts,
    workflows,
    readmodels,
    integrations,
    diagnostics: model.diagnostics
  };
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

const toDocumentationSpecification = (element: EmElement): DocumentationSpecification => {
  const metadata = element.metadata ?? {};
  return {
    name: element.name,
    given: Object.entries(metadata)
      .filter(([key]) => /^given\d+$/.test(key))
      .sort(([left], [right]) => Number(left.slice(5)) - Number(right.slice(5)))
      .map(([, value]) => value),
    ...(metadata.when ? { when: metadata.when } : {}),
    ...(metadata.then ? { then: metadata.then } : {}),
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
    if (kind === 'prd') return `${title} 产品需求与验收文档`;
    if (kind === 'software-design') return `${title} 软件设计`;
    if (kind === 'database-design') return `${title} 数据库设计`;
    return `${title} 业务流程`;
  }
  if (kind === 'prd') return `${title} Product Requirements and Acceptance`;
  if (kind === 'software-design') return `${title} Software Design`;
  if (kind === 'database-design') return `${title} Database Design`;
  return `${title} Business Process`;
};
