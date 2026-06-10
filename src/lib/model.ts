export type EmElementKind =
  | 'screen'
  | 'command'
  | 'event'
  | 'error'
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
  cardinality?: 'Single' | 'List' | 'Optional';
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
  createsAggregate?: boolean;
  resultingState?: string;
  hotspots: string[];
  elements: EmElement[];
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
  aggregates: EmAggregate[];
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

export interface EmModel {
  domains: EmDomain[];
  contexts: EmContext[];
  edges: EmEdge[];
  diagnostics: string[];
}

export const emptyModel = (): EmModel => ({
  domains: [],
  contexts: [],
  edges: [],
  diagnostics: []
});
