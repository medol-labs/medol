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
  dictionary?: string;
  mapping?: EmFieldMapping;
}

export interface EmFieldMapping {
  kind: 'from' | 'derived';
  sources: string[];
  rule?: string;
  lookup?: EmDerivedLookup;
}

export interface EmDerivedLookup {
  key?: string;
  keys?: string[];
  sourceEvent?: string;
  sourceField?: string;
  targetField?: string;
  cacheProjection?: string;
  cacheStrategy?: string;
  missingValuePolicy?: string;
}

export interface EmElement {
  id: string;
  kind: EmElementKind;
  name: string;
  fields: EmField[];
  resultFields?: EmField[];
  clientEffect?: EmClientEffect;
  listElement?: boolean;
  todo?: boolean;
  sync?: boolean;
  syncSource?: string;
  syncFilters?: EmSyncFilter[];
  eligibility?: EmEligibility[];
  accessPolicy?: string;
  sliceId?: string;
  aggregateId?: string;
  sourceRange?: MedolSourceRange;
  metadata?: Record<string, string>;
  ui?: EmUi;
  dictionaryProvider?: EmDictionaryProvider;
  exportable?: EmExportable;
  importable?: EmImportable;
  notifiable?: EmNotifiable;
}

export interface EmAccessPolicy {
  id: string;
  name: string;
  domain?: string;
  sourceRange?: MedolSourceRange;
  rules: EmAccessPolicyRule[];
}

export type EmAccessPolicyRule =
  | { kind: 'fields'; fields: string[] };

export interface EmSyncFilter {
  target: string;
  source: string;
}

export interface EmEligibility {
  profile?: string;
  operator: 'AND';
  conditions: EmEligibilityCondition[];
}

export interface EmEligibilityCondition {
  left: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  right: string | number | boolean | null;
  rightReference?: string;
}

export interface EmDictionaryProvider {
  name: string;
  code?: string;
  value?: string;
  label?: string;
  active?: string;
  state?: string;
  order?: string;
}

export interface EmExportable {
  capability?: string;
}

export interface EmImportable {
  capability?: string;
}

export interface EmNotifiable {
  capability?: string;
}

export interface EmCapabilityExtension {
  // Set by the builtin source loader, never inferred from context or provider names.
  builtinDefault?: true;
  target: string;
  domain?: string;
  context?: string;
  sourceRange?: MedolSourceRange;
  providers: EmCapabilityProvider[];
  actors: string[];
}

export interface EmCapabilityImport {
  name: string;
  alias?: string;
}

export interface EmCapabilityProvider {
  capability: string;
  kind: string;
  source?: string;
  mappings: Record<string, string>;
}

export interface EmClientEffect {
  type: EmClientEffectType;
  options: Record<string, string>;
}

export type EmClientEffectType =
  | 'download'
  | 'export'
  | 'import'
  | 'navigate'
  | 'openExternal'
  | 'copy'
  | 'revealSecret'
  | 'asyncJob'
  | 'stream'
  | 'preview'
  | 'print'
  | 'share';

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
  port?: boolean;
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

export interface EmExternalSystem {
  id: string;
  name: string;
  sourceRange?: MedolSourceRange;
  kind?: string;
  protocol?: string;
  endpoint?: EmExternalEndpoint;
  capabilities: EmExternalCapability[];
}

export interface EmExternalEndpoint {
  type: 'config';
  key: string;
}

export interface EmExternalCapability {
  type: 'command' | 'event';
  name: string;
}

export interface EmContext {
  id: string;
  name: string;
  sourceRange?: MedolSourceRange;
  valueTypes: EmValueType[];
  aggregates: EmAggregate[];
  slices: EmSlice[];
  concepts: EmConcept[];
  externalSystems: EmExternalSystem[];
  looseElements: EmElement[];
  notes: string[];
  risks: string[];
  decisions: string[];
  metrics: string[];
  capabilityExtensions: EmCapabilityExtension[];
  userJourneys?: EmUserJourney[];
}

export interface EmDomain {
  id: string;
  name: string;
  sourceRange?: MedolSourceRange;
  contexts: EmContext[];
  deployments: EmDeployment[];
  frontendApplications: EmFrontendApplication[];
  userJourneys?: EmUserJourney[];
  capabilityExtensions: EmCapabilityExtension[];
  accessPolicies: EmAccessPolicy[];
  defaultAccessPolicy?: string;
}

export interface EmUserJourney {
  id: string;
  name: string;
  domain?: string;
  context?: string;
  actor?: string;
  sourceRange?: MedolSourceRange;
  stages: Array<{ id: string; name: string; context: string; contextId?: string }>;
  transitions: Array<{ source: string; target: string; condition?: string }>;
}

export interface EmDeployment {
  id: string;
  name: string;
  domain?: string;
  sourceRange?: MedolSourceRange;
  contexts: string[];
}

export interface EmFrontendInclude {
  context: string;
  slice?: string;
  backend?: string;
}

export interface EmFrontendApplication {
  id: string;
  name: string;
  domain?: string;
  sourceRange?: MedolSourceRange;
  includes: EmFrontendInclude[];
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
  capabilityImports?: EmCapabilityImport[];
  domains: EmDomain[];
  deployments: EmDeployment[];
  frontendApplications: EmFrontendApplication[];
  userJourneys?: EmUserJourney[];
  accessPolicies: EmAccessPolicy[];
  defaultAccessPolicy?: string;
  contexts: EmContext[];
  capabilityExtensions: EmCapabilityExtension[];
  edges: EmEdge[];
  diagnostics: string[];
  diagnosticDetails: MedolDiagnostic[];
}

export const emptyModel = (): EmModel => ({
  domains: [],
  deployments: [],
  frontendApplications: [],
  userJourneys: [],
  accessPolicies: [],
  contexts: [],
  capabilityExtensions: [],
  edges: [],
  diagnostics: [],
  diagnosticDetails: []
});
