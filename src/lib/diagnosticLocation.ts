import type { AstNode } from 'langium';
import type { Model as AstModel } from '../language/generated/ast';
import type { MedolDiagnostic, MedolSourceRange } from './model';

export type AstSourceNameResolver = (node: AstNode) => string | undefined;

export const locateSemanticDiagnostics = (
  ast: AstModel,
  messages: string[],
  sourceNameForNode: AstSourceNameResolver
): MedolDiagnostic[] => {
  const nodes = collectAstNodes(ast).filter((node) => Boolean(node.$cstNode));

  return messages.map((message) => {
    const node = findDiagnosticNode(nodes, message);
    return {
      message,
      ...(node ? { sourceName: sourceNameForNode(node), range: toSourceRange(node) } : {})
    };
  });
};

const collectAstNodes = (root: AstNode): AstNode[] => {
  const nodes: AstNode[] = [];
  const visited = new Set<AstNode>();
  const visit = (node: AstNode): void => {
    if (visited.has(node)) return;
    visited.add(node);
    nodes.push(node);
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith('$')) continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          if (isAstNodeValue(item)) visit(item);
        }
      } else if (isAstNodeValue(value)) {
        visit(value);
      }
    }
  };
  visit(root);
  return nodes;
};

const isAstNodeValue = (value: unknown): value is AstNode =>
  Boolean(value && typeof value === 'object' && typeof (value as AstNode).$type === 'string');

const findDiagnosticNode = (nodes: AstNode[], message: string): AstNode | undefined => {
  const duplicate = /\bduplicate (type|aggregate|concept|slice|state|tag|element|field|scenario|assignment) ([A-Za-z_][\w]*)\b/.exec(message);
  if (duplicate) {
    const duplicateTypes: Record<string, string[]> = {
      type: ['ValueType', 'EnumType', 'StructuredValueType'],
      aggregate: ['Aggregate'],
      concept: ['Concept'],
      slice: ['Slice'],
      state: ['State'],
      tag: ['SliceTag'],
      element: ['Command', 'Event', 'ReadModel', 'Automation', 'Integration'],
      field: ['Field'],
      scenario: ['Scenario'],
      assignment: ['Assignment']
    };
    const matches = nodes.filter((node) =>
      duplicateTypes[duplicate[1]]?.includes(node.$type)
      && nodeName(node) === duplicate[2]
    );
    if (matches.length > 1) return matches[1];
  }

  const fieldName = /\bfield ([A-Za-z_][\w]*)\b/.exec(message)?.[1]
    ?? /\bhas no field ([A-Za-z_][\w]*)\b/.exec(message)?.[1];
  if (fieldName) {
    const field = findNamedNode(nodes, 'Field', fieldName, message);
    if (field) return field;
  }

  const tagName = /\btag ([A-Za-z_][\w]*)\b/.exec(message)?.[1];
  if (tagName) {
    const tag = findNamedNode(nodes, 'SliceTag', tagName, message);
    if (tag) return tag;
  }

  const stateName = /\bstate ([A-Za-z_][\w]*)\b/.exec(message)?.[1];
  if (stateName) {
    const state = findNamedNode(nodes, 'State', stateName, message);
    if (state) return state;
  }

  const scenarioName = /scenario "([^"]+)"/.exec(message)?.[1];
  if (scenarioName) {
    const scenario = findNamedNode(nodes, 'Scenario', scenarioName, message);
    if (scenario) return scenario;
  }

  const specificationName = /Specification "([^"]+)"/.exec(message)?.[1];
  if (specificationName) {
    const specification = findNamedNode(nodes, 'Specification', specificationName, message);
    if (specification) return specification;
  }

  const typedPatterns: Array<[string, RegExp]> = [
    ['Context', /\bContext ([A-Za-z_][\w]*)/],
    ['Slice', /\bSlice ([A-Za-z_][\w]*)/],
    ['Aggregate', /\bAggregate ([A-Za-z_][\w]*)/],
    ['Concept', /\bConcept ([A-Za-z_][\w]*)/],
    ['StructuredValueType', /\bvalue ([A-Za-z_][\w]*)/],
    ['EnumType', /\benum ([A-Za-z_][\w]*)/],
    ['ValueType', /\btype ([A-Za-z_][\w]*)/]
  ];
  for (const [type, pattern] of typedPatterns) {
    const name = pattern.exec(message)?.[1];
    if (!name) continue;
    const node = findNamedNode(nodes, type, name, message);
    if (node) return node;
  }

  const elementMatch = /^(command|event|readmodel|automation|integration) ([A-Za-z_][\w]*)/.exec(message);
  if (elementMatch) {
    const type = elementMatch[1][0].toUpperCase() + elementMatch[1].slice(1);
    const node = findNamedNode(nodes, type, elementMatch[2], message);
    if (node) return node;
  }

  const referencedText = /\b(?:reference|operand|field path|field) ([A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*)/.exec(message)?.[1];
  if (referencedText) {
    const referenceNode = smallestTextMatch(nodes, referencedText);
    if (referenceNode) return referenceNode;
  }

  const unresolvedName = /\b(?:command|event|slice) ([A-Za-z_][\w]*)\b/.exec(message)?.[1];
  if (unresolvedName) {
    const referenceNode = smallestTextMatch(nodes, unresolvedName);
    if (referenceNode) return referenceNode;
  }

  return nodes
    .filter(hasName)
    .sort((left, right) => nodeDepth(right) - nodeDepth(left))
    .find((node) => message.includes(String(node.name)));
};

const smallestTextMatch = (nodes: AstNode[], text: string): AstNode | undefined =>
  nodes
    .filter((node) => node.$cstNode?.text.includes(text))
    .sort((left, right) =>
      (left.$cstNode?.text.length ?? Number.MAX_SAFE_INTEGER)
      - (right.$cstNode?.text.length ?? Number.MAX_SAFE_INTEGER)
    )[0];

const nodeName = (node: AstNode): string | undefined => {
  if (hasName(node)) return node.name;
  if (node.$type === 'Assignment') {
    return String((node as AstNode & { field?: unknown }).field ?? '');
  }
  return undefined;
};

const findNamedNode = (
  nodes: AstNode[],
  type: string,
  name: string,
  message: string
): AstNode | undefined => {
  const matches = nodes.filter((node) =>
    node.$type === type && hasName(node) && String(node.name) === name
  );
  if (matches.length <= 1) return matches[0];
  return matches.find((node) => containerNames(node).some((containerName) => message.includes(containerName)))
    ?? matches[0];
};

const hasName = (node: AstNode): node is AstNode & { name: string } =>
  typeof (node as AstNode & { name?: unknown }).name === 'string';

const containerNames = (node: AstNode): string[] => {
  const names: string[] = [];
  let current = node.$container;
  while (current) {
    if (hasName(current)) names.push(current.name);
    current = current.$container;
  }
  return names;
};

const nodeDepth = (node: AstNode): number => {
  let depth = 0;
  let current = node.$container;
  while (current) {
    depth += 1;
    current = current.$container;
  }
  return depth;
};

const toSourceRange = (node: AstNode): MedolSourceRange | undefined => {
  const range = node.$cstNode?.range;
  if (!range) return undefined;
  return {
    start: {
      line: range.start.line + 1,
      column: range.start.character + 1
    },
    end: {
      line: range.end.line + 1,
      column: range.end.character + 1
    }
  };
};
