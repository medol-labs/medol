export type EmElementKind =
  | 'screen'
  | 'command'
  | 'event'
  | 'projection'
  | 'automation'
  | 'policy'
  | 'gwt'
  | 'aggregate'
  | 'actor'
  | 'hotspot'
  | 'integration'
  | 'transition';

export interface EmField {
  name: string;
  type: string;
  cardinality?: 'Single' | 'List' | 'Optional';
  attributes: string[];
}

export interface EmElement {
  id: string;
  kind: EmElementKind;
  name: string;
  fields: EmField[];
  sliceId?: string;
  aggregateId?: string;
  metadata?: Record<string, string>;
}

export interface EmSlice {
  id: string;
  name: string;
  aggregateId?: string;
  createsAggregate?: boolean;
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
}

export interface EmEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface EmModel {
  contexts: EmContext[];
  edges: EmEdge[];
  diagnostics: string[];
}

export const emptyModel = (): EmModel => ({
  contexts: [],
  edges: [],
  diagnostics: []
});
