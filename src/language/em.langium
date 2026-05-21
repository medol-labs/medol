grammar EventModeling

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
      Aggregate
    | Policy
    | Integration
    | Projection
    | UserJourney
    | Risk
    | Note
    | Decision
    | Metric
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
    | CreatesAggregateMarker
    | UiRef
    | ReactsTo
    | Command
    | Event
    | State
    | Specification
    | Projection
    | Automation
    | Policy
    | Hotspot
;

ActorRef:
    'actor' actor=ID
;

CreatesAggregateMarker:
    createsAggregate?='createsAggregate'
;

UiRef:
    'ui' view=ID
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

Projection:
    'projection' name=ID '{'
        elements+=ProjectionElement*
    '}'
;

ProjectionElement:
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
        givens+=Given*
        ui=UiRef?
        when=When
        then=Then
    '}'
;

Given:
    'given' event=[Event:ID]
;

When:
    'when' command=[Command:ID]
    condition=ExampleBlock?
;

Then:
    'then' event=[Event:ID]
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
    field=ID '=' value=Literal
;

Field:
    name=ID ':' type=ID cardinality=Cardinality? attributes+=FieldAttribute* mapping=FieldMapping? details=FieldDetails?
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
    parts+=ID ('.' parts+=ID)*
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
