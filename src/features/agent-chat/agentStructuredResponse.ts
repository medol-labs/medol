import { z } from 'zod';
import { parseMedol } from '../../lib/dslParser';
import type { DslLocationTarget } from '../dsl-editor/dslLocation';
import type { AgentDslPatch, AgentDslPatchOperation, AgentRequest, AgentResponse } from './agentTypes';
import { applyDslOperations, normalizeMedolPatchContent } from './dslOperationTools';

export type AgentStructuredResponse =
  | AgentStructuredAnswer
  | AgentStructuredClarification
  | AgentStructuredDslPatchProposal;

export interface AgentStructuredAnswer {
  type: 'answer';
  content: string;
}

export interface AgentStructuredClarification {
  type: 'clarification';
  content: string;
  questions: string[];
}

export interface AgentStructuredDslPatchProposal {
  type: 'medol_patch_proposal';
  content: string;
  patch: AgentStructuredDslPatch;
}

export interface AgentStructuredDslPatch {
  summary: string;
  reason: string;
  target: string;
  changeType: AgentDslPatch['changeType'];
  operations: AgentStructuredDslPatchOperation[];
  preview?: string;
  nextDsl?: string;
  focusTarget?: DslLocationTarget;
}

export interface AgentStructuredDslPatchOperation {
  id?: string;
  operation: AgentDslPatchOperation['operation'];
  target: string;
  content?: string;
  rule?: string;
}

export const agentStructuredResponseSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('answer'),
    content: z.string()
  }),
  z.object({
    type: z.literal('clarification'),
    content: z.string(),
    questions: z.array(z.string())
  }),
  z.object({
    type: z.literal('medol_patch_proposal'),
    content: z.string(),
    patch: z.object({
      summary: z.string(),
      reason: z.string(),
      target: z.string(),
      changeType: z.enum(['insert', 'update', 'delete']),
      operations: z.array(z.object({
        id: z.string().optional(),
        operation: z.enum(['insert', 'replace', 'delete']),
        target: z.string(),
        content: z.string().optional(),
        rule: z.string().optional()
      })).min(1),
      preview: z.string().optional(),
      focusTarget: z.object({
        kind: z.enum(['domain', 'context', 'aggregate', 'slice']),
        name: z.string()
      }).optional()
    })
  })
]) satisfies z.ZodType<AgentStructuredResponse>;

export const normalizeAgentStructuredResponse = (
  structuredResponse: AgentStructuredResponse,
  request: AgentRequest
): AgentResponse => {
  if (structuredResponse.type === 'answer') {
    return { content: structuredResponse.content };
  }

  if (structuredResponse.type === 'clarification') {
    return {
      content: [
        structuredResponse.content,
        ...structuredResponse.questions.map((question) => `- ${question}`)
      ].join('\n')
    };
  }

  const patch = normalizeStructuredPatch(structuredResponse.patch, request.dsl);
  const diagnostics = parseMedol(patch.nextDsl).diagnostics;
  const toolErrors = patch.toolErrors ?? [];
  const validationSummary = toolErrors.length > 0 || diagnostics.length > 0
    ? `\n\nPatch dry-run:\n${[
        ...toolErrors.map((error) => `- ${error}`),
        ...diagnostics.map((diagnostic) => `- ${diagnostic}`)
      ].join('\n')}`
    : '';

  return {
    content: `${structuredResponse.content}${validationSummary}`,
    patch
  };
};

export const parseAgentStructuredResponse = (value: unknown): AgentStructuredResponse | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (record.type === 'answer' && typeof record.content === 'string') {
    return { type: 'answer', content: record.content };
  }

  if (record.type === 'clarification' && typeof record.content === 'string' && Array.isArray(record.questions)) {
    return {
      type: 'clarification',
      content: record.content,
      questions: record.questions.filter((question): question is string => typeof question === 'string')
    };
  }

  if (
    record.type !== 'medol_patch_proposal' &&
    record.type !== 'dsl_patch_proposal'
  ) return undefined;
  if (typeof record.content !== 'string') return undefined;
  const patch = parseStructuredPatch(record.patch);
  if (!patch) return undefined;
  return {
    type: 'medol_patch_proposal',
    content: record.content,
    patch
  };
};

const parseStructuredPatch = (value: unknown): AgentStructuredDslPatch | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (
    typeof record.summary !== 'string' ||
    typeof record.reason !== 'string' ||
    typeof record.target !== 'string' ||
    !isChangeType(record.changeType)
  ) {
    return undefined;
  }

  return {
    summary: record.summary,
    reason: record.reason,
    target: record.target,
    changeType: record.changeType,
    operations: Array.isArray(record.operations)
      ? record.operations.map(parseStructuredOperation).filter((operation): operation is AgentStructuredDslPatchOperation => Boolean(operation))
      : [],
    ...(typeof record.preview === 'string' ? { preview: record.preview } : {}),
    ...(typeof record.nextDsl === 'string' ? { nextDsl: record.nextDsl } : {}),
    ...(parseFocusTarget(record.focusTarget) ? { focusTarget: parseFocusTarget(record.focusTarget) } : {})
  };
};

const parseStructuredOperation = (value: unknown): AgentStructuredDslPatchOperation | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (!isOperation(record.operation) || typeof record.target !== 'string') return undefined;
  return {
    ...(typeof record.id === 'string' ? { id: record.id } : {}),
    operation: record.operation,
    target: record.target,
    ...(typeof record.content === 'string' ? { content: record.content } : {}),
    ...(typeof record.rule === 'string' ? { rule: record.rule } : {})
  };
};

const normalizeStructuredPatch = (structuredPatch: AgentStructuredDslPatch, baseDsl: string): AgentDslPatch => {
  const operations = structuredPatch.operations.map((operation) => ({
    ...operation,
    ...(operation.content ? { content: normalizeMedolPatchContent(operation.content) } : {})
  }));
  const applied = structuredPatch.nextDsl
    ? { nextDsl: normalizeMedolPatchContent(structuredPatch.nextDsl), errors: [] }
    : applyDslOperations(baseDsl, operations);

  return {
    id: createId('patch'),
    summary: structuredPatch.summary,
    reason: structuredPatch.reason,
    target: structuredPatch.target,
    changeType: structuredPatch.changeType,
    operations: operations.map((operation) => ({
      id: operation.id ?? createId('operation'),
      operation: operation.operation,
      target: operation.target,
      ...(operation.content ? { content: operation.content } : {}),
      ...(operation.rule ? { rule: operation.rule } : {})
    })),
    preview: normalizeMedolPatchContent(
      structuredPatch.preview ?? operations.map((operation) => operation.content).filter(Boolean).join('\n')
    ),
    baseDsl,
    nextDsl: applied.nextDsl,
    ...(applied.errors.length > 0 ? { toolErrors: applied.errors } : {}),
    ...(structuredPatch.focusTarget ? { focusTarget: structuredPatch.focusTarget } : {})
  };
};

const parseFocusTarget = (value: unknown): DslLocationTarget | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (!isFocusKind(record.kind) || typeof record.name !== 'string') return undefined;
  return { kind: record.kind, name: record.name };
};

const isChangeType = (value: unknown): value is AgentDslPatch['changeType'] => {
  return value === 'insert' || value === 'update' || value === 'delete';
};

const isOperation = (value: unknown): value is AgentDslPatchOperation['operation'] => {
  return value === 'insert' || value === 'replace' || value === 'delete';
};

const isFocusKind = (value: unknown): value is DslLocationTarget['kind'] => {
  return value === 'domain' || value === 'context' || value === 'aggregate' || value === 'slice';
};

const createId = (prefix: string): string => {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};
