import { useMemo, useState, type KeyboardEvent } from 'react';
import { ArrowUp, Bot, Check, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { useChat, type UIMessage } from '@tanstack/ai-react';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import type { EmModel } from '../../lib/model';
import { parseEventModelingDsl } from '../../lib/dslParser';
import type { DslLocationTarget } from '../dsl-editor/dslLocation';
import type { SelectedModelItem } from '../../app/modelSelection';
import type { AgentDslPatch } from './agentTypes';
import { eventModelingAgentMockFetcher } from './tanstackMockBackend';

interface AgentChatDockProps {
  dsl: string;
  model: EmModel;
  selectedItem?: SelectedModelItem;
  isParsingPending: boolean;
  onApplyDsl: (nextDsl: string, focusTarget?: DslLocationTarget) => void;
}

export function AgentChatDock({ dsl, model, selectedItem, isParsingPending, onApplyDsl }: AgentChatDockProps) {
  const [draft, setDraft] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [patchReview, setPatchReview] = useState<Record<string, { diagnostics: string[]; confirmRequired: boolean; blocked: boolean }>>({});
  const [patchesByMessageId, setPatchesByMessageId] = useState<Record<string, AgentDslPatch>>({});
  const [patchStateByMessageId, setPatchStateByMessageId] = useState<Record<string, 'applied' | 'dismissed'>>({});
  const forwardedProps = useMemo(() => ({
    dsl,
    model,
    selectedItem
  }), [dsl, model, selectedItem]);
  const {
    messages,
    sendMessage: sendChatMessage,
    isLoading: isThinking
  } = useChat({
    fetcher: eventModelingAgentMockFetcher,
    forwardedProps,
    onCustomEvent: (eventType, data) => {
      if (eventType !== 'event-modeling.patch-proposed') return;
      const event = data as { messageId?: string; patch?: AgentDslPatch };
      if (!event.messageId || !event.patch) return;
      setPatchesByMessageId((current) => ({
        ...current,
        [event.messageId as string]: event.patch as AgentDslPatch
      }));
    },
    onError: (error) => {
      console.error(error);
    }
  });

  const stopKeyboardPropagation = (event: KeyboardEvent) => {
    event.stopPropagation();
  };

  const contextLabel = selectedItem
    ? `${selectedItem.type}: ${selectedItem.name}`
    : 'domain model';
  const statusLabel = isParsingPending ? 'Parsing DSL' : contextLabel;
  const canSend = draft.trim().length > 0 && !isThinking;

  const sendMessage = async () => {
    const prompt = draft.trim();
    if (!prompt || isThinking) return;

    setDraft('');
    setCollapsed(false);
    await sendChatMessage(prompt);
  };

  const applyPatch = (messageId: string) => {
    const patch = patchesByMessageId[messageId];
    const patchState = patchStateByMessageId[messageId];
    if (!patch || patchState) return;

    const validation = parseEventModelingDsl(patch.nextDsl);
    const blocked = validation.domains.length === 0 && validation.contexts.length === 0;
    const existingReview = patchReview[messageId];

    if (blocked || (validation.diagnostics.length > 0 && !existingReview?.confirmRequired)) {
      setPatchReview((current) => ({
        ...current,
        [messageId]: {
          diagnostics: validation.diagnostics,
          confirmRequired: validation.diagnostics.length > 0,
          blocked
        }
      }));
      return;
    }

    onApplyDsl(patch.nextDsl, patch.focusTarget);
    setPatchStateByMessageId((current) => ({ ...current, [messageId]: 'applied' }));
    setPatchReview((current) => {
      const next = { ...current };
      delete next[messageId];
      return next;
    });
  };

  const dismissPatch = (messageId: string) => {
    setPatchStateByMessageId((current) => ({ ...current, [messageId]: 'dismissed' }));
    setPatchReview((current) => {
      const next = { ...current };
      delete next[messageId];
      return next;
    });
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    event.stopPropagation();
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  return (
    <section className={collapsed ? 'agent-chat-dock is-collapsed' : 'agent-chat-dock'} aria-label="Event modeling agent">
      <div className="agent-chat-dock__inner">
        <div className="agent-chat-composer" onKeyDown={stopKeyboardPropagation} onKeyUp={stopKeyboardPropagation}>
          {!collapsed && messages.length > 0 && (
            <div className="agent-chat-thread" aria-label="Agent conversation">
              {messages.slice(-4).map((message) => (
                <article className={`agent-chat-message is-${message.role}`} key={message.id}>
                  <p>{messageText(message)}</p>
                  {patchesByMessageId[message.id] && (
                    <div className={patchStateByMessageId[message.id] === 'dismissed' ? 'agent-chat-patch is-dismissed' : 'agent-chat-patch'}>
                      <div className="agent-chat-patch__header">
                        <div>
                          <small>{patchesByMessageId[message.id].changeType}</small>
                          <strong>{patchesByMessageId[message.id].summary}</strong>
                        </div>
                        <span>{patchesByMessageId[message.id].target}</span>
                      </div>
                      <p>{patchesByMessageId[message.id].reason}</p>
                      <pre>{patchesByMessageId[message.id].preview}</pre>
                      {patchReview[message.id] && (
                        <div className={patchReview[message.id].blocked ? 'agent-chat-patch__validation is-blocked' : 'agent-chat-patch__validation'}>
                          <strong>{patchReview[message.id].blocked ? 'Patch cannot be applied' : 'Dry-run found warnings'}</strong>
                          {patchReview[message.id].diagnostics.length > 0 ? (
                            <ul>
                              {patchReview[message.id].diagnostics.map((diagnostic) => (
                                <li key={diagnostic}>{diagnostic}</li>
                              ))}
                            </ul>
                          ) : (
                            <span>The generated DSL did not produce a model.</span>
                          )}
                        </div>
                      )}
                      <div className="agent-chat-patch__actions">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => applyPatch(message.id)}
                          disabled={Boolean(patchStateByMessageId[message.id]) || patchReview[message.id]?.blocked}
                        >
                          <Check size={14} />
                          {patchStateByMessageId[message.id] === 'applied' ? 'Applied' : patchReview[message.id]?.confirmRequired ? 'Apply anyway' : 'Apply'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => dismissPatch(message.id)}
                          disabled={Boolean(patchStateByMessageId[message.id])}
                        >
                          <X size={14} />
                          {patchStateByMessageId[message.id] === 'dismissed' ? 'Dismissed' : 'Dismiss'}
                        </Button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
              {isThinking && <div className="agent-chat-thinking">Preparing modeling suggestion...</div>}
            </div>
          )}
          {!collapsed && (
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Ask for follow-up changes"
              className="agent-chat-composer__input"
              rows={1}
            />
          )}
          <div className="agent-chat-composer__toolbar">
            <div className="agent-chat-composer__tools">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={collapsed ? 'Expand agent chat' : 'Collapse agent chat'}
                onClick={() => setCollapsed((current) => !current)}
              >
                {collapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Attach knowledge">
                <Plus size={18} />
              </Button>
              <button type="button" className="agent-chat-composer__context" aria-label="Current modeling context">
                <Bot size={16} />
                <span>{statusLabel}</span>
                <ChevronDown size={14} />
              </button>
            </div>
            <div className="agent-chat-composer__actions">
              <button type="button" className="agent-chat-composer__mode">
                <span>5.5</span>
                Medium
                <ChevronDown size={14} />
              </button>
              <Button type="button" size="icon" aria-label="Send message" disabled={!canSend} onClick={() => void sendMessage()}>
                <ArrowUp size={18} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const messageText = (message: UIMessage): string => {
  return message.parts
    .filter((part): part is Extract<(typeof message.parts)[number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.content)
    .join('\n');
};
