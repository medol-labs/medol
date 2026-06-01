import type { EmModel } from '../../lib/model';
import type { SelectedModelItem } from '../../app/modelSelection';
import type { DslLocationTarget } from '../dsl-editor/dslLocation';

export interface AgentDslPatch {
  id: string;
  summary: string;
  reason: string;
  target: string;
  changeType: 'insert' | 'update' | 'delete';
  preview: string;
  nextDsl: string;
  focusTarget?: DslLocationTarget;
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
}

export interface AgentResponse {
  content: string;
  patch?: AgentDslPatch;
}
