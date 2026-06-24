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
  const content = operation.content ? normalizeMedolPatchContent(operation.content) : undefined;

  if (operation.operation === 'insert') {
    if (!content) return { error: `Insert operation for ${operation.target} has no content.` };
    return insertIntoTargetBlock(dsl, operation.target, content);
  }

  if (operation.operation === 'replace') {
    if (!content) return { error: `Replace operation for ${operation.target} has no content.` };
    return replaceTargetBlock(dsl, operation.target, content);
  }

  return deleteTargetBlock(dsl, operation.target);
};

const insertIntoTargetBlock = (dsl: string, target: string, content: string): { nextDsl?: string; error?: string } => {
  const targetBlock = findTargetBlock(dsl, target);
  if (!targetBlock) return { error: `Target block not found: ${target}.` };
  const parsedTarget = parseTarget(target);
  const insertedKind = declarationKind(content);
  if (parsedTarget && insertedKind === parsedTarget.kind) {
    return insertAfterTargetBlock(dsl, targetBlock, content);
  }

  const indentation = inferChildIndentation(dsl, targetBlock.openIndex);
  const insertAt = dsl.lastIndexOf('\n', targetBlock.closeIndex) + 1;
  const snippet = `${indentContent(content, indentation)}\n`;
  return {
    nextDsl: `${dsl.slice(0, insertAt)}${snippet}${dsl.slice(insertAt)}`
  };
};

const insertAfterTargetBlock = (
  dsl: string,
  targetBlock: TargetBlock,
  content: string
): { nextDsl: string } => {
  const indentation = inferLineIndentation(dsl, targetBlock.startIndex);
  const insertAt = targetBlock.closeIndex + 1;
  const lineBreak = dsl[insertAt] === '\n' ? '\n' : '';
  const snippet = `\n${indentContent(content, indentation)}`;
  return {
    nextDsl: `${dsl.slice(0, insertAt)}${snippet}${lineBreak}${dsl.slice(insertAt + lineBreak.length)}`
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

interface TargetBlock {
  startIndex: number;
  openIndex: number;
  closeIndex: number;
}

const findTargetBlock = (dsl: string, target: string): TargetBlock | undefined => {
  const parsedTarget = parseTarget(target);
  if (!parsedTarget) return undefined;
  const keywordPattern = parsedTarget.kind === 'readmodel' ? '(?:readmodel|projection)' : parsedTarget.kind;
  const namePattern = parsedTarget.kind === 'specification' || parsedTarget.kind === 'scenario' || parsedTarget.kind === 'hotspot'
    ? `"${escapeRegExp(parsedTarget.name)}"`
    : `${escapeRegExp(parsedTarget.name)}(?:\\[\\])?`;
  const pattern = new RegExp(`\\b${keywordPattern}\\s+${namePattern}\\s*\\{`, 'm');
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

const declarationKind = (content: string): string | undefined => {
  const match = /^(domain|context|aggregate|concept|slice|command|event|readmodel|projection|automation|policy|integration|specification|scenario)\b/i.exec(content.trimStart());
  if (!match) return undefined;
  return match[1].toLowerCase() === 'projection' ? 'readmodel' : match[1].toLowerCase();
};

const parseTarget = (target: string): { kind: string; name: string } | undefined => {
  const normalized = target.trim();
  const match = /^(domain|context|aggregate|concept|slice|command|event|readmodel|projection|automation|policy|integration|specification|scenario|hotspot)\s+(.+)$/i.exec(normalized);
  if (!match) return undefined;
  return {
    kind: match[1].toLowerCase() === 'projection' ? 'readmodel' : match[1].toLowerCase(),
    name: match[2].replace(/\[\]$/, '').trim().replace(/^"|"$/g, '')
  };
};

const findBlockEnd = (text: string, openIndex: number): number => {
  if (openIndex < 0) return -1;
  let depth = 0;
  let quote: '"' | undefined;
  let inMultilineString = false;
  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];
    const previous = text[index - 1];

    if (inMultilineString) {
      if (text.startsWith('"""', index)) {
        inMultilineString = false;
        index += 2;
      }
      continue;
    }

    if (quote) {
      if (char === quote && previous !== '\\') quote = undefined;
      continue;
    }

    if (text.startsWith('"""', index)) {
      inMultilineString = true;
      index += 2;
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

export const normalizeMedolPatchContent = (content: string): string => {
  const punctuation: Record<string, string> = {
    '？': '?',
    '：': ':',
    '，': ',',
    '（': '(',
    '）': ')',
    '［': '[',
    '］': ']',
    '｛': '{',
    '｝': '}'
  };
  let normalized = '';
  let inString = false;
  let inMultilineString = false;

  for (let index = 0; index < content.length; index += 1) {
    if (content.startsWith('"""', index)) {
      inMultilineString = !inMultilineString;
      normalized += '"""';
      index += 2;
      continue;
    }

    const char = content[index];
    if (!inMultilineString && char === '"' && content[index - 1] !== '\\') {
      inString = !inString;
      normalized += char;
      continue;
    }
    normalized += inString || inMultilineString ? char : punctuation[char] ?? char;
  }

  return normalized;
};

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
