export type EmElementKind =
  | 'screen'
  | 'command'
  | 'event'
  | 'readmodel'
  | 'automation'
  | 'policy'
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
  kind: 'scalar' | 'enum' | 'object';
  baseType: string;
  constraints: EmValueTypeConstraint[];
  values: string[];
  fields: EmField[];
}

export interface EmAggregate {
  id: string;
  name: string;
  states: string[];
  slices: EmSlice[];
}

export interface EmContext {
  id: string;
  name: string;
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
  contexts: EmContext[];
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
  contexts: EmContext[];
  edges: EmEdge[];
  diagnostics: string[];
  diagnosticDetails: MedolDiagnostic[];
}

export const emptyModel = (): EmModel => ({
  domains: [],
  contexts: [],
  edges: [],
  diagnostics: [],
  diagnosticDetails: []
});
