import type { EmElementKind } from '../../model';

export interface PrdDocument {
  id: string;
  title: string;
  domain?: string;
  context: string;
  overview: string;
  notes: string[];
  actors: PrdActor[];
  aggregates: PrdAggregate[];
  slices: PrdSlice[];
  dataDictionary: PrdDataDictionaryItem[];
  automations: PrdAutomation[];
  risks: string[];
  decisions: string[];
  metrics: string[];
  openQuestions: string[];
}

export interface PrdActor {
  id: string;
  name: string;
  sourceRefs: string[];
}

export interface PrdAggregate {
  id: string;
  name: string;
  states: string[];
  sourceRefs: string[];
}

export interface PrdSlice {
  id: string;
  name: string;
  context: string;
  aggregate: string;
  actor?: string;
  ui?: string;
  uiType?: string;
  operation: 'create' | 'read' | 'update' | 'delete' | 'action' | 'automation';
  command?: PrdElementSummary;
  event?: PrdElementSummary;
  projectionNames: string[];
  resultingState?: string;
  createsAggregate: boolean;
  businessRules: string[];
  specifications: PrdSpecification[];
  dependencies: string[];
  hotspots: string[];
  sourceRefs: string[];
}

export interface PrdSpecification {
  name: string;
  given: string[];
  when?: string;
  then?: string;
  examples: Record<string, string>;
}

export interface PrdElementSummary {
  id: string;
  kind: EmElementKind;
  name: string;
  fields: PrdField[];
}

export interface PrdField {
  name: string;
  type: string;
  cardinality: string;
  attributes: string[];
  example?: string;
  mapping?: string;
}

export interface PrdDataDictionaryItem extends PrdField {
  owner: string;
  ownerKind: EmElementKind;
  sourceRef: string;
}

export interface PrdAutomation {
  id: string;
  name: string;
  kind: EmElementKind;
  sourceRefs: string[];
  metadata: Record<string, string>;
}

export interface PrdGenerationResult {
  document: PrdDocument;
  trace: PrdTrace;
}

export interface PrdTrace {
  documentId: string;
  dslHash: string;
  generatedAt: string;
  generator: {
    id: string;
    version: string;
  };
  sections: PrdTraceSection[];
}

export interface PrdTraceSection {
  sectionId: string;
  title: string;
  kind: string;
  sourceRefs: PrdSourceRef[];
  generatedBlocks: PrdGeneratedBlock[];
}

export interface PrdSourceRef {
  dslId: string;
  kind: string;
  name: string;
  path: string[];
}

export interface PrdGeneratedBlock {
  blockId: string;
  source: 'dsl' | 'generator' | 'ai';
  sourceRefs: string[];
  promptHash?: string;
  model?: string;
}
