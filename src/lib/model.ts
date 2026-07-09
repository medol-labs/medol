export type EmElementKind =
  | 'screen'
  | 'command'
  | 'event'
  | 'readmodel'
  | 'automation'
  | 'gwt'
  | 'aggregate'
  | 'actor'
  | 'hotspot'
  | 'integration';

export interface EmField {
  name: string;
  type: string;
  cardinality?: 'Single' | 'List' | 'Optional' | 'OptionalList';
  attributes: string[];
  sourceRange?: MedolSourceRange;
  example?: string;
  mapping?: EmFieldMapping;
}

export interface EmFieldMapping {
  kind: 'from' | 'derived';
  sources: string[];
  rule?: string;
}

export interface EmElement {
  id: string;
  kind: EmElementKind;
  name: string;
  fields: EmField[];
  listElement?: boolean;
  sliceId?: string;
  aggregateId?: string;
  sourceRange?: MedolSourceRange;
  metadata?: Record<string, string>;
  ui?: EmUi;
}

export type EmUiType =
  | 'list'
  | 'detail'
  | 'form'
  | 'dialog'
  | 'drawer'
  | 'confirm'
  | 'wizard'
  | 'inline'
  | 'background';

export interface EmUi {
  type?: EmUiType;
}

export interface EmSlice {
  id: string;
  name: string;
  aggregateId?: string;
  sourceRange?: MedolSourceRange;
  startsLifecycle?: boolean;
  resultingState?: string;
  tags: EmSliceTag[];
  hotspots: string[];
  elements: EmElement[];
}

export interface EmSliceTag {
  name: string;
  expression?: string;
}

export interface EmConcept {
  id: string;
  name: string;
  sourceRange?: MedolSourceRange;
  states: string[];
  sliceNames: string[];
  sliceIds: string[];
}

export type EmValueTypeConstraint =
  | { kind: 'format'; format: string }
  | { kind: 'length'; min: number; max: number }
  | { kind: 'range'; min: number; max: number }
  | { kind: 'matches'; pattern: string }
  | { kind: 'oneOf'; values: Array<string | number | boolean | null> };

export interface EmValueType {
  id: string;
  name: string;
  sourceRange?: MedolSourceRange;
  kind: 'scalar' | 'enum' | 'object';
  baseType: string;
  constraints: EmValueTypeConstraint[];
  values: string[];
  fields: EmField[];
}

export interface EmAggregate {
  id: string;
  name: string;
  sourceRange?: MedolSourceRange;
  states: string[];
  slices: EmSlice[];
}

export interface EmContext {
  id: string;
  name: string;
  sourceRange?: MedolSourceRange;
  valueTypes: EmValueType[];
  aggregates: EmAggregate[];
  slices: EmSlice[];
  concepts: EmConcept[];
  looseElements: EmElement[];
  notes: string[];
  risks: string[];
  decisions: string[];
  metrics: string[];
}

export interface EmDomain {
  id: string;
  name: string;
  sourceRange?: MedolSourceRange;
  contexts: EmContext[];
  deployments: EmDeployment[];
}

export interface EmDeployment {
  id: string;
  name: string;
  domain?: string;
  sourceRange?: MedolSourceRange;
  contexts: string[];
}

export interface EmEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface MedolSourcePosition {
  line: number;
  column: number;
}

export interface MedolSourceRange {
  start: MedolSourcePosition;
  end: MedolSourcePosition;
}

export interface MedolDiagnostic {
  message: string;
  sourceName?: string;
  range?: MedolSourceRange;
}

export interface EmModel {
  domains: EmDomain[];
  deployments: EmDeployment[];
  contexts: EmContext[];
  edges: EmEdge[];
  diagnostics: string[];
  diagnosticDetails: MedolDiagnostic[];
}

export const emptyModel = (): EmModel => ({
  domains: [],
  deployments: [],
  contexts: [],
  edges: [],
  diagnostics: [],
  diagnosticDetails: []
});
