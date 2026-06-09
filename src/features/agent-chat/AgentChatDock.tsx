import { memo, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUp, Check, Plus, Trash2, X } from 'lucide-react';
import { fetchServerSentEvents, useChat, type UIMessage } from '@tanstack/ai-react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import type { EmModel } from '../../lib/model';
import { parseMedol } from '../../lib/dslParser';
import { useDebouncedValue } from '../../app/useDebouncedValue';
import type { DslLocationTarget } from '../dsl-editor/dslLocation';
import type { SelectedModelItem } from '../../app/modelSelection';
import type { AgentDslPatch } from './agentTypes';
import { sumAgentUsage, type AgentUsage } from './agentUsage';
import {
  clearPersistedAgentChat,
  getAgentChatId,
  getAgentChatThreadId,
  loadAgentChatMessages,
  loadAgentChatMessagesFromServer,
  loadAgentChatUsage,
  persistAgentChatMessages,
  persistAgentChatUsage
} from './agentChatPersistence';
import { eventModelingDslKnowledgeManifest } from './dslKnowledge';

const agentChatConnection = fetchServerSentEvents('/api/agent/chat');

interface AgentChatDockProps {
  workspaceId: string;
  dsl: string;
  model: EmModel;
  selectedItem?: SelectedModelItem;
  isParsingPending: boolean;
  onApplyDsl: (nextDsl: string, focusTarget?: DslLocationTarget) => void;
  onPreviewPatch: (patch: AgentDslPatch) => void;
  onClearPatchPreview: (patchId?: string) => void;
}

export function AgentChatDock({
  workspaceId,
  dsl,
  model,
  selectedItem,
  isParsingPending,
  onApplyDsl,
  onPreviewPatch,
  onClearPatchPreview
}: AgentChatDockProps) {
  const chatId = getAgentChatId(workspaceId);
  const chatThreadId = getAgentChatThreadId(workspaceId);
  const [draft, setDraft] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<number | undefined>(undefined);
  const sendDebounceRef = useRef<number | undefined>(undefined);
  const chatHydratedRef = useRef(false);
  const messagesEffectStartedRef = useRef(false);
  const skipNextPersistenceRef = useRef(false);
  const serverHydrationPendingRef = useRef(false);
  const messagesChangedDuringServerHydrationRef = useRef(false);
  const [patchReview, setPatchReview] = useState<Record<string, { diagnostics: string[]; confirmRequired: boolean; blocked: boolean }>>({});
  const [patchesByMessageId, setPatchesByMessageId] = useState<Record<string, AgentDslPatch>>({});
  const [patchStateByMessageId, setPatchStateByMessageId] = useState<Record<string, 'applied' | 'dismissed'>>({});
  const [usageByMessageId, setUsageByMessageId] = useState<Record<string, AgentUsage>>(
    () => loadAgentChatUsage(chatId)
  );
  const immediateForwardedProps = useMemo(() => ({
    dsl,
    model,
    selectedItem,
    dslKnowledgeManifest: eventModelingDslKnowledgeManifest
  }), [dsl, model, selectedItem]);
  const forwardedProps = useDebouncedValue(immediateForwardedProps, 300);
  const {
    messages,
    sendMessage: sendChatMessage,
    isLoading: isThinking,
    clear: clearChat,
    setMessages
  } = useChat({
    id: chatId,
    threadId: chatThreadId,
    connection: agentChatConnection,
    forwardedProps,
    onCustomEvent: (eventType, data) => {
      if (eventType === 'event-modeling.usage') {
        const event = data as { messageId?: string; usage?: AgentUsage };
        if (!event.messageId || !event.usage) return;
        setUsageByMessageId((current) => {
          const next = {
            ...current,
            [event.messageId as string]: event.usage as AgentUsage
          };
          persistAgentChatUsage(chatId, next);
          return next;
        });
        return;
      }

      if (eventType !== 'event-modeling.patch-proposed') return;
      const event = data as { messageId?: string; patch?: AgentDslPatch };
      if (!event.messageId || !event.patch) return;
      setPatchesByMessageId((current) => ({
        ...current,
        [event.messageId as string]: event.patch as AgentDslPatch
      }));
      onPreviewPatch(event.patch);
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
  const statusLabel = isParsingPending ? 'Parsing MEDOL' : contextLabel;
  const canSend = draft.trim().length > 0 && !isThinking;
  const sessionUsage = useMemo(
    () => sumAgentUsage(Object.values(usageByMessageId)),
    [usageByMessageId]
  );

  useEffect(() => {
    let cancelled = false;
    const persistedMessages = loadAgentChatMessages(chatId);
    if (persistedMessages.length > 0) {
      skipNextPersistenceRef.current = true;
      setMessages(persistedMessages);
    }
    chatHydratedRef.current = true;
    serverHydrationPendingRef.current = true;

    void loadAgentChatMessagesFromServer(chatId).then((serverMessages) => {
      serverHydrationPendingRef.current = false;
      if (cancelled || messagesChangedDuringServerHydrationRef.current) return;

      if (serverMessages.length > 0) {
        skipNextPersistenceRef.current = true;
        setMessages(serverMessages);
        persistAgentChatMessages(chatId, serverMessages);
      } else if (persistedMessages.length > 0) {
        persistAgentChatMessages(chatId, persistedMessages);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [setMessages]);

  useEffect(() => {
    if (!messagesEffectStartedRef.current) {
      messagesEffectStartedRef.current = true;
      return;
    }
    if (!chatHydratedRef.current) return;
    if (isThinking) return;
    if (skipNextPersistenceRef.current) {
      skipNextPersistenceRef.current = false;
      return;
    }
    if (serverHydrationPendingRef.current) {
      messagesChangedDuringServerHydrationRef.current = true;
    }
    persistAgentChatMessages(chatId, messages);
  }, [messages, isThinking]);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    if (scrollFrameRef.current) window.cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      thread.scrollTop = thread.scrollHeight;
      scrollFrameRef.current = undefined;
    });

    return () => {
      if (scrollFrameRef.current) window.cancelAnimationFrame(scrollFrameRef.current);
    };
  }, [messages, isThinking, patchesByMessageId, patchReview]);

  useEffect(() => {
    return () => {
      if (sendDebounceRef.current) {
        window.clearTimeout(sendDebounceRef.current);
      }
      if (scrollFrameRef.current) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  const sendMessage = async () => {
    const prompt = draft.trim();
    if (!prompt || isThinking) return;

    if (sendDebounceRef.current) {
      window.clearTimeout(sendDebounceRef.current);
    }

    setDraft('');
    sendDebounceRef.current = window.setTimeout(() => {
      void sendChatMessage(prompt);
      sendDebounceRef.current = undefined;
    }, 180);
  };

  const applyPatch = (messageId: string) => {
    const patch = patchesByMessageId[messageId];
    const patchState = patchStateByMessageId[messageId];
    if (!patch || patchState) return;

    if (patch.baseDsl && patch.baseDsl !== dsl) {
      setPatchReview((current) => ({
        ...current,
        [messageId]: {
          diagnostics: ['The MEDOL changed after this proposal was generated. Ask the assistant to regenerate the patch before applying it.'],
          confirmRequired: false,
          blocked: true
        }
      }));
      return;
    }

    const validation = parseMedol(patch.nextDsl);
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
    onClearPatchPreview(patch.id);
    setPatchStateByMessageId((current) => ({ ...current, [messageId]: 'applied' }));
    setPatchReview((current) => {
      const next = { ...current };
      delete next[messageId];
      return next;
    });
  };

  const dismissPatch = (messageId: string) => {
    const patch = patchesByMessageId[messageId];
    if (patch) onClearPatchPreview(patch.id);
    setPatchStateByMessageId((current) => ({ ...current, [messageId]: 'dismissed' }));
    setPatchReview((current) => {
      const next = { ...current };
      delete next[messageId];
      return next;
    });
  };

  const clearConversation = () => {
    clearChat();
    clearPersistedAgentChat(chatId);
    setPatchesByMessageId({});
    setPatchStateByMessageId({});
    setPatchReview({});
    setUsageByMessageId({});
    onClearPatchPreview();
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    event.stopPropagation();
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  return (
    <section className="agent-chat-dock" aria-label="Event modeling assistant">
      <div className="agent-chat-dock__inner">
        <div className="agent-chat-thread" aria-label="Assistant conversation" ref={threadRef}>
          {messages.map((message) => (
            <article className={`agent-chat-message is-${message.role}`} key={message.id}>
              <MessageMarkdown content={messageText(message)} />
              {usageByMessageId[message.id] && (
                <AgentUsageLine usage={usageByMessageId[message.id]} />
              )}
              {patchesByMessageId[message.id] && (
                <PatchProposalCard
                  patch={patchesByMessageId[message.id]}
                  patchState={patchStateByMessageId[message.id]}
                  review={patchReview[message.id]}
                  onApply={() => applyPatch(message.id)}
                  onDismiss={() => dismissPatch(message.id)}
                />
              )}
            </article>
          ))}
          {isThinking && <div className="agent-chat-thinking">Preparing modeling suggestion...</div>}
        </div>
        <div className="agent-chat-composer" onKeyDown={stopKeyboardPropagation} onKeyUp={stopKeyboardPropagation}>
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Ask for follow-up changes"
            className="agent-chat-composer__input"
            rows={1}
          />
          <div className="agent-chat-composer__toolbar">
            <div className="agent-chat-composer__tools">
              <button type="button" className="agent-chat-composer__context" aria-label="Current modeling context">
                <Plus size={16} />
                <span>{statusLabel}</span>
              </button>
            </div>
            <div className="agent-chat-composer__actions">
              {sessionUsage && (
                <span
                  className="agent-chat-session-usage"
                  title={sessionUsage.measurement === 'estimated'
                    ? 'Current session token usage includes estimated values'
                    : 'Current session token usage reported by the API'}
                >
                  {sessionUsage.measurement === 'estimated' ? '~' : ''}
                  {formatTokenCount(sessionUsage.totalTokens)} tokens
                </span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Clear conversation"
                title="Clear conversation"
                disabled={messages.length === 0 || isThinking}
                onClick={clearConversation}
              >
                <Trash2 size={16} />
              </Button>
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

function AgentUsageLine({ usage }: { usage: AgentUsage }) {
  const estimatePrefix = usage.measurement === 'estimated' ? '~' : '';
  const parts = [
    usage.model,
    usage.inputTokens !== undefined ? `${estimatePrefix}${formatTokenCount(usage.inputTokens)} in` : undefined,
    usage.outputTokens !== undefined ? `${estimatePrefix}${formatTokenCount(usage.outputTokens)} out` : undefined,
    usage.cachedInputTokens !== undefined ? `${formatTokenCount(usage.cachedInputTokens)} cached` : undefined,
    usage.reasoningTokens !== undefined ? `${formatTokenCount(usage.reasoningTokens)} reasoning` : undefined,
    usage.totalTokens !== undefined ? `${estimatePrefix}${formatTokenCount(usage.totalTokens)} total` : undefined
  ].filter(Boolean);

  return (
    <div
      className="agent-chat-message__usage"
      title={usage.measurement === 'estimated'
        ? `${usage.provider} did not report token usage; values are estimated`
        : `${usage.provider} API reported usage`}
    >
      {parts.join(' · ')}
    </div>
  );
}

const formatTokenCount = (value?: number): string => {
  if (value === undefined) return '0';
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`;
  return `${(value / 1_000_000).toFixed(1)}m`;
};

interface PatchProposalCardProps {
  patch: AgentDslPatch;
  patchState?: 'applied' | 'dismissed';
  review?: { diagnostics: string[]; confirmRequired: boolean; blocked: boolean };
  onApply: () => void;
  onDismiss: () => void;
}

function PatchProposalCard({ patch, patchState, review, onApply, onDismiss }: PatchProposalCardProps) {
  return (
    <div className={patchState === 'dismissed' ? 'agent-chat-patch is-dismissed' : 'agent-chat-patch'}>
      <div className="agent-chat-patch__header">
        <div>
          <small>{patch.changeType} proposal</small>
          <strong>{patch.summary}</strong>
        </div>
        <span>{patch.target}</span>
      </div>
      <p>{patch.reason}</p>
      <div className="agent-chat-patch__operations">
        <strong>Operations</strong>
        {(patch.operations?.length ? patch.operations : fallbackOperations(patch)).map((operation) => (
          <div className="agent-chat-patch__operation" key={operation.id}>
            <span>{operation.operation}</span>
            <div>
              <strong>{operation.target}</strong>
              {operation.rule && <small>{operation.rule}</small>}
            </div>
          </div>
        ))}
      </div>
      <div className="agent-chat-patch__editor-note">Previewing this change in the MEDOL editor.</div>
      {review && (
        <div className={review.blocked ? 'agent-chat-patch__validation is-blocked' : 'agent-chat-patch__validation'}>
          <strong>{review.blocked ? 'Patch cannot be applied' : 'Dry-run found warnings'}</strong>
          {review.diagnostics.length > 0 ? (
            <ul>
              {review.diagnostics.map((diagnostic) => (
                <li key={diagnostic}>{diagnostic}</li>
              ))}
            </ul>
          ) : (
            <span>The generated MEDOL did not produce a model.</span>
          )}
        </div>
      )}
      <div className="agent-chat-patch__actions">
        <Button
          type="button"
          size="sm"
          onClick={onApply}
          disabled={Boolean(patchState) || review?.blocked}
        >
          <Check size={14} />
          {patchState === 'applied' ? 'Applied' : review?.confirmRequired ? 'Apply anyway' : 'Apply'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          disabled={Boolean(patchState)}
        >
          <X size={14} />
          {patchState === 'dismissed' ? 'Dismissed' : 'Dismiss'}
        </Button>
      </div>
    </div>
  );
}

const fallbackOperations = (patch: AgentDslPatch) => [{
  id: `${patch.id}-operation`,
  operation: patch.changeType === 'update' ? 'replace' : patch.changeType,
  target: patch.target,
  content: patch.preview,
  rule: patch.reason
} satisfies AgentDslPatch['operations'][number]];

const messageText = (message: UIMessage): string => {
  return message.parts
    .filter((part): part is Extract<(typeof message.parts)[number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.content)
    .join('\n');
};

const markdownComponents: Components = {
  a: ({ children, ...props }) => (
    <a {...props} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
};

const MessageMarkdown = memo(function MessageMarkdown({ content }: { content: string }) {
  return (
    <div className="agent-chat-message__markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
