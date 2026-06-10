import { parseMedol } from '../../lib/dslParser';
import type { AgentStructuredDslPatchOperation } from './agentStructuredResponse';

export interface ApplyDslOperationsResult {
  nextDsl: string;
  diagnostics: string[];
  errors: string[];
}

export const applyDslOperations = (
  baseDsl: string,
  operations: AgentStructuredDslPatchOperation[]
): ApplyDslOperationsResult => {
  const errors: string[] = [];
  let nextDsl = baseDsl;

  for (const operation of operations) {
    const result = applyDslOperation(nextDsl, operation);
    if (!result.nextDsl) {
      errors.push(result.error ?? `Could not apply ${operation.operation} to ${operation.target}.`);
      continue;
    }
    nextDsl = result.nextDsl;
  }

  return {
    nextDsl,
    diagnostics: parseMedol(nextDsl).diagnostics,
    errors
  };
};

const applyDslOperation = (
  dsl: string,
  operation: AgentStructuredDslPatchOperation
): { nextDsl?: string; error?: string } => {
  if (operation.operation === 'insert') {
    if (!operation.content) return { error: `Insert operation for ${operation.target} has no content.` };
    return insertIntoTargetBlock(dsl, operation.target, operation.content);
  }

  if (operation.operation === 'replace') {
    if (!operation.content) return { error: `Replace operation for ${operation.target} has no content.` };
    return replaceTargetBlock(dsl, operation.target, operation.content);
  }

  return deleteTargetBlock(dsl, operation.target);
};

const insertIntoTargetBlock = (dsl: string, target: string, content: string): { nextDsl?: string; error?: string } => {
  const targetBlock = findTargetBlock(dsl, target);
  if (!targetBlock) return { error: `Target block not found: ${target}.` };
  const indentation = inferChildIndentation(dsl, targetBlock.openIndex);
  const insertAt = dsl.lastIndexOf('\n', targetBlock.closeIndex) + 1;
  const snippet = `${indentContent(content, indentation)}\n`;
  return {
    nextDsl: `${dsl.slice(0, insertAt)}${snippet}${dsl.slice(insertAt)}`
  };
};

const replaceTargetBlock = (dsl: string, target: string, content: string): { nextDsl?: string; error?: string } => {
  const targetBlock = findTargetBlock(dsl, target);
  if (!targetBlock) return { error: `Target block not found: ${target}.` };
  const indentation = inferLineIndentation(dsl, targetBlock.startIndex);
  return {
    nextDsl: `${dsl.slice(0, targetBlock.startIndex)}${indentContent(content, indentation)}${dsl.slice(targetBlock.closeIndex + 1)}`
  };
};

const deleteTargetBlock = (dsl: string, target: string): { nextDsl?: string; error?: string } => {
  const targetBlock = findTargetBlock(dsl, target);
  if (!targetBlock) return { error: `Target block not found: ${target}.` };
  const lineStart = dsl.lastIndexOf('\n', targetBlock.startIndex);
  const deleteStart = lineStart >= 0 ? lineStart + 1 : targetBlock.startIndex;
  const deleteEnd = dsl[targetBlock.closeIndex + 1] === '\n' ? targetBlock.closeIndex + 2 : targetBlock.closeIndex + 1;
  return {
    nextDsl: `${dsl.slice(0, deleteStart)}${dsl.slice(deleteEnd)}`
  };
};

const findTargetBlock = (dsl: string, target: string) => {
  const parsedTarget = parseTarget(target);
  if (!parsedTarget) return undefined;
  const keywordPattern = parsedTarget.kind === 'readmodel' ? '(?:readmodel|projection)' : parsedTarget.kind;
  const pattern = new RegExp(`\\b${keywordPattern}\\s+${escapeRegExp(parsedTarget.name)}(?:\\[\\])?\\s*\\{`, 'm');
  const match = pattern.exec(dsl);
  if (!match) return undefined;
  const openIndex = dsl.indexOf('{', match.index);
  const closeIndex = findBlockEnd(dsl, openIndex);
  if (openIndex < 0 || closeIndex < 0) return undefined;
  return {
    startIndex: match.index,
    openIndex,
    closeIndex
  };
};

const parseTarget = (target: string): { kind: string; name: string } | undefined => {
  const normalized = target.trim();
  const match = /^(domain|context|aggregate|slice|command|event|error|readmodel|projection|automation|policy|integration|specification|hotspot)\s+(.+)$/i.exec(normalized);
  if (!match) return undefined;
  return {
    kind: match[1].toLowerCase() === 'projection' ? 'readmodel' : match[1].toLowerCase(),
    name: match[2].replace(/\[\]$/, '').trim()
  };
};

const findBlockEnd = (text: string, openIndex: number): number => {
  if (openIndex < 0) return -1;
  let depth = 0;
  let quote: '"' | undefined;
  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];
    const previous = text[index - 1];

    if (quote) {
      if (char === quote && previous !== '\\') quote = undefined;
      continue;
    }

    if (char === '"') {
      quote = char;
      continue;
    }

    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
};

const inferChildIndentation = (dsl: string, openIndex: number): string => {
  return `${inferLineIndentation(dsl, openIndex)}  `;
};

const inferLineIndentation = (dsl: string, index: number): string => {
  const lineStart = dsl.lastIndexOf('\n', index);
  const line = dsl.slice(lineStart + 1, index);
  return line.match(/^\s*/)?.[0] ?? '';
};

const indentContent = (content: string, indentation: string): string => {
  const lines = content.split(/\r?\n/);
  while (lines.length > 0 && lines[0].trim().length === 0) lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim().length === 0) lines.pop();
  const nonEmptyIndentLengths = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.match(/^\s*/)?.[0].length ?? 0);
  const commonIndent = nonEmptyIndentLengths.length > 0
    ? Math.min(...nonEmptyIndentLengths)
    : 0;

  return lines
    .map((line) => `${indentation}${line.slice(commonIndent).trimEnd()}`)
    .join('\n');
};

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
