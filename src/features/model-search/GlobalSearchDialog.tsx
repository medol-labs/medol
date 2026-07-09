import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Braces,
  Boxes,
  CircleDot,
  Command as CommandIcon,
  Database,
  FileCode2,
  Layers3,
  Monitor,
  Search,
  ShieldCheck,
  Workflow
} from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut
} from '../../components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '../../components/ui/dialog';
import {
  searchModelItems,
  type ModelSearchItem,
  type ModelSearchKind
} from './modelSearch';

interface GlobalSearchDialogProps {
  open: boolean;
  items: ModelSearchItem[];
  recentIds: string[];
  onOpenChange: (open: boolean) => void;
  onSelect: (item: ModelSearchItem) => void;
}

export function GlobalSearchDialog({
  open,
  items,
  recentIds,
  onOpenChange,
  onSelect
}: GlobalSearchDialogProps) {
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const results = useMemo(
    () => searchModelItems(items, query, recentIds),
    [items, query, recentIds]
  );
  const heading = query.trim() ? 'Results' : recentIds.length ? 'Recent' : 'Model';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0" showCloseButton={false}>
        <DialogTitle className="sr-only">Search MEDOL model</DialogTitle>
        <DialogDescription className="sr-only">
          Search contexts, slices, commands, events, specifications, types, and fields.
        </DialogDescription>
        <Command shouldFilter={false} loop>
          <CommandInput
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Search model, or use slice:, event:, field:..."
          />
          <CommandList>
            <CommandEmpty>No matching model item.</CommandEmpty>
            <CommandGroup heading={heading}>
              {results.map((item) => {
                const Icon = kindIcons[item.kind];
                return (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => {
                      onSelect(item);
                      onOpenChange(false);
                    }}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <strong className="truncate font-medium">{item.name}</strong>
                        <small className="shrink-0 text-[11px] uppercase text-muted-foreground">{kindLabels[item.kind]}</small>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.path.join(' / ') || 'Model root'}
                      </span>
                    </span>
                    {item.sourceRange && (
                      <CommandShortcut>Ln {item.sourceRange.start.line}</CommandShortcut>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          <div className="flex items-center gap-4 border-t px-4 py-2 text-[11px] text-muted-foreground">
            <span><kbd>↑↓</kbd> Navigate</span>
            <span><kbd>Enter</kbd> Open</span>
            <span><kbd>Esc</kbd> Close</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

const kindLabels: Record<ModelSearchKind, string> = {
  domain: 'Domain',
  context: 'Context',
  aggregate: 'Aggregate',
  concept: 'Concept',
  slice: 'Slice',
  command: 'Command',
  event: 'Event',
  readmodel: 'Read model',
  specification: 'Specification',
  automation: 'Automation',
  integration: 'Integration',
  screen: 'Screen',
  type: 'Type',
  field: 'Field'
};

const kindIcons: Record<ModelSearchKind, typeof Search> = {
  domain: Boxes,
  context: Layers3,
  aggregate: Box,
  concept: CircleDot,
  slice: Workflow,
  command: CommandIcon,
  event: CircleDot,
  readmodel: Database,
  specification: ShieldCheck,
  automation: Workflow,
  integration: Braces,
  screen: Monitor,
  type: FileCode2,
  field: Braces
};
