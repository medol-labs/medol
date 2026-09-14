import { createDefaultCoreModule, createDefaultSharedCoreModule, EmptyFileSystem, inject, type AstNode, type RootCstNode } from 'langium';
import { MedolGeneratedModule, MedolGeneratedSharedModule } from '../language/generated/module';
import {
  isActorRef,
  isAutomation,
  isAutomationTrigger,
  isBinaryExpr,
  isBooleanLiteral,
  isCommand,
  isCondition,
  isCommandResult,
  isDictionaryProvider,
  isStartsLifecycleMarker,
  isConcept,
  isEvent,
  isExternal,
  isExternalCapabilities,
  isExternalEndpoint,
  isExternalKind,
  isExternalProtocol,
  isField,
  isFieldDerivation,
  isFieldSourceMapping,
  isFanOut,
  isHotspot,
  isIntegration,
  isDecision,
  isEnumType,
  isMetric,
  isNote,
  isNullLiteral,
  isNumberLiteral,
  isPortMarker,
  isReadModel,
  isReactsTo,
  isRefExpr,
  isRisk,
  isSlice,
  isSliceTags,
  isSource,
  isSpecification,
  isState,
  isStructuredValueType,
  isStringLiteral,
  isSubscription,
  isTarget,
  isTypeFormatConstraint,
  isTypeLengthConstraint,
  isTypeMatchesConstraint,
  isTypeOneOfConstraint,
  isTypeRangeConstraint,
  isUiRef,
  isValueType
} from '../language/generated/ast';
import type {
  Automation as AstAutomation,
  Command as AstCommand,
  Context as AstContext,
  Domain as AstDomain,
  Deployment as AstDeployment,
  Concept as AstConcept,
  Event as AstEvent,
  Expression,
  External as AstExternal,
  ExternalToken as AstExternalToken,
  Field as AstField,
  FieldSource,
  FrontendApplication as AstFrontendApplication,
  Integration as AstIntegration,
  LookupKey as AstLookupKey,
  Model as AstModel,
  ReadModel as AstReadModel,
  Slice as AstSlice,
  Scenario as AstScenario,
  TagExpression,
  ValueType as AstValueType,
  EnumType as AstEnumType,
  StructuredValueType as AstStructuredValueType,
  ValueTypeConstraint,
  Specification as AstSpecification,
  ValidationExpression,
  ValidationOperand,
  UiRef as AstUiRef
} from '../language/generated/ast';
import { EmContext, EmConcept, EmDeployment, EmDomain, EmEdge, EmElement, EmField, EmFieldMapping, EmModel, EmSlice, EmUi, EmValueType, EmValueTypeConstraint, emptyModel, type EmDerivedLookup, type EmDictionaryProvider, type EmExternalSystem, type EmFrontendApplication, type MedolDiagnostic, type MedolSourceRange } from './model';
import { validateSemanticModel } from './semanticValidator';
import { locateSemanticDiagnostics } from './diagnosticLocation';
import { resolveBuiltinMedolImport, supportedBuiltinMedolImports } from './builtinMedolModels';

const sharedServices = inject(
  createDefaultSharedCoreModule(EmptyFileSystem),
  MedolGeneratedSharedModule
);

const medolServices = inject(
  createDefaultCoreModule({ shared: sharedServices }),
  MedolGeneratedModule
);

export interface MedolSource {
  sourceName: string;
  text: string;
}

export const parseMedol = (text: string): EmModel => {
  const diagnostics: string[] = [];
  const builtinSources = readMedolImports(text)
    .filter((imported) => imported.module)
    .map((imported) => {
      const source = resolveBuiltinMedolImport(imported);
      if (!source) {
        diagnostics.push(`Unknown built-in import ${imported.module}. Supported built-ins: ${supportedBuiltinMedolImports().join(', ')}.`);
      }
      return source;
    })
    .filter((source): source is MedolSource => Boolean(source));
  const model = parseMedolSources([...builtinSources, { sourceName: '<memory>', text }]);
  model.diagnostics.unshift(...diagnostics);
  model.diagnosticDetails.unshift(...diagnostics.map((message) => ({ message })));
  return model;
};

export const parseMedolSources = (sources: MedolSource[]): EmModel => {
  try {
    const results = sources.map((source) => ({
      source,
      result: medolServices.parser.LangiumParser.parse<AstModel>(source.text)
    }));
    const sourceNamesByRoot = new Map<RootCstNode, string>();
    for (const { source, result } of results) {
      const root = result.value.$cstNode?.root;
      if (root) sourceNamesByRoot.set(root, source.sourceName);
    }
    const ast = mergeAstModels(results.map(({ result }) => result.value));
    const model = astToEmModel(ast);

    for (const { source, result } of results) {
      const sourcePrefix = source.sourceName === '<memory>' ? '' : `${source.sourceName}: `;
      for (const lexerError of result.lexerErrors) {
        const location = lexerError.line != null
          ? `Line ${lexerError.line}${lexerError.column != null ? `:${lexerError.column}` : ''}: `
          : '';
        addDiagnostic(model, {
          message: `${sourcePrefix}${location}${lexerError.message}`,
          sourceName: source.sourceName,
          ...(lexerError.line != null && lexerError.column != null
            ? { range: pointRange(lexerError.line, lexerError.column, lexerError.length ?? 1) }
            : {})
        });
      }
      for (const parserError of result.parserErrors) {
        const line = parserError.token.startLine;
        const column = parserError.token.startColumn;
        const location = line != null ? `Line ${line}${column != null ? `:${column}` : ''}: ` : '';
        addDiagnostic(model, {
          message: `${sourcePrefix}${location}${parserError.message}`,
          sourceName: source.sourceName,
          ...(line != null && column != null
            ? {
                range: {
                  start: { line, column },
                  end: {
                    line: parserError.token.endLine ?? line,
                    column: (parserError.token.endColumn ?? column) + 1
                  }
                }
              }
            : {})
        });
      }
    }

    if (model.contexts.length === 0 && sources.some((source) => source.text.trim().length > 0)) {
      addDiagnostic(model, {
        message: 'No context block found. Start with: domain MyDomain { context MyContext { ... } }',
        sourceName: sources[0]?.sourceName,
        range: pointRange(1, 1)
      });
    }

    validateReferences(model);
    const semanticMessages = validateSemanticModel(ast, model);
    const semanticDetails = locateSemanticDiagnostics(
      ast,
      semanticMessages,
      (node: AstNode) => node.$cstNode ? sourceNamesByRoot.get(node.$cstNode.root) : undefined
    );
    for (const diagnostic of semanticDetails) addDiagnostic(model, diagnostic);
    refreshEdgeIds(model);
    dedupeEdges(model);
    return model;
  } catch (error) {
    const model = emptyModel();
    addDiagnostic(model, {
      message: error instanceof Error ? error.message : 'Unable to parse current MEDOL'
    });
    return model;
  }
};

const addDiagnostic = (model: EmModel, diagnostic: MedolDiagnostic): void => {
  model.diagnostics.push(diagnostic.message);
  model.diagnosticDetails.push(diagnostic);
};

const pointRange = (line: number, column: number, length = 1) => ({
  start: { line, column },
  end: { line, column: column + Math.max(length, 1) }
});

export const parseEventModelingDsl = parseMedol;

export interface MedolImportReference {
  path?: string;
  module?: string;
  alias?: string;
  deployment?: string;
}

export const readMedolImports = (text: string): MedolImportReference[] => {
  const parseResult = medolServices.parser.LangiumParser.parse<AstModel>(text);
  return (parseResult.value.imports ?? []).map((item) => ({
    ...(item.path ? { path: item.path } : {}),
    ...(item.module ? { module: item.module } : {}),
    ...(item.alias ? { alias: item.alias } : {}),
    ...(item.deployment ? { deployment: item.deployment } : {})
  }));
};

const mergeAstModels = (models: AstModel[]): AstModel => {
  const merged = models[models.length - 1] ?? medolServices.parser.LangiumParser.parse<AstModel>('').value;
  const domainGroups = models.map((model) => [...(model.domains ?? [])]);
  const contextGroups = models.map((model) => [...(model.contexts ?? [])]);
  const deploymentGroups = models.map((model) => [...(model.deployments ?? [])]);
  const frontendApplicationGroups = models.map((model) => [...(model.frontendApplications ?? [])]);
  merged.imports = models.flatMap((model) => model.imports ?? []);
  merged.domains = [];
  merged.contexts = [];
  merged.deployments = [];
  merged.frontendApplications = [];

  const domains = new Map<string, AstDomain>();
  const looseContexts = new Map<string, AstContext>();
  const looseDeployments = new Map<string, AstDeployment>();
  const looseFrontendApplications = new Map<string, AstFrontendApplication>();
  for (let index = models.length - 1; index >= 0; index -= 1) {
    for (const domain of domainGroups[index]) {
      const existing = domains.get(domain.name);
      if (!existing) {
        domain.contexts = [...(domain.contexts ?? [])];
        domain.deployments = [...(domain.deployments ?? [])];
        domain.frontendApplications = [...(domain.frontendApplications ?? [])];
        domains.set(domain.name, domain);
        merged.domains.push(domain);
      } else {
        mergeContexts(existing.contexts, domain.contexts ?? []);
        mergeDeployments(existing.deployments, domain.deployments ?? []);
        mergeFrontendApplications(existing.frontendApplications, domain.frontendApplications ?? []);
      }
    }
    mergeContexts(merged.contexts, contextGroups[index], looseContexts);
    mergeDeployments(merged.deployments, deploymentGroups[index], looseDeployments);
    mergeFrontendApplications(merged.frontendApplications, frontendApplicationGroups[index], looseFrontendApplications);
  }
  return merged;
};

const mergeContexts = (
  target: AstContext[],
  additions: AstContext[],
  existing = new Map(target.map((context) => [context.name, context]))
): void => {
  for (const context of additions) {
    const current = existing.get(context.name);
    if (current) {
      appendUniqueNamedAstNodes(current.elements, context.elements ?? []);
    } else {
      context.elements = [...(context.elements ?? [])];
      target.push(context);
      existing.set(context.name, context);
    }
  }
};

const astNodeKey = (node: AstNode): string | undefined => {
  const named = node as AstNode & { name?: string };
  return named.name ? `${named.$type}:${named.name}` : undefined;
};

const appendUniqueNamedAstNodes = (target: AstNode[], additions: AstNode[]): void => {
  const seen = new Set(target.map(astNodeKey).filter((key): key is string => Boolean(key)));
  for (const addition of additions) {
    const key = astNodeKey(addition);
    if (key && seen.has(key)) continue;
    target.push(addition);
    if (key) seen.add(key);
  }
};

const mergeDeployments = (
  target: AstDeployment[],
  additions: AstDeployment[],
  existing = new Map(target.map((deployment) => [deployment.name, deployment]))
): void => {
  for (const deployment of additions) {
    const current = existing.get(deployment.name);
    if (current) {
      appendUniqueDeploymentContexts(current.contexts, deployment.contexts ?? []);
    } else {
      deployment.contexts = [...(deployment.contexts ?? [])];
      target.push(deployment);
      existing.set(deployment.name, deployment);
    }
  }
};

const appendUniqueDeploymentContexts = (target: string[], additions: string[]): void => {
  const seen = new Set(target);
  for (const addition of additions) {
    if (seen.has(addition)) continue;
    target.push(addition);
    seen.add(addition);
  }
};

const mergeFrontendApplications = (
  target: AstFrontendApplication[],
  additions: AstFrontendApplication[],
  existing = new Map(target.map((application) => [application.name, application]))
): void => {
  for (const application of additions) {
    const current = existing.get(application.name);
    if (current) {
      appendUniqueFrontendIncludes(current.includes, application.includes ?? []);
    } else {
      application.includes = [...(application.includes ?? [])];
      target.push(application);
      existing.set(application.name, application);
    }
  }
};

const frontendIncludeKey = (include: { context?: string; slice?: string }): string => {
  return `${include.context ?? ''}.${include.slice ?? '*'}:${'backend' in include ? include.backend ?? '' : ''}`;
};

const appendUniqueFrontendIncludes = (
  target: Array<{ context?: string; slice?: string }>,
  additions: Array<{ context?: string; slice?: string }>
): void => {
  const seen = new Set(target.map(frontendIncludeKey));
  for (const addition of additions) {
    const key = frontendIncludeKey(addition);
    if (seen.has(key)) continue;
    target.push(addition);
    seen.add(key);
  }
};

export const astToEmModel = (ast: AstModel): EmModel => {
  const model = emptyModel();
  const deploymentsByName = new Map<string, EmDeployment>();
  const frontendApplicationsByName = new Map<string, EmFrontendApplication>();
  const addDeployment = (deployment: EmDeployment): void => {
    const current = deploymentsByName.get(deployment.name);
    if (current) {
      current.contexts = [...new Set([...current.contexts, ...deployment.contexts])];
      return;
    }
    deploymentsByName.set(deployment.name, deployment);
    model.deployments.push(deployment);
  };
  const addFrontendApplication = (application: EmFrontendApplication): void => {
    const current = frontendApplicationsByName.get(application.name);
    if (current) {
      const existingKeys = new Set(current.includes.map((include) => `${include.context}.${include.slice ?? '*'}:${include.backend ?? ''}`));
      for (const include of application.includes) {
        const key = `${include.context}.${include.slice ?? '*'}:${include.backend ?? ''}`;
        if (!existingKeys.has(key)) {
          current.includes.push(include);
          existingKeys.add(key);
        }
      }
      return;
    }
    frontendApplicationsByName.set(application.name, application);
    model.frontendApplications.push(application);
  };

  for (const domainNode of ast.domains ?? []) {
    const domain = parseDomain(domainNode, model.edges);
    model.domains.push(domain);
    model.contexts.push(...domain.contexts);
    domain.deployments.forEach(addDeployment);
    domain.frontendApplications.forEach(addFrontendApplication);
  }

  for (const contextNode of ast.contexts ?? []) {
    model.contexts.push(parseContext(contextNode, undefined, model.edges));
  }

  for (const deploymentNode of ast.deployments ?? []) {
    addDeployment(parseDeployment(deploymentNode, undefined));
  }

  for (const frontendApplicationNode of ast.frontendApplications ?? []) {
    addFrontendApplication(parseFrontendApplication(frontendApplicationNode, undefined));
  }

  return model;
};

const parseDomain = (node: AstDomain, edges: EmEdge[]): EmDomain => {
  const domain: EmDomain = {
    id: scopedId('domain', safeName(node.name, 'UnnamedDomain')),
    name: safeName(node.name, 'UnnamedDomain'),
    ...withSourceRange(node),
    contexts: [],
    deployments: [],
    frontendApplications: []
  };

  for (const contextNode of node.contexts ?? []) {
    domain.contexts.push(parseContext(contextNode, domain.id, edges));
  }
  for (const deploymentNode of node.deployments ?? []) {
    domain.deployments.push(parseDeployment(deploymentNode, domain.name));
  }
  for (const frontendApplicationNode of node.frontendApplications ?? []) {
    domain.frontendApplications.push(parseFrontendApplication(frontendApplicationNode, domain.name));
  }

  return domain;
};

const parseDeployment = (node: AstDeployment, domainName: string | undefined): EmDeployment => ({
  id: domainName ? scopedId('deployment', `${domainName}/${safeName(node.name, 'UnnamedDeployment')}`) : scopedId('deployment', safeName(node.name, 'UnnamedDeployment')),
  name: safeName(node.name, 'UnnamedDeployment'),
  ...(domainName ? { domain: domainName } : {}),
  ...withSourceRange(node),
  contexts: (node.contexts ?? []).map((item) => safeName(item.context, 'UnnamedContext'))
});

const parseFrontendApplication = (
  node: AstFrontendApplication,
  domainName: string | undefined
): EmFrontendApplication => ({
  id: domainName ? scopedId('frontend', `${domainName}/${safeName(node.name, 'UnnamedFrontend')}`) : scopedId('frontend', safeName(node.name, 'UnnamedFrontend')),
  name: safeName(node.name, 'UnnamedFrontend'),
  ...(domainName ? { domain: domainName } : {}),
  ...withSourceRange(node),
  includes: (node.includes ?? []).map((item) => ({
    context: safeName(item.context, 'UnnamedContext'),
    ...(item.slice ? { slice: safeName(item.slice, 'UnnamedSlice') } : {}),
    ...(item.backend ? { backend: safeName(item.backend, 'UnnamedBackend') } : {})
  }))
});

const parseContext = (node: AstContext, domainId: string | undefined, edges: EmEdge[]): EmContext => {
  const contextName = safeName(node.name, 'UnnamedContext');
  const context: EmContext = {
    id: domainId ? `${domainId}/context/${contextName}` : scopedId('context', contextName),
    name: contextName,
    ...withSourceRange(node),
    valueTypes: [],
    aggregates: [],
    slices: [],
    concepts: [],
    externalSystems: [],
    looseElements: [],
    notes: [],
    risks: [],
    decisions: [],
    metrics: []
  };

  for (const element of node.elements ?? []) {
    if (isValueType(element)) {
      context.valueTypes.push(parseValueType(element, context.id));
      continue;
    }
    if (isEnumType(element)) {
      context.valueTypes.push(parseEnumType(element, context.id));
      continue;
    }
    if (isStructuredValueType(element)) {
      context.valueTypes.push(parseStructuredValueType(element, context.id));
      continue;
    }
    if (isSlice(element)) {
      context.slices.push(parseSlice(element, context.id, edges));
      continue;
    }
    if (isConcept(element)) {
      context.concepts.push(parseConcept(element, context.id));
      continue;
    }
    if (isExternal(element)) {
      context.externalSystems.push(parseExternalSystem(element, context.id));
      continue;
    }
    if (isNote(element)) {
      context.notes.push(element.value);
      continue;
    }
    if (isRisk(element)) {
      context.risks.push(element.value);
      continue;
    }
    if (isDecision(element)) {
      context.decisions.push(element.value);
      continue;
    }
    if (isMetric(element)) {
      context.metrics.push(element.name);
      continue;
    }
    if (isIntegration(element) || isReadModel(element) || isAutomation(element)) {
      const looseElement = parseElement(element, context.id);
      context.looseElements.push(looseElement);
      collectElementEdges(element, looseElement.id, edges);
    }
  }

  const slicesByName = new Map(allContextSlices(context).map((slice) => [slice.name, slice.id]));
  for (const concept of context.concepts) {
    concept.sliceIds = concept.sliceNames
      .map((sliceName) => slicesByName.get(sliceName))
      .filter((sliceId): sliceId is string => Boolean(sliceId));
  }

  return context;
};

const parseExternalSystem = (node: AstExternal, contextId: string): EmExternalSystem => {
  const name = safeName(node.name, 'UnnamedExternal');
  const kind = formatExternalToken(node.elements.find(isExternalKind)?.value);
  const protocol = formatExternalToken(node.elements.find(isExternalProtocol)?.value);
  const endpoint = node.elements.find(isExternalEndpoint);
  const capabilities = node.elements
    .filter(isExternalCapabilities)
    .flatMap((group) => group.capabilities ?? [])
    .map((capability) => ({
      type: capability.type,
      name: safeName(capability.name, 'UnnamedCapability')
    }));

  return {
    id: `${contextId}/external/${name}`,
    name,
    ...withSourceRange(node),
    ...(kind ? { kind } : {}),
    ...(protocol ? { protocol } : {}),
    ...(endpoint?.configKey ? { endpoint: { type: 'config', key: endpoint.configKey } as const } : {}),
    capabilities
  };
};

const formatExternalToken = (token: AstExternalToken | undefined): string | undefined => {
  const value = token?.parts?.join('-');
  return value || undefined;
};

const parseValueType = (node: AstValueType, contextId: string): EmValueType => {
  const name = safeName(node.name, 'UnnamedType');
  return {
    id: `${contextId}/type/${name}`,
    name,
    ...withSourceRange(node),
    kind: 'scalar',
    baseType: safeName(node.baseType, 'String'),
    constraints: (node.constraints ?? []).map(parseValueTypeConstraint),
    values: [],
    fields: []
  };
};

const parseEnumType = (node: AstEnumType, contextId: string): EmValueType => {
  const name = safeName(node.name, 'UnnamedEnum');
  return {
    id: `${contextId}/type/${name}`,
    name,
    ...withSourceRange(node),
    kind: 'enum',
    baseType: 'String',
    constraints: [],
    values: [...(node.values ?? [])],
    fields: []
  };
};

const parseStructuredValueType = (node: AstStructuredValueType, contextId: string): EmValueType => {
  const name = safeName(node.name, 'UnnamedValue');
  return {
    id: `${contextId}/type/${name}`,
    name,
    ...withSourceRange(node),
    kind: 'object',
    baseType: name,
    constraints: [],
    values: [],
    fields: (node.fields ?? []).map(parseField)
  };
};

const parseValueTypeConstraint = (constraint: ValueTypeConstraint): EmValueTypeConstraint => {
  if (isTypeFormatConstraint(constraint)) {
    return { kind: 'format', format: constraint.format };
  }
  if (isTypeLengthConstraint(constraint)) {
    return { kind: 'length', min: constraint.min, max: constraint.max };
  }
  if (isTypeRangeConstraint(constraint)) {
    return { kind: 'range', min: constraint.min, max: constraint.max };
  }
  if (isTypeMatchesConstraint(constraint)) {
    return { kind: 'matches', pattern: constraint.pattern };
  }
  if (isTypeOneOfConstraint(constraint)) {
    return {
      kind: 'oneOf',
      values: constraint.values.map(literalValue)
    };
  }
  throw new Error('Unsupported value type constraint');
};

const parseConcept = (node: AstConcept, contextId: string): EmConcept => {
  const name = safeName(node.name, 'UnnamedConcept');
  return {
    id: `${contextId}/concept/${name}`,
    name,
    ...withSourceRange(node),
    states: (node.features ?? [])
      .filter(isState)
      .map((state) => safeName(state.name, 'UnnamedState')),
    sliceNames: (node.features ?? [])
      .filter((feature) => !isState(feature))
      .map((sliceRef) => sliceRef.slice?.$refText)
      .filter((sliceName): sliceName is string => Boolean(sliceName)),
    sliceIds: []
  };
};

const parseSlice = (node: AstSlice, scopeId: string, edges: EmEdge[]): EmSlice => {
  const sliceName = safeName(node.name, 'UnnamedSlice');
  const elements = node.elements ?? [];
  const sliceId = `${scopeId}/slice/${sliceName}`;
  const tags = elements.find(isSliceTags)?.tags ?? [];
  const slice: EmSlice = {
    id: sliceId,
    name: sliceName,
    ...withSourceRange(node),
    startsLifecycle: elements.some(isStartsLifecycleMarker),
    port: elements.some(isPortMarker),
    resultingState: elements.find(isState)?.name,
    tags: tags.map((tag) => ({
      name: tag.name,
      ...(tag.expression ? { expression: formatTagExpression(tag.expression) } : {})
    })),
    hotspots: elements.filter(isHotspot).map((hotspot) => hotspot.value),
    elements: []
  };

  const actorRef = elements.find(isActorRef);
  if (actorRef) {
    slice.elements.push({
      id: `${sliceId}/actor/${actorRef.actor}`,
      kind: 'actor',
      name: actorRef.actor,
      fields: [],
      ...withSourceRange(actorRef),
      sliceId
    });
  }

  const uiRefs = elements.filter(isUiRef);
  for (const uiRef of uiRefs) {
    slice.elements.push({
      id: `${sliceId}/screen/${uiRef.view}`,
      kind: 'screen',
      name: uiRef.view,
      fields: [],
      ...withSourceRange(uiRef),
      sliceId,
      ...(parseUi(uiRef) ? { ui: parseUi(uiRef) } : {})
    });
  }

  for (const element of elements) {
    if (isSpecification(element) && element.scenarios.length > 0) {
      for (const scenario of element.scenarios) {
        const parsed = parseScenarioElement(element, scenario, sliceId);
        slice.elements.push(parsed);
        collectScenarioEdges(scenario, parsed.id, edges);
      }
      continue;
    }
    if (isCommand(element) || isEvent(element) || isReadModel(element) || isAutomation(element) || isSpecification(element)) {
      const parsed = parseElement(element, sliceId);
      slice.elements.push(parsed);
      collectElementEdges(element, parsed.id, edges);
    }
  }

  const reactsTo = elements.find(isReactsTo)?.event?.$refText;
  const firstReactionElement = slice.elements.find((element) =>
    element.kind === 'readmodel' || element.kind === 'automation' || element.kind === 'command'
  );
  if (reactsTo && firstReactionElement) {
    edges.push(edge(`ref/event/${reactsTo}`, firstReactionElement.id, 'reactsTo'));
  }

  const screens = slice.elements.filter((element) => element.kind === 'screen');
  const command = slice.elements.find((element) => element.kind === 'command');
  const event = slice.elements.find((element) => element.kind === 'event');

  for (const screen of screens) {
    if (command) {
      edges.push(edge(screen.id, command.id, 'invokes'));
    }
  }
  if (command && event) {
    edges.push(edge(command.id, event.id, 'emits'));
  }
  return slice;
};

const parseScenarioElement = (
  specification: AstSpecification,
  scenario: AstScenario,
  sliceId: string
): EmElement => ({
  id: `${sliceId}/gwt/${safeName(specification.name, 'UnnamedSpecification')}/${safeName(scenario.name, 'UnnamedScenario')}`,
  kind: 'gwt',
  name: safeName(scenario.name, 'UnnamedScenario'),
  fields: [],
  ...withSourceRange(scenario),
  sliceId,
  metadata: {
    specification: safeName(specification.name, 'UnnamedSpecification'),
    ...(specification.rule ? { rule: normalizeMultilineString(specification.rule) } : {}),
    ...Object.fromEntries(
      specification.expressions.map((expression, index) => [`expression${index + 1}`, formatValidationExpression(expression)])
    ),
    ...parseScenarioMetadata(scenario)
  }
});

const parseScenarioMetadata = (
  scenario: Pick<AstScenario, 'givens' | 'when' | 'then'>
): Record<string, string> => {
  const metadata: Record<string, string> = {};
  scenario.givens.forEach((given, index) => {
    const givenIndex = index + 1;
    if (given.event?.$refText) metadata[`given${givenIndex}`] = given.event.$refText;
    for (const assignment of given.condition?.assignments ?? []) {
      metadata[`givenExample:${givenIndex}:${assignment.field}`] = formatLiteral(assignment.value);
    }
  });
  if (scenario.when?.command?.$refText) metadata.when = scenario.when.command.$refText;
  if (scenario.then?.event?.$refText) metadata.then = scenario.then.event.$refText;
  if (scenario.then?.rejection) metadata.thenReject = scenario.then.rejection;
  if (scenario.then?.error) metadata.thenError = scenario.then.error;
  for (const assignment of scenario.when?.condition?.assignments ?? []) {
    metadata[`example:${assignment.field}`] = formatLiteral(assignment.value);
  }
  return metadata;
};

const collectScenarioEdges = (scenario: AstScenario, sourceId: string, edges: EmEdge[]): void => {
  for (const given of scenario.givens) {
    if (given.event?.$refText) edges.push(edge(`ref/event/${given.event.$refText}`, sourceId, 'given'));
  }
  if (scenario.when?.command?.$refText) edges.push(edge(`ref/command/${scenario.when.command.$refText}`, sourceId, 'when'));
  if (scenario.then?.event?.$refText) edges.push(edge(sourceId, `ref/event/${scenario.then.event.$refText}`, 'then'));
};

const normalizeMultilineString = (value: string): string => {
  const content = value.startsWith('"""') && value.endsWith('"""') ? value.slice(3, -3) : value;
  const lines = content
    .replace(/^\s*\r?\n/, '')
    .replace(/\r?\n\s*$/, '')
    .split(/\r?\n/);
  const indents = lines.filter((line) => line.trim()).map((line) => line.match(/^\s*/)?.[0].length ?? 0);
  const indentation = indents.length > 0 ? Math.min(...indents) : 0;
  return lines.map((line) => line.slice(indentation)).join('\n').trim();
};

const formatValidationExpression = (expression: ValidationExpression): string => {
  switch (expression.$type) {
    case 'UniqueValidation':
      return expression.target
        ? `unique ${formatFieldSource(expression.target)}`
        : `unique (${expression.targets.map(formatFieldSource).join(', ')})`;
    case 'AssertValidation':
      return `assert ${formatValidationOperand(expression.left)} ${expression.operator} ${formatValidationOperand(expression.right)}`;
  }
};

const formatValidationOperand = (operand: ValidationOperand): string =>
  operand.$type === 'FieldSource' ? formatFieldSource(operand) : formatValidationLiteral(operand);

const formatValidationLiteral = (literal: Expression): string =>
  isStringLiteral(literal) ? JSON.stringify(literal.value) : formatLiteral(literal);

const formatTagExpression = (expression: TagExpression): string => {
  if (expression.$type === 'TagReference') {
    return expression.parts.join('.');
  }
  return `${expression.function}(${expression.arguments.map(formatTagExpression).join(', ')})`;
};

const parseUi = (uiRef: AstUiRef): EmUi | undefined => {
  if (!uiRef.type) return undefined;

  return {
    type: uiRef.type
  };
};

const parseElement = (
  node: AstCommand | AstEvent | AstReadModel | AstAutomation | AstSpecification | AstIntegration,
  scopeId: string
): EmElement => {
  const kind = isReadModel(node)
    ? 'readmodel'
    : isSpecification(node)
      ? 'gwt'
      : node.$type.toLowerCase();

  return {
    id: `${scopeId}/${kind}/${safeName(node.name, 'UnnamedElement')}`,
    kind: kind as EmElement['kind'],
    name: safeName(node.name, 'UnnamedElement'),
    fields: parseElementFields(node),
    ...(isCommand(node) ? { resultFields: parseCommandResultFields(node) } : {}),
    ...withSourceRange(node),
    ...(isReadModel(node) && node.listElement ? { listElement: true } : {}),
    ...(isReadModel(node) && node.todo ? { todo: true } : {}),
    ...(isReadModel(node) && node.sync ? { sync: true } : {}),
    ...(isReadModel(node) && node.source ? { syncSource: formatFieldSource(node.source) } : {}),
    ...(isReadModel(node) && node.syncFilters?.length ? {
      syncFilters: node.syncFilters.map((filter) => ({
        target: formatFieldSource(filter.target),
        source: formatFieldSource(filter.source)
      }))
    } : {}),
    sliceId: scopeId.includes('/slice/') ? scopeId : undefined,
    metadata: parseElementMetadata(node),
    ...(isReadModel(node) ? parseReadModelDictionaryProvider(node) : {})
  };
};

const parseElementFields = (node: AstCommand | AstEvent | AstReadModel | AstAutomation | AstSpecification | AstIntegration): EmField[] => {
  if (isCommand(node)) {
    return (node.elements ?? []).filter(isField).map(parseField);
  }
  if (isEvent(node)) {
    return (node.fields ?? []).map(parseField);
  }
  if (isReadModel(node)) {
    return (node.elements ?? []).filter(isField).map(parseField);
  }
  if (isIntegration(node)) {
    return parseIntegrationFields(node);
  }
  return [];
};

const parseCommandResultFields = (node: AstCommand): EmField[] => (
  (node.elements ?? [])
    .filter(isCommandResult)
    .flatMap((result) => (result.fields ?? []).map(parseField))
);

const parseIntegrationFields = (node: AstIntegration): EmField[] => {
  const fields: EmField[] = [];
  const source = node.elements.find(isSource)?.system;
  const target = node.elements.find(isTarget)?.system;
  if (source) fields.push({ name: 'source', type: source, cardinality: 'Single', attributes: [] });
  if (target) fields.push({ name: 'target', type: target, cardinality: 'Single', attributes: [] });
  return fields;
};

const parseField = (field: AstField): EmField => {
  const mapping = parseFieldMapping(field);
  return {
    name: safeName(field.name, 'unnamedField'),
    type: safeName(field.type, 'Unknown'),
    ...withSourceRange(field),
    cardinality: field.cardinality === '[]?'
      ? 'OptionalList'
      : field.cardinality === '[]'
        ? 'List'
        : field.cardinality === '?'
          ? 'Optional'
          : 'Single',
    attributes: [...(field.attributes ?? [])],
    ...(field.details?.example ? { example: field.details.example } : {}),
    ...(field.dictionary ? { dictionary: field.dictionary } : {}),
    ...(mapping ? { mapping } : {})
  };
};

const withSourceRange = (node: AstNode): { sourceRange?: MedolSourceRange } => {
  const range = node.$cstNode?.range;
  if (!range) return {};
  return {
    sourceRange: {
      start: {
        line: range.start.line + 1,
        column: range.start.character + 1
      },
      end: {
        line: range.end.line + 1,
        column: range.end.character + 1
      }
    }
  };
};

const parseFieldMapping = (field: AstField): EmFieldMapping | undefined => {
  const detailSources = field.details?.sources?.map(formatFieldSource) ?? [];
  const rule = field.details?.rule;
  const lookup = parseDerivedLookup(field);

  if (field.mapping) {
    const mappingSources = (field.mapping.sources ?? []).map(formatFieldSource);
    return {
      kind: isFieldDerivation(field.mapping) ? 'derived' : 'from',
      sources: detailSources.length > 0 ? detailSources : mappingSources,
      ...(rule ? { rule } : {}),
      ...(lookup ? { lookup } : {})
    };
  }

  if (detailSources.length > 0 || rule || lookup) {
    return {
      kind: rule || lookup ? 'derived' : 'from',
      sources: detailSources,
      ...(rule ? { rule } : {}),
      ...(lookup ? { lookup } : {})
    };
  }

  return undefined;
};

const formatFieldSource = (source: FieldSource): string => source.parts.join('.');

const parseReadModelDictionaryProvider = (node: AstReadModel): { dictionaryProvider?: EmDictionaryProvider } => {
  const provider = node.elements.find(isDictionaryProvider);
  if (!provider) return {};

  const mapping = Object.fromEntries(
    provider.mappings.map((item) => [item.kind, item.field])
  ) as Omit<EmDictionaryProvider, 'name'>;
  return {
    dictionaryProvider: {
      name: safeName(provider.name, 'DictionaryProvider'),
      ...mapping
    }
  };
};

const parseDerivedLookup = (field: AstField): EmDerivedLookup | undefined => {
  const inlineLookupKey = field.mapping && isFieldDerivation(field.mapping) ? field.mapping.lookupKey : undefined;
  if (inlineLookupKey) {
    const source = field.mapping.sources?.[0];
    const sourceParts = source?.parts ?? [];
    const lookupKeys = formatLookupKeys(inlineLookupKey);
    return {
      ...(lookupKeys[0] ? { key: lookupKeys[0] } : {}),
      ...(lookupKeys.length > 1 ? { keys: lookupKeys } : {}),
      ...(sourceParts.length > 1 ? { cacheProjection: sourceParts[0] } : {}),
      ...(source ? { sourceField: sourceParts.length > 1 ? sourceParts.slice(1).join('.') : formatFieldSource(source) } : {}),
      targetField: safeName(field.name, 'unnamedField'),
      missingValuePolicy: 'keep'
    };
  }

  const details = field.details;
  if (!details) return undefined;

  const lookup: EmDerivedLookup = {
    ...formatLookupKeyMetadata(details.lookupKey),
    ...(details.sourceEvent ? { sourceEvent: details.sourceEvent } : {}),
    ...(details.sourceField ? { sourceField: formatFieldSource(details.sourceField) } : {}),
    ...(details.targetField ? { targetField: formatFieldSource(details.targetField) } : {}),
    ...(details.cacheProjection ? { cacheProjection: details.cacheProjection } : {}),
    ...(details.cacheStrategy ? { cacheStrategy: details.cacheStrategy } : {}),
    ...(details.missingValuePolicy ? { missingValuePolicy: details.missingValuePolicy } : {})
  };
  return Object.keys(lookup).length > 0 ? lookup : undefined;
};

const formatLookupKeyMetadata = (lookupKey: AstLookupKey | undefined): Pick<EmDerivedLookup, 'key' | 'keys'> => {
  const keys = lookupKey ? formatLookupKeys(lookupKey) : [];
  return {
    ...(keys[0] ? { key: keys[0] } : {}),
    ...(keys.length > 1 ? { keys } : {})
  };
};

const formatLookupKeys = (lookupKey: AstLookupKey): string[] => {
  return lookupKey.keys.map(formatFieldSource);
};

const parseElementMetadata = (node: AstCommand | AstEvent | AstReadModel | AstAutomation | AstSpecification | AstIntegration): Record<string, string> => {
  const metadata: Record<string, string> = {};

  if (isAutomation(node)) {
    (node.elements ?? []).filter(isAutomationTrigger).forEach((trigger, index) => {
      const prefix = index === 0 ? '' : `${index + 1}`;
      if (trigger.todo?.$refText) {
        metadata[`on${prefix}`] = trigger.todo.$refText;
        metadata[`on${prefix}Kind`] = 'todo';
      } else if (trigger.event?.$refText) {
        metadata[`on${prefix}`] = trigger.event.$refText;
        metadata[`on${prefix}Kind`] = 'event';
      }
    });
    (node.elements ?? []).filter(isCondition).forEach((condition, index) => {
      metadata[index === 0 ? 'condition' : `condition${index + 1}`] = formatLiteral(condition.expression);
    });
    (node.elements ?? []).filter(isFanOut).forEach((fanOut, index) => {
      const prefix = index === 0 ? '' : `${index + 1}`;
      metadata[`fanOutSource${prefix}`] = formatFieldSource(fanOut.source);
      metadata[`fanOutAlias${prefix}`] = fanOut.alias;
    });
    (node.elements ?? []).filter((element) => element.$type === 'Emits').forEach((emits, index) => {
      if (emits.command?.$refText) metadata[index === 0 ? 'emits' : `emits${index + 1}`] = emits.command.$refText;
    });
  }

  if (isSpecification(node)) {
    (node.givens ?? []).forEach((given, index) => {
      const givenIndex = index + 1;
      if (given.event?.$refText) metadata[`given${givenIndex}`] = given.event.$refText;
      for (const assignment of given.condition?.assignments ?? []) {
        metadata[`givenExample:${givenIndex}:${assignment.field}`] = formatLiteral(assignment.value);
      }
    });
    if (node.when?.command?.$refText) metadata.when = node.when.command.$refText;
    if (node.then?.event?.$refText) metadata.then = node.then.event.$refText;
    if (node.then?.rejection) metadata.thenReject = node.then.rejection;
    if (node.then?.error) metadata.thenError = node.then.error;
    for (const assignment of node.when?.condition?.assignments ?? []) {
      metadata[`example:${assignment.field}`] = formatLiteral(assignment.value);
    }
  }

  return metadata;
};

const collectElementEdges = (
  node: AstCommand | AstEvent | AstReadModel | AstAutomation | AstSpecification | AstIntegration,
  sourceId: string,
  edges: EmEdge[]
): void => {
  if (isReadModel(node)) {
    for (const subscription of (node.elements ?? []).filter(isSubscription)) {
      if (subscription.event?.$refText) edges.push(edge(`ref/event/${subscription.event.$refText}`, sourceId, 'updates'));
    }
  }

  if (isAutomation(node)) {
    for (const trigger of (node.elements ?? []).filter(isAutomationTrigger)) {
      if (trigger.todo?.$refText) {
        edges.push(edge(`ref/readmodel/${trigger.todo.$refText}`, sourceId, 'triggers'));
      } else if (trigger.event?.$refText) {
        edges.push(edge(`ref/event/${trigger.event.$refText}`, sourceId, 'triggers'));
      }
    }
    for (const emits of (node.elements ?? []).filter((element) => element.$type === 'Emits')) {
      if (emits.command?.$refText) edges.push(edge(sourceId, `ref/command/${emits.command.$refText}`, 'emits'));
    }
  }

  if (isSpecification(node)) {
    for (const given of node.givens ?? []) {
      if (given.event?.$refText) edges.push(edge(`ref/event/${given.event.$refText}`, sourceId, 'given'));
    }
    if (node.when?.command?.$refText) edges.push(edge(`ref/command/${node.when.command.$refText}`, sourceId, 'when'));
    if (node.then?.event?.$refText) edges.push(edge(sourceId, `ref/event/${node.then.event.$refText}`, 'then'));
  }

  if (isIntegration(node)) {
    for (const element of node.elements ?? []) {
      if (element.$type === 'Emits') {
        if (element.command?.$refText) edges.push(edge(sourceId, `ref/command/${element.command.$refText}`, 'emits'));
      }
      if (isReactsTo(element)) {
        if (element.event?.$refText) edges.push(edge(`ref/event/${element.event.$refText}`, sourceId, 'reactsTo'));
      }
    }
  }
};

const formatLiteral = (value: Expression): string => {
  if (isStringLiteral(value)) return value.value;
  if (isNumberLiteral(value)) return String(value.value);
  if (isBooleanLiteral(value)) return value.value;
  if (isNullLiteral(value)) return 'null';
  if (isRefExpr(value)) return value.ref.$refText;
  if (isBinaryExpr(value)) return `${formatLiteral(value.left)} ${value.operator} ${formatLiteral(value.right)}`;
  return '';
};

const literalValue = (value: Expression): string | number | boolean | null => {
  if (isStringLiteral(value) || isNumberLiteral(value)) return value.value;
  if (isBooleanLiteral(value)) return value.value === 'true';
  return null;
};

const validateReferences = (model: EmModel): void => {
  const elements = flattenElements(model);
  const byContextKindAndName = new Map<string, string[]>();
  const byKindAndName = new Map<string, string[]>();

  for (const element of elements) {
    const contextId = contextIdFromElementId(element.id);
    const key = `${contextId}/${element.kind}/${element.name}`;
    byContextKindAndName.set(key, [...(byContextKindAndName.get(key) ?? []), element.id]);
    const globalKey = `${element.kind}/${element.name}`;
    byKindAndName.set(globalKey, [...(byKindAndName.get(globalKey) ?? []), element.id]);
  }

  for (const edgeItem of model.edges) {
    if (edgeItem.source.startsWith('ref/')) {
      const [, kind, name] = edgeItem.source.split('/');
      const contextId = contextIdFromElementId(edgeItem.target);
      const local = byContextKindAndName.get(`${contextId}/${kind}/${name}`);
      const resolved = local?.length ? local : byKindAndName.get(`${kind}/${name}`);
      if (resolved?.length === 1) edgeItem.source = resolved[0];
    }
    if (edgeItem.target.startsWith('ref/')) {
      const [, kind, name] = edgeItem.target.split('/');
      const contextId = contextIdFromElementId(edgeItem.source);
      const local = byContextKindAndName.get(`${contextId}/${kind}/${name}`);
      const resolved = local?.length ? local : byKindAndName.get(`${kind}/${name}`);
      if (resolved?.length === 1) edgeItem.target = resolved[0];
    }
  }
};

const contextIdFromElementId = (id: string): string => {
  const marker = '/context/';
  const markerIndex = id.indexOf(marker);
  if (markerIndex < 0) return id.split('/').slice(0, 2).join('/');
  const contextNameEnd = id.indexOf('/', markerIndex + marker.length);
  return contextNameEnd < 0 ? id : id.slice(0, contextNameEnd);
};

export const flattenElements = (model: EmModel): EmElement[] =>
  model.contexts.flatMap((context) => [
    ...context.looseElements,
    ...context.slices.flatMap((slice) => slice.elements)
  ]);

export const allContextSlices = (context: EmContext): EmSlice[] => [
  ...context.slices
];

const dedupeEdges = (model: EmModel): void => {
  const seen = new Set<string>();
  model.edges = model.edges.filter((edgeItem) => {
    const key = `${edgeItem.source}->${edgeItem.target}:${edgeItem.label ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const refreshEdgeIds = (model: EmModel): void => {
  model.edges = model.edges.map((edgeItem) => ({
    ...edgeItem,
    id: formatEdgeId(edgeItem.source, edgeItem.target, edgeItem.label)
  }));
};

const edge = (source: string, target: string, label?: string): EmEdge => ({
  id: formatEdgeId(source, target, label),
  source,
  target,
  label
});

const formatEdgeId = (source: string, target: string, label?: string): string => `${source}->${target}:${label ?? ''}`;

const scopedId = (kind: string, name: string): string => `${kind}/${name}`;

const safeName = (value: string | undefined, fallback: string): string => {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
};
