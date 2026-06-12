grammar Medol

entry Model:
    (domains+=Domain | contexts+=Context)*
;

Domain:
    'domain' name=ID '{'
        contexts+=Context*
    '}'
;

Context:
    'context' name=ID '{'
        elements+=ContextElement*
    '}'
;

ContextElement:
      ValueType
    | Aggregate
    | Slice
    | Concept
    | Policy
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

Aggregate:
    'aggregate' name=ID '{'
        features+=AggregateFeature*
    '}'
;

AggregateFeature:
      State
    | Slice
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
    | SliceTags
    | UiRef
    | ReactsTo
    | Command
    | Event
    | State
    | Specification
    | ReadModel
    | Automation
    | Policy
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
        fields+=Field*
        examples+=Example*
    '}'
;

Event:
    'event' name=ID '{'
        fields+=Field*
    '}'
;

ReadModel:
    ('readmodel' | 'projection') name=ID listElement?='[]'? '{'
        elements+=ReadModelElement*
    '}'
;

ReadModelElement:
      Field
    | Subscription
;

Subscription:
    'subscribe' event=[Event:ID]
;

Automation:
    'automation' name=ID '{'
        elements+=AutomationElement*
    '}'
;

AutomationElement:
      Condition
    | Emits
;

Condition:
    'condition' expression=Expr
;

Emits:
    'emits' command=[Command:ID]
;

Policy:
    'policy' name=ID '{'
        'on' event=[Event:ID]
        'issue' command=[Command:ID]
    '}'
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
    'unique' target=FieldSource
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
    'then' (event=[Event:ID] | 'reject' rejection=STRING)
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
    name=FieldName ':' type=ID cardinality=Cardinality? attributes+=FieldAttribute* mapping=FieldMapping? details=FieldDetails?
;

FieldName returns string:
      ID
    | 'domain'
    | 'event'
    | 'state'
;

Cardinality returns string:
      '[]'
    | '?'
;

FieldAttribute returns string:
      'id'
    | 'generated'
    | 'technical'
    | 'query'
;

FieldMapping:
      FieldSourceMapping
    | FieldDerivation
;

FieldSourceMapping:
    'from' sources+=FieldSource (',' sources+=FieldSource)*
;

FieldDerivation:
    'derived' ('from' sources+=FieldSource (',' sources+=FieldSource)*)?
;

FieldDetails:
    '{'
        ('from' sources+=FieldSource (',' sources+=FieldSource)*)?
        ('rule' rule=STRING)?
        ('example' example=STRING)?
    '}'
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
    ref=[Field:ID]
;

Literal:
      StringLiteral
    | NumberLiteral
;

StringLiteral:
    value=STRING
;

NumberLiteral:
    value=NUMBER
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
