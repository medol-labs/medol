import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from '../../app/useDebouncedValue';
import { modelingWorkspaceClient } from './httpModelingWorkspaceClient';
import type {
  CreateModelingWorkspaceVersionInput,
  ModelingWorkspace,
  ModelingWorkspaceVersion,
  ModelingWorkspaceVersionSummary,
  ModelingWorkspaceSummary
} from '../../contracts/modelingWorkspace';

export type WorkspacePersistenceStatus = 'loading' | 'saving' | 'saved' | 'offline';
export type WorkspaceVersionStatus = 'loading' | 'ready' | 'offline';

const selectedWorkspaceStorageKey = 'event-modeling-toolkit:selected-workspace:v1';

export const useModelingWorkspace = (initialDsl: string) => {
  const [dsl, setDsl] = useState(initialDsl);
  const [workspaces, setWorkspaces] = useState<ModelingWorkspaceSummary[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>();
  const [versions, setVersions] = useState<ModelingWorkspaceVersionSummary[]>([]);
  const [versionStatus, setVersionStatus] = useState<WorkspaceVersionStatus>('loading');
  const [status, setStatus] = useState<WorkspacePersistenceStatus>('loading');
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const latestDslRef = useRef(dsl);
  const activeWorkspaceIdRef = useRef<string | undefined>(undefined);
  const lastPersistedDslRef = useRef<string | undefined>(undefined);
  const editedBeforeReadyRef = useRef(false);
  const requestGenerationRef = useRef(0);
  const loadControllerRef = useRef<AbortController | undefined>(undefined);
  const saveControllerRef = useRef<AbortController | undefined>(undefined);
  const debouncedDsl = useDebouncedValue(dsl, 800);
  latestDslRef.current = dsl;
  activeWorkspaceIdRef.current = activeWorkspaceId;

  const mergeWorkspace = useCallback((workspace: ModelingWorkspace) => {
    setWorkspaces((current) => [
      {
        id: workspace.id,
        name: workspace.name,
        headVersionId: workspace.headVersionId,
        updatedAt: workspace.updatedAt
      },
      ...current.filter((candidate) => candidate.id !== workspace.id)
    ]);
  }, []);

  const loadWorkspaceVersions = useCallback(async (
    workspaceId: string,
    signal?: AbortSignal
  ) => {
    setVersionStatus('loading');
    try {
      const loadedVersions = await modelingWorkspaceClient.listVersions(workspaceId, signal);
      if (signal?.aborted) return;
      if (activeWorkspaceIdRef.current === workspaceId) {
        setVersions(loadedVersions);
        setVersionStatus('ready');
      }
    } catch (error) {
      if (signal?.aborted) return;
      console.error(error);
      setVersions([]);
      setVersionStatus('offline');
    }
  }, []);

  const loadWorkspace = useCallback(async (
    workspaceId: string,
    preserveEarlyEdit = false
  ) => {
    const generation = requestGenerationRef.current + 1;
    requestGenerationRef.current = generation;
    loadControllerRef.current?.abort();
    saveControllerRef.current?.abort();
    const controller = new AbortController();
    loadControllerRef.current = controller;
    setReady(false);
    setStatus('loading');

    try {
      const workspace = await modelingWorkspaceClient.get(workspaceId, controller.signal);
      if (controller.signal.aborted || requestGenerationRef.current !== generation) return;

      setActiveWorkspaceId(workspace.id);
      activeWorkspaceIdRef.current = workspace.id;
      persistSelectedWorkspaceId(workspace.id);
      lastPersistedDslRef.current = workspace.dsl;
      mergeWorkspace(workspace);
      void loadWorkspaceVersions(workspace.id, controller.signal);

      const keepCurrentDsl = preserveEarlyEdit && editedBeforeReadyRef.current;
      if (!keepCurrentDsl) {
        latestDslRef.current = workspace.dsl;
        setDsl(workspace.dsl);
        setWorkspaceRevision((revision) => revision + 1);
      }

      setReady(true);
      setStatus(keepCurrentDsl ? 'saving' : 'saved');
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error(error);
      setStatus('offline');
    }
  }, [loadWorkspaceVersions, mergeWorkspace]);

  const persistCurrentDsl = useCallback(async () => {
    const workspaceId = activeWorkspaceIdRef.current;
    const currentDsl = latestDslRef.current;
    if (!workspaceId || currentDsl === lastPersistedDslRef.current) return;

    saveControllerRef.current?.abort();
    const controller = new AbortController();
    saveControllerRef.current = controller;
    setStatus('saving');
    const workspace = await modelingWorkspaceClient.update(
      workspaceId,
      { dsl: currentDsl },
      controller.signal
    );
    if (controller.signal.aborted) return;
    lastPersistedDslRef.current = currentDsl;
    mergeWorkspace(workspace);
    setStatus('saved');
  }, [mergeWorkspace]);

  useEffect(() => {
    const controller = new AbortController();

    void modelingWorkspaceClient.list(controller.signal)
      .then(async (listedWorkspaces) => {
        if (controller.signal.aborted) return;
        let availableWorkspaces = listedWorkspaces;
        if (availableWorkspaces.length === 0) {
          const workspace = await modelingWorkspaceClient.create({
            name: 'Default workspace',
            dsl: initialDsl
          }, controller.signal);
          availableWorkspaces = [workspace];
        }
        if (controller.signal.aborted) return;

        setWorkspaces(availableWorkspaces);
        const preferredWorkspaceId = loadSelectedWorkspaceId();
        const selectedWorkspace = availableWorkspaces.find(
          (workspace) => workspace.id === preferredWorkspaceId
        ) ?? availableWorkspaces[0];
        await loadWorkspace(selectedWorkspace.id, true);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error(error);
        setStatus('offline');
      });

    return () => {
      controller.abort();
      loadControllerRef.current?.abort();
      saveControllerRef.current?.abort();
    };
  }, [initialDsl, loadWorkspace]);

  useEffect(() => {
    const workspaceId = activeWorkspaceIdRef.current;
    if (!ready || !workspaceId || debouncedDsl !== latestDslRef.current) return;
    if (debouncedDsl === lastPersistedDslRef.current) {
      setStatus('saved');
      return;
    }

    saveControllerRef.current?.abort();
    const controller = new AbortController();
    saveControllerRef.current = controller;
    const dslToSave = debouncedDsl;
    setStatus('saving');

    void modelingWorkspaceClient.update(workspaceId, { dsl: dslToSave }, controller.signal)
      .then((workspace) => {
        if (controller.signal.aborted || activeWorkspaceIdRef.current !== workspaceId) return;
        lastPersistedDslRef.current = dslToSave;
        mergeWorkspace(workspace);
        setStatus(latestDslRef.current === dslToSave ? 'saved' : 'saving');
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error(error);
        setStatus('offline');
      });

    return () => controller.abort();
  }, [debouncedDsl, mergeWorkspace, ready]);

  const updateDsl = useCallback((nextDsl: string) => {
    editedBeforeReadyRef.current = true;
    saveControllerRef.current?.abort();
    latestDslRef.current = nextDsl;
    setDsl(nextDsl);
    if (ready) setStatus('saving');
  }, [ready]);

  const switchWorkspace = useCallback(async (workspaceId: string) => {
    if (workspaceId === activeWorkspaceIdRef.current) return;
    try {
      await persistCurrentDsl();
      editedBeforeReadyRef.current = false;
      await loadWorkspace(workspaceId);
    } catch (error) {
      console.error(error);
      setStatus('offline');
    }
  }, [loadWorkspace, persistCurrentDsl]);

  const createWorkspace = useCallback(async (name: string) => {
    try {
      await persistCurrentDsl();
      const workspace = await modelingWorkspaceClient.create({ name, dsl: '' });
      mergeWorkspace(workspace);
      editedBeforeReadyRef.current = false;
      await loadWorkspace(workspace.id);
    } catch (error) {
      console.error(error);
      setStatus('offline');
    }
  }, [loadWorkspace, mergeWorkspace, persistCurrentDsl]);

  const renameWorkspace = useCallback(async (name: string) => {
    const workspaceId = activeWorkspaceIdRef.current;
    if (!workspaceId) return;
    try {
      const workspace = await modelingWorkspaceClient.update(workspaceId, { name });
      mergeWorkspace(workspace);
    } catch (error) {
      console.error(error);
      setStatus('offline');
    }
  }, [mergeWorkspace]);

  const deleteWorkspace = useCallback(async () => {
    const workspaceId = activeWorkspaceIdRef.current;
    if (!workspaceId || workspaces.length <= 1) return;
    const nextWorkspace = workspaces.find((workspace) => workspace.id !== workspaceId);
    if (!nextWorkspace) return;

    try {
      saveControllerRef.current?.abort();
      await modelingWorkspaceClient.remove(workspaceId);
      setWorkspaces((current) => current.filter((workspace) => workspace.id !== workspaceId));
      setVersions([]);
      editedBeforeReadyRef.current = false;
      await loadWorkspace(nextWorkspace.id);
    } catch (error) {
      console.error(error);
      setStatus('offline');
    }
  }, [loadWorkspace, workspaces]);

  const createVersion = useCallback(async (input: CreateModelingWorkspaceVersionInput) => {
    const workspaceId = activeWorkspaceIdRef.current;
    if (!workspaceId) return undefined;
    const currentDsl = latestDslRef.current;

    setVersionStatus('loading');
    try {
      const result = await modelingWorkspaceClient.createVersion(workspaceId, {
        ...input,
        dsl: currentDsl
      });
      lastPersistedDslRef.current = result.workspace.dsl;
      latestDslRef.current = result.workspace.dsl;
      setDsl(result.workspace.dsl);
      mergeWorkspace(result.workspace);
      setVersions((current) => [
        result.version,
        ...current.filter((version) => version.id !== result.version.id)
      ]);
      setStatus('saved');
      setVersionStatus('ready');
      return result.version;
    } catch (error) {
      console.error(error);
      setVersionStatus('offline');
      setStatus('offline');
      throw error;
    }
  }, [mergeWorkspace]);

  const loadVersion = useCallback(async (versionId: string): Promise<ModelingWorkspaceVersion | undefined> => {
    const workspaceId = activeWorkspaceIdRef.current;
    if (!workspaceId) return undefined;
    return modelingWorkspaceClient.getVersion(workspaceId, versionId);
  }, []);

  const restoreVersion = useCallback(async (versionId: string) => {
    const workspaceId = activeWorkspaceIdRef.current;
    if (!workspaceId) return;

    saveControllerRef.current?.abort();
    setStatus('loading');
    setVersionStatus('loading');
    try {
      const workspace = await modelingWorkspaceClient.restoreVersion(workspaceId, versionId);
      activeWorkspaceIdRef.current = workspace.id;
      latestDslRef.current = workspace.dsl;
      lastPersistedDslRef.current = workspace.dsl;
      editedBeforeReadyRef.current = false;
      setDsl(workspace.dsl);
      setWorkspaceRevision((revision) => revision + 1);
      mergeWorkspace(workspace);
      setStatus('saved');
      await loadWorkspaceVersions(workspace.id);
    } catch (error) {
      console.error(error);
      setStatus('offline');
      setVersionStatus('offline');
      throw error;
    }
  }, [loadWorkspaceVersions, mergeWorkspace]);

  return {
    dsl,
    updateDsl,
    workspaces,
    versions,
    versionStatus,
    activeWorkspaceId,
    activeWorkspace: workspaces.find((workspace) => workspace.id === activeWorkspaceId),
    status,
    workspaceRevision,
    switchWorkspace,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    createVersion,
    loadVersion,
    restoreVersion
  };
};

const loadSelectedWorkspaceId = (): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage.getItem(selectedWorkspaceStorageKey) ?? undefined;
};

const persistSelectedWorkspaceId = (workspaceId: string): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(selectedWorkspaceStorageKey, workspaceId);
};
