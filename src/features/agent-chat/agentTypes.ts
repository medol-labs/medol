import type { EmModel } from '../../lib/model';
import type { SelectedModelItem } from '../../app/modelSelection';
import type { DslLocationTarget } from '../dsl-editor/dslLocation';
import type { AgentDslKnowledge, AgentDslKnowledgeManifest } from './dslKnowledge';
import type { BuiltAgentContext } from './agentContextBuilder';

export interface AgentDslPatch {
  id: string;
  summary: string;
  reason: string;
  target: string;
  changeType: 'insert' | 'update' | 'delete';
  operations: AgentDslPatchOperation[];
  preview: string;
  baseDsl?: string;
  nextDsl: string;
  toolErrors?: string[];
  focusTarget?: DslLocationTarget;
}

export interface AgentDslPatchOperation {
  id: string;
  operation: 'insert' | 'replace' | 'delete';
  target: string;
  content?: string;
  rule?: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  patch?: AgentDslPatch;
  patchApplied?: boolean;
  patchDismissed?: boolean;
}

export interface AgentRequest {
  prompt: string;
  dsl: string;
  model: EmModel;
  selectedItem?: SelectedModelItem;
  dslKnowledgeManifest?: AgentDslKnowledgeManifest;
  dslKnowledge?: AgentDslKnowledge;
  agentContext?: BuiltAgentContext;
}

export interface AgentResponse {
  content: string;
  patch?: AgentDslPatch;
}
