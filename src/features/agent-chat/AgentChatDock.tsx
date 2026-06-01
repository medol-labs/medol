import { useState, type KeyboardEvent } from 'react';
import { ArrowUp, Bot, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import type { SelectedModelItem } from '../../app/modelSelection';

interface AgentChatDockProps {
  selectedItem?: SelectedModelItem;
  isParsingPending: boolean;
}

export function AgentChatDock({ selectedItem, isParsingPending }: AgentChatDockProps) {
  const [draft, setDraft] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const stopKeyboardPropagation = (event: KeyboardEvent) => {
    event.stopPropagation();
  };

  const contextLabel = selectedItem
    ? `${selectedItem.type}: ${selectedItem.name}`
    : 'domain model';
  const statusLabel = isParsingPending ? 'Parsing DSL' : contextLabel;

  return (
    <section className={collapsed ? 'agent-chat-dock is-collapsed' : 'agent-chat-dock'} aria-label="Event modeling agent">
      <div className="agent-chat-dock__inner">
        <div className="agent-chat-composer" onKeyDown={stopKeyboardPropagation} onKeyUp={stopKeyboardPropagation}>
          {!collapsed && (
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
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
              <Button type="button" size="icon" aria-label="Send message" disabled={draft.trim().length === 0}>
                <ArrowUp size={18} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
