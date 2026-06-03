export interface AgentDslKnowledge {
  id: string;
  version: string;
  language: 'event-modeling-dsl';
  title: string;
  summary: string;
  requiredInstructions: string[];
  syntax: Record<string, string>;
  modelingConventions: string[];
  fieldMappingRules: string[];
  uiRules: string[];
  patchRules: string[];
  examples: Array<{
    name: string;
    dsl: string;
  }>;
}

export interface AgentDslKnowledgeManifest {
  id: string;
  version: string;
  language: AgentDslKnowledge['language'];
  title: string;
  summary: string;
  compactRules: string[];
}

export interface AgentContextItem {
  type: 'dsl-knowledge';
  id: string;
  version: string;
  title: string;
  content: AgentDslKnowledgeManifest;
}

export const eventModelingDslKnowledge: AgentDslKnowledge = {
  id: 'event-modeling-dsl-knowledge',
  version: '2026-06-02',
  language: 'event-modeling-dsl',
  title: 'Event Modeling DSL knowledge',
  summary: 'Core syntax, modeling conventions, and patch constraints for the Event Modeling Toolkit DSL.',
  requiredInstructions: [
    'Treat the DSL as the source of truth for the model.',
    'Prefer small DSL patches over broad rewrites.',
    'Preserve existing names, ordering, indentation, and user-authored comments where possible.',
    'When a business rule is unclear, add or update a hotspot instead of inventing behavior.',
    'Command and event fields do not need to be identical. Event fields may be derived from command fields, aggregate state, read models, policies, or integrations.',
    'When proposing DSL changes, return a complete nextDsl string plus a short preview and focus target.'
  ],
  syntax: {
    domain: 'domain Name { context ... } groups bounded contexts under a business domain.',
    context: 'context Name { aggregate | policy | integration | projection | userJourney | risk | note | decision | metric } describes a bounded context.',
    aggregate: 'aggregate Name { state StateName | slice SliceName { ... } } owns lifecycle states and timeline slices.',
    slice: 'slice Name { actor | createsAggregate | ui | reactsTo | command | event | state | specification | projection | automation | policy | hotspot } describes one timeline capability.',
    command: 'command Name { fieldName: Type attributes? mapping? details? example? } represents user or system intent.',
    event: 'event Name { fieldName: Type attributes? mapping? details? } records a fact after command/rule processing.',
    projection: 'projection Name[]? { subscribe EventName? fieldName: Type ... } represents a read model. [] marks list/read-model collection semantics.',
    ui: 'ui ViewName type? attaches a UI surface to a slice. Supported types: list, detail, form, dialog, drawer, confirm, wizard, inline, background.',
    state: 'state StateName inside an aggregate declares a lifecycle state. state StateName inside a slice marks the resulting state.',
    createsAggregate: 'createsAggregate marks the command slice that creates the aggregate instance.',
    specification: 'specification "Name" { given EventName* ui ...? when CommandName {...}? then EventName } captures behavior examples.',
    automation: 'automation Name { condition expression emits CommandName } captures automatic behavior.',
    policy: 'policy Name { on EventName issue CommandName } captures event-triggered command policy.',
    hotspot: 'hotspot "..." records open questions, unclear rules, or decisions that are not ready to encode.'
  },
  modelingConventions: [
    'Use slices to model timeline flow. Command, event, state, projection, automation, and hotspot placement matters.',
    'Place projection/read model slices where the timeline makes the resulting information visible.',
    'Use createsAggregate only on the entry command slice that creates the aggregate.',
    'Use state in aggregate for possible lifecycle states and state in slice for the resulting state after that slice.',
    'Use reactsTo when a slice starts from a prior event instead of a direct UI/user command.',
    'Do not force commands and events to have identical fields. Events should contain the important recorded facts.',
    'Prefer explicit rule/hotspot notes for domain logic that code generation or a human must later implement.'
  ],
  fieldMappingRules: [
    'Use "field: Type from Source.field" when the field is copied or mapped from another element.',
    'Use "field: Type derived" when the value is computed but the rule is not yet clear.',
    'Use "field: Type derived from Source.field { rule "..." }" when computation inputs and rule are known.',
    'Use field details "{ example "..." }" to provide representative values without changing field semantics.',
    'Use attributes id, generated, technical, query to clarify identity, generated values, non-business fields, and query parameters.'
  ],
  uiRules: [
    'ui ViewName form/dialog/drawer/confirm/wizard/inline/background describes command interaction style.',
    'ui ViewName list/detail describes read-model or page-oriented surfaces when explicitly modeled.',
    'If UI ownership is ambiguous, infer command actions from timeline order and read models, then add a hotspot if the ambiguity matters.'
  ],
  patchRules: [
    'Patch preview should be short and focused.',
    'nextDsl must parse after the patch unless the response explicitly blocks applying it.',
    'When generating a projection, subscribe to the event it reads from when known.',
    'When generating a derived field, include from sources and rule text when known; otherwise use derived plus hotspot.',
    'Never remove existing DSL content unless the user explicitly asks for deletion.'
  ],
  examples: [
    {
      name: 'Create aggregate slice',
      dsl: [
        'slice CreateFederation {',
        '  createsAggregate',
        '  actor Admin',
        '  ui FederationSetupScreen form',
        '  command CreateFederation {',
        '    federationId: UUID id generated technical',
        '    federationName: String',
        '  }',
        '  event FederationCreated {',
        '    federationId: UUID id',
        '    federationName: String',
        '  }',
        '  state Draft',
        '}'
      ].join('\n')
    },
    {
      name: 'Derived event field',
      dsl: [
        'event TrainingJobSubmitted {',
        '  trainingJobId: UUID id',
        '  minimumNodesPerRound: Int derived {',
        '    from TrainingJob.trainingStrategy',
        '    rule "Derive the minimum selected nodes from the configured training strategy."',
        '  }',
        '}'
      ].join('\n')
    },
    {
      name: 'Read model projection',
      dsl: [
        'projection FederationOverview[] {',
        '  subscribe FederationCreated',
        '  federationId: UUID id',
        '  federationName: String',
        '  state: String',
        '}'
      ].join('\n')
    }
  ]
};

export const eventModelingDslKnowledgeManifest: AgentDslKnowledgeManifest = {
  id: eventModelingDslKnowledge.id,
  version: eventModelingDslKnowledge.version,
  language: eventModelingDslKnowledge.language,
  title: eventModelingDslKnowledge.title,
  summary: eventModelingDslKnowledge.summary,
  compactRules: [
    ...eventModelingDslKnowledge.requiredInstructions,
    'Use field mappings with from or derived. Add rule/example details only when they clarify known domain logic.',
    'Use ui type to express interaction style. Command UI types include form/dialog/drawer/confirm/wizard/inline/background; read surfaces include list/detail.',
    'Use projection Name[] with subscribe EventName when modeling read models fed by events.'
  ]
};

export const requiredDslKnowledgeContext: AgentContextItem = {
  type: 'dsl-knowledge',
  id: eventModelingDslKnowledgeManifest.id,
  version: eventModelingDslKnowledgeManifest.version,
  title: eventModelingDslKnowledgeManifest.title,
  content: eventModelingDslKnowledgeManifest
};
