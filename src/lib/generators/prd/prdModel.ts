import type { EmElementKind, EmFieldMapping } from '../../model';

export interface PrdDocument {
  id: string;
  title: string;
  generatedAt: string;
  domain?: string;
  context: string;
  overview: string;
  notes: string[];
  actors: PrdActor[];
  aggregates: PrdAggregate[];
  slices: PrdSlice[];
  useCases: PrdUseCase[];
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
  type?: 'aggregate' | 'concept';
  context?: string;
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
  readModelNames: string[];
  resultingState?: string;
  startsLifecycle: boolean;
  businessRules: string[];
  specifications: PrdSpecification[];
  dependencies: string[];
  hotspots: string[];
  sourceRefs: string[];
}

export interface PrdSpecification {
  sourceRef: string;
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

export interface PrdUseCase {
  id: string;
  sliceId: string;
  name: string;
  actor?: PrdUseCaseFact;
  initiation: 'user' | 'automation' | 'unspecified';
  trigger: PrdUseCaseFact;
  inputs: PrdUseCaseInput[];
  businessRules: PrdUseCaseFact[];
  preconditions: PrdUseCaseFact[];
  mainFlow: PrdUseCaseFact[];
  alternateFlows: PrdUseCaseAlternateFlow[];
  outcomes: PrdUseCaseFact[];
  openQuestions: string[];
  sourceRefs: string[];
}

export interface PrdUseCaseFact {
  kind: 'actor' | 'command' | 'triggerEvent' | 'event' | 'state' | 'readmodel' | 'condition' | 'rejection' | 'error';
  text: string;
  sourceRefs: string[];
}

export interface PrdUseCaseInput {
  name: string;
  type: string;
  required: boolean;
  origin: 'user' | 'generated' | 'derived' | 'event' | 'technical';
  sourceRefs: string[];
}

export interface PrdUseCaseAlternateFlow {
  name: string;
  scenarioContext: PrdUseCaseFact[];
  conditions: PrdUseCaseFact[];
  rule?: PrdUseCaseFact;
  outcome: PrdUseCaseFact;
  sourceRefs: string[];
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
  mapping?: EmFieldMapping;
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
