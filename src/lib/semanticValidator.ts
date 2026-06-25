import {
  isAssertValidation,
  isBooleanLiteral,
  isCommand,
  isEnumType,
  isNumberLiteral,
  isNullLiteral,
  isSlice,
  isSliceTags,
  isStartsLifecycleMarker,
  isState,
  isStructuredValueType,
  isStringLiteral,
  isTagFunctionCall,
  isTagReference,
  isUniqueValidation,
  isValueType
} from '../language/generated/ast';
import type {
  Context as AstContext,
  Assignment,
  Expression,
  FieldSource,
  Model as AstModel,
  Scenario,
  Slice as AstSlice,
  Specification,
  TagExpression,
  ValidationOperand
} from '../language/generated/ast';
import type {
  EmContext,
  EmElement,
  EmField,
  EmModel,
  EmSlice,
  EmValueType
} from './model';

const builtinTypes = new Set([
  'Any',
  'BigDecimal',
  'BigInteger',
  'Boolean',
  'Byte',
  'Date',
  'DateTime',
  'Decimal',
  'Double',
  'Duration',
  'Float',
  'Instant',
  'Int',
  'Json',
  'LocalDate',
  'LocalDateTime',
  'Long',
  'Short',
  'String',
  'Time',
  'UUID'
]);

const numericTypes = new Set([
  'BigDecimal',
  'BigInteger',
  'Byte',
  'Decimal',
  'Double',
  'Float',
  'Int',
  'Long',
  'Short'
]);

const textualTypes = new Set([
  'Date',
  'DateTime',
  'Duration',
  'Instant',
  'LocalDate',
  'LocalDateTime',
  'String',
  'Time',
  'UUID'
]);

interface ContextSymbols {
  context: EmContext;
  valueTypes: Map<string, EmValueType>;
  slices: Map<string, EmSlice[]>;
  elements: Map<string, EmElement[]>;
  fieldsByElement: Map<string, EmField[]>;
  fieldsByAggregate: Map<string, EmField[]>;
  fieldsByConcept: Map<string, EmField[]>;
}

interface ResolvedOperand {
  type: string;
  cardinality: EmField['cardinality'];
  label: string;
}

export const validateSemanticModel = (ast: AstModel, model: EmModel): string[] => {
  const diagnostics: string[] = [];
  const astContexts = [
    ...(ast.domains ?? []).flatMap((domain) => domain.contexts ?? []),
    ...(ast.contexts ?? [])
  ];

  validateDuplicateNames((ast.domains ?? []).map((domain) => domain.name), 'domain', 'model', diagnostics);
  validateDuplicateNames(astContexts.map((context) => context.name), 'context', 'model', diagnostics);

  astContexts.forEach((astContext, index) => {
    const context = model.contexts[index];
    if (!context) return;
    validateContext(astContext, buildContextSymbols(context), diagnostics);
  });

  validateUnresolvedEdges(model, diagnostics);
  return [...new Set(diagnostics)];
};

const validateContext = (
  astContext: AstContext,
  symbols: ContextSymbols,
  diagnostics: string[]
): void => {
  const scope = `Context ${symbols.context.name}`;
  const definitions = astContext.elements ?? [];

  validateDuplicateNames(
    definitions.filter((item) => isValueType(item) || isEnumType(item) || isStructuredValueType(item)).map((item) => item.name),
    'type',
    scope,
    diagnostics
  );
  validateDuplicateNames(symbols.context.aggregates.map((item) => item.name), 'aggregate', scope, diagnostics);
  validateDuplicateNames(symbols.context.concepts.map((item) => item.name), 'concept', scope, diagnostics);
  validateDuplicateNames(
    [...symbols.slices.entries()].flatMap(([name, values]) => values.length > 0 ? [name, ...Array(values.length - 1).fill(name)] : []),
    'slice',
    scope,
    diagnostics
  );

  validateValueTypes(symbols, diagnostics);
  validateElements(symbols, diagnostics);
  validateAggregates(symbols, diagnostics);
  validateConcepts(symbols, diagnostics);

  for (const element of definitions) {
    if (isSlice(element)) {
      validateAstSlice(element, symbols, diagnostics);
    } else if (element.$type === 'Aggregate') {
      for (const feature of element.features ?? []) {
        if (isSlice(feature)) validateAstSlice(feature, symbols, diagnostics);
      }
    }
  }
};

const buildContextSymbols = (context: EmContext): ContextSymbols => {
  const slices = new Map<string, EmSlice[]>();
  const elements = new Map<string, EmElement[]>();
  const fieldsByElement = new Map<string, EmField[]>();
  const fieldsByAggregate = new Map<string, EmField[]>();
  const fieldsByConcept = new Map<string, EmField[]>();

  for (const slice of allSlices(context)) {
    addMulti(slices, slice.name, slice);
    for (const element of slice.elements) {
      addMulti(elements, element.name, element);
      if (element.fields.length > 0) fieldsByElement.set(element.name, element.fields);
    }
  }
  for (const element of context.looseElements) {
    addMulti(elements, element.name, element);
    if (element.fields.length > 0) fieldsByElement.set(element.name, element.fields);
  }
  for (const aggregate of context.aggregates) {
    fieldsByAggregate.set(aggregate.name, mergeFields(aggregate.slices.flatMap((slice) => slice.elements)));
  }
  for (const concept of context.concepts) {
    const memberSlices = allSlices(context).filter((slice) => concept.sliceIds.includes(slice.id));
    fieldsByConcept.set(concept.name, mergeFields(memberSlices.flatMap((slice) => slice.elements)));
  }

  const valueTypes = new Map(context.valueTypes.map((valueType) => [valueType.name, valueType]));
  for (const aggregate of context.aggregates) {
    if (aggregate.states.length > 0) {
      valueTypes.set(`${aggregate.name}.State`, lifecycleStateType(
        `${aggregate.id}/state-type`,
        `${aggregate.name}.State`,
        aggregate.states
      ));
    }
  }
  for (const concept of context.concepts) {
    if (concept.states.length > 0) {
      valueTypes.set(`${concept.name}.State`, lifecycleStateType(
        `${concept.id}/state-type`,
        `${concept.name}.State`,
        concept.states
      ));
    }
  }

  return {
    context,
    valueTypes,
    slices,
    elements,
    fieldsByElement,
    fieldsByAggregate,
    fieldsByConcept
  };
};

const lifecycleStateType = (
  id: string,
  name: string,
  states: string[]
): EmValueType => ({
  id,
  name,
  kind: 'enum',
  baseType: 'String',
  constraints: [],
  values: states,
  fields: []
});

const validateValueTypes = (symbols: ContextSymbols, diagnostics: string[]): void => {
  const scope = `Context ${symbols.context.name}`;
  for (const valueType of symbols.context.valueTypes) {
    if (valueType.kind === 'scalar' && !builtinTypes.has(valueType.baseType) && !symbols.valueTypes.has(valueType.baseType)) {
      diagnostics.push(`${scope}: type ${valueType.name} has unknown base type ${valueType.baseType}.`);
    }

    const resolvedBase = resolveBaseType(valueType.name, symbols.valueTypes, diagnostics, scope);
    if (valueType.kind === 'enum') {
      if (valueType.values.length === 0) {
        diagnostics.push(`${scope}: enum ${valueType.name} must declare at least one value.`);
      }
      validateDuplicateNames(valueType.values, 'enum value', `Enum ${valueType.name}`, diagnostics);
      continue;
    }
    if (valueType.kind === 'object') {
      validateDuplicateNames(valueType.fields.map((field) => field.name), 'field', `Value ${valueType.name}`, diagnostics);
      for (const field of valueType.fields) {
        if (!builtinTypes.has(field.type) && !symbols.valueTypes.has(field.type)) {
          diagnostics.push(`${scope}: value ${valueType.name} field ${field.name} has unknown type ${field.type}.`);
        }
        if (field.attributes.includes('id') || field.attributes.includes('generated')) {
          diagnostics.push(`${scope}: value ${valueType.name} field ${field.name} cannot declare identity or generated attributes.`);
        }
      }
      continue;
    }
    validateDuplicateNames(
      valueType.constraints.map((constraint) => constraint.kind),
      'constraint',
      `Type ${valueType.name}`,
      diagnostics
    );
    for (const constraint of valueType.constraints) {
      if ((constraint.kind === 'length' || constraint.kind === 'range') && constraint.min > constraint.max) {
        diagnostics.push(`${scope}: type ${valueType.name} has invalid ${constraint.kind} bounds ${constraint.min}..${constraint.max}.`);
      }
      if (constraint.kind === 'length' && resolvedBase && resolvedBase !== 'String') {
        diagnostics.push(`${scope}: length is only valid for String-based types, but ${valueType.name} is based on ${resolvedBase}.`);
      }
      if ((constraint.kind === 'format' || constraint.kind === 'matches') && resolvedBase && resolvedBase !== 'String') {
        diagnostics.push(`${scope}: ${constraint.kind} is only valid for String-based types, but ${valueType.name} is based on ${resolvedBase}.`);
      }
      if (constraint.kind === 'range' && resolvedBase && !numericTypes.has(resolvedBase)) {
        diagnostics.push(`${scope}: range is only valid for numeric types, but ${valueType.name} is based on ${resolvedBase}.`);
      }
      if (constraint.kind === 'matches') {
        try {
          new RegExp(constraint.pattern);
        } catch {
          diagnostics.push(`${scope}: type ${valueType.name} has invalid regular expression ${JSON.stringify(constraint.pattern)}.`);
        }
      }
      if (constraint.kind === 'oneOf') {
        if (constraint.values.length === 0) {
          diagnostics.push(`${scope}: type ${valueType.name} must declare at least one oneOf value.`);
        }
        for (const value of constraint.values) {
          if (resolvedBase && !literalMatchesType(value, resolvedBase)) {
            diagnostics.push(`${scope}: oneOf value ${JSON.stringify(value)} is incompatible with ${valueType.name}'s base type ${resolvedBase}.`);
          }
        }
        if (new Set(constraint.values.map((value) => JSON.stringify(value))).size !== constraint.values.length) {
          diagnostics.push(`${scope}: type ${valueType.name} has duplicate oneOf values.`);
        }
      }
    }
  }
  validateStructuredValueCycles(symbols, diagnostics);
};

const validateStructuredValueCycles = (symbols: ContextSymbols, diagnostics: string[]): void => {
  const objects = new Map(
    symbols.context.valueTypes
      .filter((valueType) => valueType.kind === 'object')
      .map((valueType) => [valueType.name, valueType])
  );
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (name: string, path: string[]): void => {
    if (visiting.has(name)) {
      diagnostics.push(`Context ${symbols.context.name}: cyclic structured value ${[...path, name].join(' -> ')}.`);
      return;
    }
    if (visited.has(name)) return;
    const valueType = objects.get(name);
    if (!valueType) return;
    visiting.add(name);
    for (const field of valueType.fields) {
      if (objects.has(field.type)) visit(field.type, [...path, name]);
    }
    visiting.delete(name);
    visited.add(name);
  };

  for (const name of objects.keys()) visit(name, []);
};

const resolveBaseType = (
  typeName: string,
  valueTypes: Map<string, EmValueType>,
  diagnostics: string[],
  scope: string,
  path: string[] = []
): string | undefined => {
  if (builtinTypes.has(typeName)) return typeName;
  const valueType = valueTypes.get(typeName);
  if (!valueType) return undefined;
  if (valueType.kind === 'enum') return 'String';
  if (valueType.kind === 'object') return valueType.name;
  if (path.includes(typeName)) {
    diagnostics.push(`${scope}: cyclic type definition ${[...path, typeName].join(' -> ')}.`);
    return undefined;
  }
  return resolveBaseType(valueType.baseType, valueTypes, diagnostics, scope, [...path, typeName]);
};

const validateElements = (symbols: ContextSymbols, diagnostics: string[]): void => {
  const scope = `Context ${symbols.context.name}`;
  for (const [name, elements] of symbols.elements) {
    const byKind = new Map<EmElement['kind'], number>();
    for (const element of elements) byKind.set(element.kind, (byKind.get(element.kind) ?? 0) + 1);
    for (const [kind, count] of byKind) {
      if (count > 1 && ['command', 'event', 'readmodel', 'automation', 'policy'].includes(kind)) {
        diagnostics.push(`${scope}: duplicate ${kind} ${name}.`);
      }
    }
  }

  for (const slice of allSlices(symbols.context)) {
    validateDuplicateNames(slice.tags.map((tag) => tag.name), 'tag', `Slice ${slice.name}`, diagnostics);
    const elementNames = slice.elements
      .filter((element) => ['command', 'event', 'readmodel', 'automation', 'policy'].includes(element.kind))
      .map((element) => element.name);
    validateDuplicateNames(elementNames, 'element', `Slice ${slice.name}`, diagnostics);

    for (const element of slice.elements) {
      validateElementFields(element, symbols, diagnostics);
    }
    validateFieldConsistency(`Slice ${slice.name}`, slice.elements, symbols, diagnostics);
  }
  for (const element of symbols.context.looseElements) validateElementFields(element, symbols, diagnostics);
};

const validateElementFields = (
  element: EmElement,
  symbols: ContextSymbols,
  diagnostics: string[]
): void => {
  if (element.kind === 'integration') return;
  validateDuplicateNames(element.fields.map((field) => field.name), 'field', `${element.kind} ${element.name}`, diagnostics);
  for (const field of element.fields) {
    if (!builtinTypes.has(field.type) && !symbols.valueTypes.has(field.type)) {
      diagnostics.push(`${element.kind} ${element.name}: field ${field.name} has unknown type ${field.type}.`);
    }
  }
};

const validateFieldConsistency = (
  scope: string,
  elements: EmElement[],
  symbols: ContextSymbols,
  diagnostics: string[]
): void => {
  const fieldTypes = new Map<string, Set<string>>();
  for (const element of elements) {
    for (const field of element.fields) {
      const baseType = resolveBaseType(field.type, symbols.valueTypes, [], '') ?? field.type;
      const types = fieldTypes.get(field.name) ?? new Set<string>();
      types.add(baseType);
      fieldTypes.set(field.name, types);
    }
  }
  for (const [fieldName, types] of fieldTypes) {
    if (types.size > 1) {
      diagnostics.push(`${scope}: field ${fieldName} has conflicting types ${[...types].join(', ')}.`);
    }
  }
};

const validateAggregates = (symbols: ContextSymbols, diagnostics: string[]): void => {
  for (const aggregate of symbols.context.aggregates) {
    const scope = `Aggregate ${aggregate.name}`;
    validateDuplicateNames(aggregate.states, 'state', scope, diagnostics);
    const starts = aggregate.slices.filter((slice) => slice.startsLifecycle);
    if (starts.length > 1) {
      diagnostics.push(`${scope}: multiple slices start the lifecycle: ${starts.map((slice) => slice.name).join(', ')}.`);
    }
    if (aggregate.states.length > 0 && aggregate.slices.length > 0 && starts.length === 0) {
      diagnostics.push(`${scope}: a stateful aggregate must have one slice marked startsLifecycle.`);
    }
    for (const slice of aggregate.slices) {
      if (slice.resultingState && !aggregate.states.includes(slice.resultingState)) {
        diagnostics.push(`${scope}: slice ${slice.name} results in undeclared state ${slice.resultingState}.`);
      }
    }
    validateFieldConsistency(scope, aggregate.slices.flatMap((slice) => slice.elements), symbols, diagnostics);
  }
};

const validateConcepts = (symbols: ContextSymbols, diagnostics: string[]): void => {
  const sliceConcepts = new Map<string, string[]>();
  for (const concept of symbols.context.concepts) {
    const scope = `Concept ${concept.name}`;
    validateDuplicateNames(concept.states, 'state', scope, diagnostics);
    validateDuplicateNames(concept.sliceNames, 'slice reference', scope, diagnostics);

    for (const sliceName of concept.sliceNames) {
      const slices = symbols.slices.get(sliceName) ?? [];
      if (slices.length === 0) {
        diagnostics.push(`${scope}: references unknown slice ${sliceName}.`);
        continue;
      }
      if (slices.length > 1) {
        diagnostics.push(`${scope}: slice reference ${sliceName} is ambiguous.`);
      }
      sliceConcepts.set(sliceName, [...(sliceConcepts.get(sliceName) ?? []), concept.name]);
      const slice = slices[0];
      if (slice.resultingState && concept.states.length > 0 && !concept.states.includes(slice.resultingState)) {
        diagnostics.push(`${scope}: slice ${slice.name} results in undeclared state ${slice.resultingState}.`);
      }
    }

    const memberSlices = concept.sliceNames.flatMap((name) => symbols.slices.get(name) ?? []);
    const starts = memberSlices.filter((slice) => slice.startsLifecycle);
    if (starts.length > 1) {
      diagnostics.push(`${scope}: multiple slices start the lifecycle: ${starts.map((slice) => slice.name).join(', ')}.`);
    }
    if (concept.states.length > 0 && memberSlices.length > 0 && starts.length === 0) {
      diagnostics.push(`${scope}: a stateful concept must have one member slice marked startsLifecycle.`);
    }
    validateFieldConsistency(scope, memberSlices.flatMap((slice) => slice.elements), symbols, diagnostics);
  }

  for (const [sliceName, concepts] of sliceConcepts) {
    if (concepts.length > 1) {
      diagnostics.push(`Slice ${sliceName}: belongs to multiple concepts (${concepts.join(', ')}); lifecycle state and tag semantics are ambiguous.`);
    }
  }
};

const validateAstSlice = (
  astSlice: AstSlice,
  symbols: ContextSymbols,
  diagnostics: string[]
): void => {
  const sliceName = astSlice.name;
  const emSlice = (symbols.slices.get(sliceName) ?? [])[0];
  if (!emSlice) return;

  const stateCount = (astSlice.elements ?? []).filter(isState).length;
  const tagBlockCount = (astSlice.elements ?? []).filter(isSliceTags).length;
  const lifecycleMarkerCount = (astSlice.elements ?? []).filter(isStartsLifecycleMarker).length;
  const commandCount = (astSlice.elements ?? []).filter(isCommand).length;
  if (stateCount > 1) diagnostics.push(`Slice ${sliceName}: declares more than one resulting state.`);
  if (tagBlockCount > 1) diagnostics.push(`Slice ${sliceName}: declares more than one tags block.`);
  if (lifecycleMarkerCount > 1) diagnostics.push(`Slice ${sliceName}: declares startsLifecycle more than once.`);
  if (commandCount > 1) diagnostics.push(`Slice ${sliceName}: declares more than one command.`);
  if (lifecycleMarkerCount > 0 && commandCount === 0) {
    diagnostics.push(`Slice ${sliceName}: startsLifecycle requires a command.`);
  }

  const availableFields = mergeFields(emSlice.elements);
  for (const tagGroup of (astSlice.elements ?? []).filter(isSliceTags)) {
    for (const tag of tagGroup.tags ?? []) {
      if (tag.expression) validateTagExpression(tag.expression, availableFields, symbols, `Slice ${sliceName} tag ${tag.name}`, diagnostics);
      else if (!availableFields.some((field) => field.name === tag.name)) {
        diagnostics.push(`Slice ${sliceName}: tag ${tag.name} does not match any field in the slice.`);
      }
    }
  }

  for (const specification of (astSlice.elements ?? []).filter((element): element is Specification => element.$type === 'Specification')) {
    validateSpecification(specification, symbols, diagnostics);
  }
};

const validateTagExpression = (
  expression: TagExpression,
  availableFields: EmField[],
  symbols: ContextSymbols,
  scope: string,
  diagnostics: string[]
): void => {
  if (isTagReference(expression)) {
    if (expression.parts.length === 1) {
      if (!availableFields.some((field) => field.name === expression.parts[0])) {
        diagnostics.push(`${scope}: references unknown field ${expression.parts[0]}.`);
      }
    } else if (!resolveFieldPath(expression.parts, symbols)) {
      diagnostics.push(`${scope}: references unknown field path ${expression.parts.join('.')}.`);
    }
    return;
  }
  if (isTagFunctionCall(expression)) {
    for (const argument of expression.arguments) {
      validateTagExpression(argument, availableFields, symbols, scope, diagnostics);
    }
  }
};

const validateSpecification = (
  specification: Specification,
  symbols: ContextSymbols,
  diagnostics: string[]
): void => {
  const scope = `Specification ${JSON.stringify(specification.name)}`;
  validateDuplicateNames(specification.scenarios.map((scenario) => scenario.name), 'scenario', scope, diagnostics);

  for (const expression of specification.expressions) {
    if (isUniqueValidation(expression)) {
      for (const target of uniqueTargets(expression)) {
        const resolved = resolveFieldSource(target, symbols);
        if (!resolved) {
          diagnostics.push(`${scope}: unique references unknown field ${fieldSourceText(target)}.`);
        } else if (resolved.cardinality === 'List' || resolved.cardinality === 'OptionalList') {
          diagnostics.push(`${scope}: unique cannot target collection field ${resolved.label}.`);
        }
      }
    } else if (isAssertValidation(expression)) {
      const left = resolveOperand(expression.left, symbols);
      const right = resolveOperand(expression.right, symbols);
      if (!left) diagnostics.push(`${scope}: assert references unknown operand ${operandText(expression.left)}.`);
      if (!right) diagnostics.push(`${scope}: assert references unknown operand ${operandText(expression.right)}.`);
      if (left && right && !comparisonIsValid(left, right, expression.operator, symbols)) {
        diagnostics.push(`${scope}: cannot compare ${left.label} (${left.type}) ${expression.operator} ${right.label} (${right.type}).`);
      }
    }
  }

  for (const scenario of specification.scenarios) {
    validateScenario(scenario, symbols, `${scope}, scenario ${JSON.stringify(scenario.name)}`, diagnostics);
  }
  validateSpecificationCoverage(specification, scope, diagnostics);
  if (specification.when) {
    validateScenario(specification as unknown as Scenario, symbols, scope, diagnostics);
  }
};

const validateSpecificationCoverage = (
  specification: Specification,
  scope: string,
  diagnostics: string[]
): void => {
  if (specification.expressions.length === 0) return;

  const rejectingScenarios = specification.scenarios.filter((scenario) => Boolean(scenario.then.rejection));
  for (const expression of specification.expressions) {
    if (!rejectingScenarios.some((scenario) => scenarioViolatesExpression(scenario, expression))) {
      diagnostics.push(
        `${scope}: expression ${expressionText(expression)} is not covered by a rejecting scenario whose examples demonstrate the violation.`
      );
    }
  }

  for (const scenario of rejectingScenarios) {
    if (!specification.expressions.some((expression) => scenarioViolatesExpression(scenario, expression))) {
      diagnostics.push(
        `${scope}, scenario ${JSON.stringify(scenario.name)}: reject does not demonstrate a violation of any declared expression.`
      );
    }
  }
};

const scenarioViolatesExpression = (
  scenario: Scenario,
  expression: Specification['expressions'][number]
): boolean => {
  if (isUniqueValidation(expression)) {
    const fields = uniqueTargets(expression).map((target) => target.parts.at(-1));
    if (fields.some((field) => !field)) return false;
    return scenario.givens.some((given) => {
      return fields.every((field) => {
        const submitted = assignmentLiteral(scenario.when.condition?.assignments ?? [], field!);
        const existing = assignmentLiteral(given.condition?.assignments ?? [], field!);
        return submitted.resolved && existing.resolved && Object.is(existing.value, submitted.value);
      });
    });
  }

  if (!isAssertValidation(expression)) return false;
  const left = scenarioOperandValue(scenario, expression.left);
  const right = scenarioOperandValue(scenario, expression.right);
  return left.resolved && right.resolved
    ? !compareLiteralValues(left.value, right.value, expression.operator)
    : false;
};

interface ResolvedLiteral {
  resolved: boolean;
  value?: string | number | boolean | null;
}

const scenarioOperandValue = (
  scenario: Scenario,
  operand: ValidationOperand
): ResolvedLiteral => {
  if (operand.$type !== 'FieldSource') {
    return { resolved: true, value: literalValue(operand) };
  }

  const [owner, field] = operand.parts;
  if (!owner || !field) return { resolved: false };
  if (scenario.when.command?.$refText === owner) {
    return assignmentLiteral(scenario.when.condition?.assignments ?? [], field);
  }

  const matchingGiven = scenario.givens.find((given) => given.event?.$refText === owner);
  if (matchingGiven) return assignmentLiteral(matchingGiven.condition?.assignments ?? [], field);

  const submitted = assignmentLiteral(scenario.when.condition?.assignments ?? [], field);
  if (submitted.resolved) return submitted;
  for (const given of scenario.givens) {
    const existing = assignmentLiteral(given.condition?.assignments ?? [], field);
    if (existing.resolved) return existing;
  }
  return { resolved: false };
};

const assignmentLiteral = (assignments: Assignment[], field: string): ResolvedLiteral => {
  const assignment = assignments.find((candidate) => candidate.field === field);
  return assignment
    ? { resolved: true, value: literalValue(assignment.value) }
    : { resolved: false };
};

const literalValue = (literal: ValidationOperand): string | number | boolean | null => {
  if (isNullLiteral(literal)) return null;
  if (isNumberLiteral(literal) || isBooleanLiteral(literal) || isStringLiteral(literal)) {
    return literal.value;
  }
  return operandText(literal);
};

const compareLiteralValues = (
  left: unknown,
  right: unknown,
  operator: string
): boolean => {
  switch (operator) {
    case '>': return (left as number) > (right as number);
    case '<': return (left as number) < (right as number);
    case '>=': return (left as number) >= (right as number);
    case '<=': return (left as number) <= (right as number);
    case '==': return Object.is(left, right);
    case '!=': return !Object.is(left, right);
    default: return false;
  }
};

const expressionText = (expression: Specification['expressions'][number]): string =>
  isUniqueValidation(expression)
    ? expression.target
      ? `unique ${fieldSourceText(expression.target)}`
      : `unique (${expression.targets.map(fieldSourceText).join(', ')})`
    : `assert ${operandText(expression.left)} ${expression.operator} ${operandText(expression.right)}`;

const uniqueTargets = (
  expression: Extract<Specification['expressions'][number], { $type: 'UniqueValidation' }>
): FieldSource[] => expression.target ? [expression.target] : expression.targets;

const validateScenario = (
  scenario: Scenario,
  symbols: ContextSymbols,
  scope: string,
  diagnostics: string[]
): void => {
  for (const [index, given] of scenario.givens.entries()) {
    validateExampleAssignments(
      given.event?.$refText,
      'event',
      given.condition?.assignments ?? [],
      symbols,
      `${scope}, given ${index + 1}`,
      diagnostics
    );
  }
  validateExampleAssignments(
    scenario.when?.command?.$refText,
    'command',
    scenario.when?.condition?.assignments ?? [],
    symbols,
    `${scope}, when`,
    diagnostics
  );
};

const validateExampleAssignments = (
  elementName: string | undefined,
  expectedKind: EmElement['kind'],
  assignments: Assignment[],
  symbols: ContextSymbols,
  scope: string,
  diagnostics: string[]
): void => {
  if (!elementName) return;
  const candidates = (symbols.elements.get(elementName) ?? []).filter((element) => element.kind === expectedKind);
  if (candidates.length === 0) {
    diagnostics.push(`${scope}: references unknown ${expectedKind} ${elementName}.`);
    return;
  }
  if (candidates.length > 1) {
    diagnostics.push(`${scope}: ${expectedKind} ${elementName} is ambiguous.`);
    return;
  }

  const element = candidates[0];
  validateDuplicateNames(assignments.map((assignment) => assignment.field), 'assignment', scope, diagnostics);
  for (const assignment of assignments) {
    const field = element.fields.find((candidate) => candidate.name === assignment.field);
    if (!field) {
      diagnostics.push(`${scope}: ${expectedKind} ${elementName} has no field ${assignment.field}.`);
      continue;
    }
    const literalType = typeOfLiteral(assignment.value);
    const compatible = literalType === 'Null'
      ? field.cardinality === 'Optional' || field.cardinality === 'OptionalList'
      : typesAreCompatible(field.type, literalType, symbols);
    if (!compatible) {
      diagnostics.push(`${scope}: value for ${elementName}.${field.name} is incompatible with type ${field.type}.`);
    } else {
      const valueType = symbols.valueTypes.get(field.type);
      if (valueType?.kind === 'enum' && isStringLiteral(assignment.value) && !valueType.values.includes(assignment.value.value)) {
        diagnostics.push(`${scope}: value ${JSON.stringify(assignment.value.value)} is not a member of enum ${valueType.name}.`);
      }
    }
  }
};

const resolveOperand = (operand: ValidationOperand, symbols: ContextSymbols): ResolvedOperand | undefined => {
  if (operand.$type === 'FieldSource') return resolveFieldSource(operand, symbols);
  return {
    type: typeOfLiteral(operand),
    cardinality: 'Single',
    label: isNullLiteral(operand)
      ? 'null'
      : isStringLiteral(operand)
        ? JSON.stringify(operand.value)
        : String(operand.value)
  };
};

const resolveFieldSource = (source: FieldSource, symbols: ContextSymbols): ResolvedOperand | undefined =>
  resolveFieldPath(source.parts, symbols);

const resolveFieldPath = (parts: string[], symbols: ContextSymbols): ResolvedOperand | undefined => {
  if (parts.length < 2) return undefined;
  const [owner, fieldName] = parts;
  const fields =
    symbols.fieldsByElement.get(owner) ??
    symbols.fieldsByAggregate.get(owner) ??
    symbols.fieldsByConcept.get(owner);
  const field = fields?.find((candidate) => candidate.name === fieldName);
  return field ? { type: field.type, cardinality: field.cardinality, label: `${owner}.${fieldName}` } : undefined;
};

const comparisonIsValid = (
  left: ResolvedOperand,
  right: ResolvedOperand,
  operator: string,
  symbols: ContextSymbols
): boolean => {
  if (left.type === 'Null' || right.type === 'Null') {
    const other = left.type === 'Null' ? right : left;
    return ['==', '!='].includes(operator)
      && (other.cardinality === 'Optional' || other.cardinality === 'OptionalList');
  }
  const leftBase = resolveBaseType(left.type, symbols.valueTypes, [], '');
  const rightBase = resolveBaseType(right.type, symbols.valueTypes, [], '');
  if (!leftBase || !rightBase) return false;
  if (['>', '<', '>=', '<='].includes(operator)) {
    return numericTypes.has(leftBase) && numericTypes.has(rightBase);
  }
  return leftBase === rightBase
    || (numericTypes.has(leftBase) && numericTypes.has(rightBase))
    || (textualTypes.has(leftBase) && textualTypes.has(rightBase));
};

const typeOfLiteral = (literal: Expression): string => {
  if (isNumberLiteral(literal)) return 'Decimal';
  if (isBooleanLiteral(literal)) return 'Boolean';
  if (isNullLiteral(literal)) return 'Null';
  return 'String';
};

const typesAreCompatible = (declared: string, actual: string, symbols: ContextSymbols): boolean => {
  const declaredBase = resolveBaseType(declared, symbols.valueTypes, [], '');
  if (!declaredBase) return false;
  if (symbols.valueTypes.get(declared)?.kind === 'object') return false;
  if (declaredBase === 'Any') return true;
  if (actual === 'Decimal') return numericTypes.has(declaredBase);
  if (actual === 'String') return textualTypes.has(declaredBase);
  return declaredBase === actual;
};

const literalMatchesType = (value: string | number | boolean | null, baseType: string): boolean => {
  if (value === null) return false;
  if (typeof value === 'number') return numericTypes.has(baseType);
  if (typeof value === 'boolean') return baseType === 'Boolean';
  return textualTypes.has(baseType);
};

const validateUnresolvedEdges = (model: EmModel, diagnostics: string[]): void => {
  for (const edge of model.edges) {
    if (edge.source.startsWith('ref/')) diagnostics.push(`Unresolved ${edge.label ?? 'source'} reference ${edge.source.slice(4).replace('/', ' ')}.`);
    if (edge.target.startsWith('ref/')) diagnostics.push(`Unresolved ${edge.label ?? 'target'} reference ${edge.target.slice(4).replace('/', ' ')}.`);
  }
};

const validateDuplicateNames = (
  names: string[],
  kind: string,
  scope: string,
  diagnostics: string[]
): void => {
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) diagnostics.push(`${scope}: duplicate ${kind} ${name}.`);
    seen.add(name);
  }
};

const mergeFields = (elements: EmElement[]): EmField[] => {
  const fields = new Map<string, EmField>();
  for (const element of elements) {
    for (const field of element.fields) {
      const current = fields.get(field.name);
      if (!current || current.type === field.type) fields.set(field.name, field);
    }
  }
  return [...fields.values()];
};

const allSlices = (context: EmContext): EmSlice[] => [
  ...context.slices,
  ...context.aggregates.flatMap((aggregate) => aggregate.slices)
];

const addMulti = <T>(target: Map<string, T[]>, key: string, value: T): void => {
  target.set(key, [...(target.get(key) ?? []), value]);
};

const fieldSourceText = (source: FieldSource): string => source.parts.join('.');
const operandText = (operand: ValidationOperand): string =>
  operand.$type === 'FieldSource'
    ? fieldSourceText(operand)
    : isNullLiteral(operand)
      ? 'null'
    : isStringLiteral(operand)
      ? JSON.stringify(operand.value)
      : String(operand.value);
