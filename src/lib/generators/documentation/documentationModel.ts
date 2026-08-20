import type { EmElementKind } from '../../model';

export type DocumentationKind =
  | 'prd'
  | 'software-design'
  | 'database-design'
  | 'process'
  | 'test-outline';

export type DocumentationLanguage = 'en' | 'zh-CN';

export interface DocumentationBundle {
  title: string;
  generatedAt: string;
  domains: string[];
  contexts: DocumentationContext[];
  workflows: DocumentationWorkflow[];
  readmodels: DocumentationReadModel[];
  integrations: DocumentationIntegration[];
  deployments: DocumentationDeployment[];
  diagnostics: string[];
}

export interface DocumentationContext {
  id: string;
  name: string;
  domain?: string;
  notes: string[];
  risks: string[];
  decisions: string[];
  metrics: string[];
  aggregates: Array<{
    id: string;
    name: string;
    type: 'aggregate' | 'concept';
    states: string[];
    sliceNames: string[];
  }>;
  valueTypes: DocumentationValueType[];
  externalSystems: DocumentationExternalSystem[];
}

export interface DocumentationWorkflow {
  id: string;
  context: string;
  aggregate: string;
  slice: string;
  actor?: string;
  ui?: {
    name: string;
    type?: string;
  };
  commands: DocumentationElement[];
  events: DocumentationElement[];
  readmodels: string[];
  processors: string[];
  specifications: DocumentationSpecification[];
  startsLifecycle: boolean;
  resultingState?: string;
  hotspots: string[];
}

export interface DocumentationElement {
  id: string;
  name: string;
  kind: EmElementKind;
  fields: DocumentationField[];
}

export interface DocumentationField {
  name: string;
  type: string;
  cardinality: string;
  attributes: string[];
  example?: string;
  mapping?: {
    kind: 'from' | 'derived';
    sources: string[];
    rule?: string;
  };
}

export interface DocumentationSpecification {
  name: string;
  specification?: string;
  rule?: string;
  expressions: string[];
  validates: string[];
  given: string[];
  when?: string;
  then?: string;
  reject?: string;
  error?: string;
  examples: Record<string, string>;
}

export interface DocumentationReadModel {
  id: string;
  sliceId: string;
  name: string;
  context: string;
  aggregate: string;
  slice: string;
  collection: boolean;
  fields: DocumentationField[];
  sourceEvents: string[];
  queryFields: string[];
  identifierFields: string[];
}

export interface DocumentationIntegration {
  id: string;
  name: string;
  context: string;
  source?: string;
  target?: string;
}

export interface DocumentationDeployment {
  id: string;
  name: string;
  domain?: string;
  contexts: string[];
}

export interface DocumentationValueType {
  id: string;
  name: string;
  kind: 'scalar' | 'enum' | 'object';
  baseType: string;
  values: string[];
  fields: DocumentationField[];
}

export interface DocumentationExternalSystem {
  id: string;
  name: string;
  context: string;
  kind?: string;
  protocol?: string;
  capabilities: Array<{
    type: 'command' | 'event';
    name: string;
  }>;
}

export interface GeneratedDocumentation {
  kind: DocumentationKind;
  language: DocumentationLanguage;
  title: string;
  markdown: string;
  bundle: DocumentationBundle;
}
