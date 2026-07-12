import { useEffect, useState } from 'react';
import type { ModelSearchItem } from '../features/model-search/modelSearch';
import { recentSearchStoragePrefix } from './studioTypes';

interface UseModelSearchDialogOptions {
  activeWorkspaceId?: string;
  previewOnly: boolean;
  onSelectItem: (item: ModelSearchItem) => void;
  onOpenLeftPanel: () => void;
  onOpenExplorerPanel: () => void;
}

export const useModelSearchDialog = ({
  activeWorkspaceId,
  previewOnly,
  onSelectItem,
  onOpenLeftPanel,
  onOpenExplorerPanel
}: UseModelSearchDialogOptions) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [recentSearchIds, setRecentSearchIds] = useState<string[]>([]);

  useEffect(() => {
    if (!activeWorkspaceId || typeof window === 'undefined') {
      setRecentSearchIds([]);
      return;
    }
    try {
      const stored = window.localStorage.getItem(`${recentSearchStoragePrefix}:${activeWorkspaceId}`);
      const parsed = stored ? JSON.parse(stored) : [];
      setRecentSearchIds(Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string').slice(0, 10)
        : []);
    } catch {
      setRecentSearchIds([]);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const navigateToSearchItem = (item: ModelSearchItem) => {
    onSelectItem(item);
    if (!previewOnly) onOpenLeftPanel();
    onOpenExplorerPanel();

    setRecentSearchIds((current) => {
      const next = [item.id, ...current.filter((id) => id !== item.id)].slice(0, 10);
      if (activeWorkspaceId && typeof window !== 'undefined') {
        window.localStorage.setItem(`${recentSearchStoragePrefix}:${activeWorkspaceId}`, JSON.stringify(next));
      }
      return next;
    });
  };

  return {
    searchOpen,
    setSearchOpen,
    recentSearchIds,
    navigateToSearchItem
  };
};
