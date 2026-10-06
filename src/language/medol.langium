grammar Medol

entry Model:
    imports+=Import*
    (domains+=Domain | contexts+=Context | deployments+=Deployment | frontendApplications+=FrontendApplication | capabilityExtensions+=CapabilityExtension)*
;

Import:
    'import' (path=STRING | module=ImportModuleName) ('as' alias=ID)? ('deploy' deployment=ID)?
;

ImportModuleName returns string:
    ImportModuleNamePart ('-' ImportModuleNamePart)*
;

ImportModuleNamePart returns string:
      ID
    | 'dictionary'
    | 'data'
    | 'exchange'
    | 'file'
    | 'identity'
    | 'access'
    | 'management'
    | 'maintenance'
;

Domain:
    'domain' name=ID '{'
        (contexts+=Context | deployments+=Deployment | frontendApplications+=FrontendApplication | capabilityExtensions+=CapabilityExtension)*
    '}'
;

FrontendApplication:
    'frontend' name=ID '{'
        includes+=FrontendInclude*
    '}'
;

FrontendInclude:
    'includes' context=ID ('.' slice=ID)? ('from' backend=ID)?
;

Deployment:
    'deployment' name=ID '{'
        contexts+=DeploymentContext*
    '}'
;

DeploymentContext:
    'includes' context=ID
;

Context:
    'context' name=ID '{'
        elements+=ContextElement*
    '}'
;

ContextElement:
      ValueType
    | EnumType
    | StructuredValueType
    | CapabilityExtension
    | Slice
    | Concept
    | Automation
    | External
    | Integration
    | ReadModel
    | UserJourney
    | Risk
    | Note
    | Decision
    | Metric
;

ValueType:
    'type' name=ID '=' baseType=ID ('{'
        constraints+=ValueTypeConstraint*
    '}')?
;

EnumType:
    'enum' name=ID '{'
        values+=ID*
    '}'
;

StructuredValueType:
    'value' name=ID '{'
        fields+=Field*
    '}'
;

ValueTypeConstraint:
      TypeFormatConstraint
    | TypeLengthConstraint
    | TypeRangeConstraint
    | TypeMatchesConstraint
    | TypeOneOfConstraint
;

TypeFormatConstraint:
    'format' format=ID
;

TypeLengthConstraint:
    'length' min=NUMBER '..' max=NUMBER
;

TypeRangeConstraint:
    'range' min=NUMBER '..' max=NUMBER
;

TypeMatchesConstraint:
    'matches' pattern=STRING
;

TypeOneOfConstraint:
    'oneOf' values+=Literal (',' values+=Literal)*
;

State:
    'state' name=ID
;

Slice:
    'slice' name=ID '{'
        elements+=SliceElement*
    '}'
;

SliceElement:
      ActorRef
    | StartsLifecycleMarker
    | PortMarker
    | SliceTags
    | UiRef
    | ReactsTo
    | Command
    | Event
    | State
    | Specification
    | ReadModel
    | Automation
    | Hotspot
;

SliceTags:
    'tags' '{'
        tags+=SliceTag*
    '}'
;

SliceTag:
    name=ID ('=' expression=TagExpression)?
;

TagExpression:
      TagFunctionCall
    | TagReference
;

TagFunctionCall:
    function=ID '(' (arguments+=TagExpression (',' arguments+=TagExpression)*)? ')'
;

TagReference:
    parts+=ID ('.' parts+=ID)*
;

Concept:
    'concept' name=ID '{'
        features+=ConceptFeature*
    '}'
;

ConceptFeature:
      State
    | ConceptSliceRef
;

ConceptSliceRef:
    'slice' slice=[Slice:ID]
;

ActorRef:
    'actor' actor=ID
;

StartsLifecycleMarker:
    startsLifecycle?='startsLifecycle'
;

PortMarker:
    port?='port'
;

UiRef:
    'ui' view=ID type=UiType?
;

UiType returns string:
      'list'
    | 'detail'
    | 'form'
    | 'dialog'
    | 'drawer'
    | 'confirm'
    | 'wizard'
    | 'inline'
    | 'background'
;

ReactsTo:
    'reactsTo' event=[Event:ID]
;

Command:
    'command' name=ID '{'
        elements+=CommandElement*
    '}'
;

CommandElement:
      Field
    | CommandResult
    | ClientEffect
    | Example
;

CommandResult:
    'result' name=ID? '{'
        fields+=Field*
    '}'
;

ClientEffect:
    'clientEffect' type=ClientEffectType ('{'
        options+=ClientEffectOption*
    '}')?
;

ClientEffectType returns string:
      'download'
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
    | 'share'
;

ClientEffectOption:
    name=ID value=(ID | STRING)
;

Event:
    'event' name=ID '{'
        fields+=Field*
    '}'
;

ReadModel:
    sync?='sync'? ('readmodel' | 'projection') todo?='todo'? name=ID listElement?='[]'? ('from' source=FieldSource)? ('where' syncFilters+=SyncFilter (',' syncFilters+=SyncFilter)*)? '{'
        elements+=ReadModelElement*
        eligibility+=Eligibility*
    '}'
;

SyncFilter:
    target=FieldSource '=' source=FieldSource
;

ReadModelElement:
      Field
    | Subscription
    | DictionaryProvider
    | Exportable
;

Exportable:
    'exportable' ('by' capability=FieldSource)?
;

Eligibility:
    'eligible' ('for' profile=ID)? 'when' '{'
        conditions+=Expr*
    '}'
;

Subscription:
    'subscribe' event=[Event:ID]
;

DictionaryProvider:
    'dictionaryProvider' name=ID '{'
        mappings+=DictionaryProviderMapping*
    '}'
;

DictionaryProviderMapping:
    kind=DictionaryProviderMappingKind field=FieldName
;

DictionaryProviderMappingKind returns string:
      'code'
    | 'value'
    | 'label'
    | 'active'
    | 'state'
    | 'order'
;

CapabilityExtension:
    'extend' target=FieldSource '{'
        elements+=CapabilityExtensionElement*
    '}'
;

CapabilityExtensionElement:
      CapabilityProvider
    | CapabilityActors
;

CapabilityProvider:
    'provider' kind=CapabilityProviderKind ('from' source=FieldSource)? '{'
        mappings+=CapabilityProviderMapping*
    '}'
;

CapabilityProviderMapping:
    role=FieldName field=FieldName
;

CapabilityProviderKind returns string:
      ID
    | 'export'
    | 'import'
;

CapabilityActors:
    'actors' actors+=ID (',' actors+=ID)*
;

Automation:
    'automation' name=ID '{'
        elements+=AutomationElement*
    '}'
;

AutomationElement:
      AutomationTrigger
    | AutomationCapabilityUse
    | Condition
    | FanOut
    | Emits
;

AutomationCapabilityUse:
    'uses' capability=QualifiedType
;

AutomationTrigger:
    'on' (('todo' todo=[ReadModel:ID]) | event=[Event:ID])
;

Condition:
    'condition' expression=Expr
;

FanOut:
    'for' 'each' source=FieldSource 'as' alias=ID
;

Emits:
    'emits' command=[Command:ID]
;

Specification:
    'specification' name=STRING '{'
        (
            ('rule' rule=MULTILINE_STRING)?
            ('expression' '{'
                expressions+=ValidationExpression*
            '}')?
            scenarios+=Scenario+
        |
            givens+=Given*
            ui=UiRef?
            when=When
            then=Then
        )
    '}'
;

Scenario:
    'scenario' name=STRING '{'
        givens+=Given*
        ui=UiRef?
        when=When
        then=Then
    '}'
;

ValidationExpression:
      UniqueValidation
    | AssertValidation
;

UniqueValidation:
    'unique' (
        target=FieldSource
        | '(' targets+=FieldSource (',' targets+=FieldSource)+ ')'
    )
;

AssertValidation:
    'assert' left=ValidationOperand
    operator=('>' | '<' | '>=' | '<=' | '==' | '!=')
    right=ValidationOperand
;

ValidationOperand:
      FieldSource
    | Literal
;

Given:
    'given' event=[Event:ID]
    condition=ExampleBlock?
;

When:
    'when' command=[Command:ID]
    condition=ExampleBlock?
;

Then:
    'then' (event=[Event:ID] | 'reject' rejection=STRING | 'error' error=STRING)
;

Example:
    'example' block=ExampleBlock
;

ExampleBlock:
    '{'
        assignments+=Assignment*
    '}'
;

Assignment:
    field=FieldName '=' value=Literal
;

Field:
    name=FieldName ':' type=QualifiedType cardinality=Cardinality? attributes+=FieldAttribute* ('dictionary' dictionary=STRING)? mapping=FieldMapping? details=FieldDetails?
;

QualifiedType returns string:
    QualifiedTypePart ('.' QualifiedTypePart)*
;

QualifiedTypePart returns string:
      ID
    | 'export'
    | 'import'
;

FieldName returns string:
      ID
    | 'active'
    | 'code'
    | 'description'
    | 'domain'
    | 'eligible'
    | 'event'
    | 'export'
    | 'format'
    | 'id'
    | 'import'
    | 'label'
    | 'missing'
    | 'name'
    | 'order'
    | 'port'
    | 'state'
    | 'sync'
    | 'type'
    | 'value'
;

Cardinality returns string:
      '[]?'
    | '[]'
    | '?'
;

FieldAttribute returns string:
      'id'
    | 'generated'
    | 'technical'
    | 'query'
    | 'display'
    | 'uploadFile'
    | 'file'
    | 'portOutput'
;

FieldMapping:
      FieldSourceMapping
    | FieldDerivation
;

FieldSourceMapping:
    'from' sources+=FieldSource (',' sources+=FieldSource)*
;

FieldDerivation:
    'derived' ('from' sources+=FieldSource (',' sources+=FieldSource)*)? ('by' lookupKey=LookupKey)?
;

FieldDetails:
    '{'
        ('from' sources+=FieldSource (',' sources+=FieldSource)*)?
        ('lookup' 'key' lookupKey=LookupKey)?
        ('source' 'event' sourceEvent=ID)?
        ('source' 'field' sourceField=FieldSource)?
        ('target' 'field' targetField=FieldSource)?
        ('cache' ('projection' cacheProjection=ID | 'strategy' cacheStrategy=ID))?
        ('missing' ('value' | 'policy')? missingValuePolicy=ID)?
        ('rule' rule=STRING)?
        ('example' example=STRING)?
    '}'
;

LookupKey:
    keys+=FieldSource (',' keys+=FieldSource)*
;

FieldSource:
    parts+=FieldName ('.' parts+=FieldName)*
;

Integration:
    'integration' name=ID '{'
        elements+=IntegrationElement*
    '}'
;

IntegrationElement:
      Source
    | Target
    | ReactsTo
    | Emits
    | Command
    | Event
;

External:
    'external' name=ID '{'
        elements+=ExternalElement*
    '}'
;

ExternalElement:
      ExternalKind
    | ExternalProtocol
    | ExternalEndpoint
    | ExternalCapabilities
;

ExternalKind:
    'kind' value=ExternalToken
;

ExternalProtocol:
    'protocol' value=ExternalToken
;

ExternalEndpoint:
    'endpoint' 'config' configKey=STRING
;

ExternalCapabilities:
    'capabilities' '{'
        capabilities+=ExternalCapability*
    '}'
;

ExternalCapability:
    type=('command' | 'event') name=ID
;

ExternalToken:
    parts+=ID ('-' parts+=ID)*
;

Source:
    'source' system=ID
;

Target:
    'target' system=ID
;

UserJourney:
    'userJourney' name=ID '{'
        actor=ActorRef
        steps=Steps
    '}'
;

Steps:
    'steps' '{'
        values+=StepValue*
    '}'
;

StepValue:
      ViewStep
    | CommandStep
    | EventStep
;

ViewStep:
    'view' view=ID
;

CommandStep:
    command=[Command:ID]
;

EventStep:
    event=[Event:ID]
;

Risk:
    'risk' value=STRING
;

Note:
    'note' value=STRING
;

Decision:
    'decision' value=STRING
;

Metric:
    'metric' name=ID
;

Hotspot:
    'hotspot' value=STRING
;

Expr infers Expression:
    Comparison
;

Comparison infers Expression:
    PrimaryExpr
    ({infer BinaryExpr.left=current}
        operator=('>' | '<' | '>=' | '<=' | '==' | '!=')
        right=PrimaryExpr
    )*
;

PrimaryExpr:
      Literal
    | RefExpr
;

RefExpr:
    ref=FieldSource
;

Literal:
      StringLiteral
    | NumberLiteral
    | BooleanLiteral
    | NullLiteral
;

StringLiteral:
    value=STRING
;

NumberLiteral:
    value=NUMBER
;

BooleanLiteral:
    value=('true' | 'false')
;

NullLiteral:
    {infer NullLiteral} 'null'
;

terminal ID returns string:
    /[_a-zA-Z][\w_]*/;

terminal MULTILINE_STRING returns string:
    /"""[\s\S]*?"""/;

terminal STRING returns string:
    /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/;

terminal NUMBER returns number:
    /-?[0-9]+(\.[0-9]+)?/;

hidden terminal WS:
    /\s+/;

hidden terminal ML_COMMENT:
    /\/\*[\s\S]*?\*\//;

hidden terminal SL_COMMENT:
    /\/\/[^\n\r]*/;
