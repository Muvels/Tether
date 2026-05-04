import { create } from "zustand";
import type { LinkEntry, PdfDeepLink, StoredScene } from "../types";
import { extractLinksFromScene } from "../utils/scenePersistence";

interface WorkspaceSession {
  pdfBytes: Uint8Array;
  links: LinkEntry[];
  scene: StoredScene | null;
  sceneRevision: number;
  savedSceneRevision: number;
  hasUnsavedChanges: boolean;
  lastSavedAt: number | null;
}

interface PendingLinkedElement {
  fileId: string;
  elementId: string;
  pdfLink: PdfDeepLink;
}

interface LinkState {
  workspaceSessions: Record<string, WorkspaceSession>;
  dirtyFileIds: string[];
  hasAnyUnsavedChanges: boolean;
  currentFileId: string | null;
  pdfBytes: Uint8Array | null;
  links: LinkEntry[];
  activeLink: PdfDeepLink | null;
  linkingElementId: string | null;
  pendingLinkedElement: PendingLinkedElement | null;
  isLoading: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSavedAt: number | null;

  syncSceneState: (
    fileId: string,
    scene: StoredScene | null,
    sceneRevision: number,
  ) => void;
  setActiveLink: (link: PdfDeepLink | null) => void;
  clearActiveLink: () => void;
  startLinking: (elementId: string) => void;
  cancelLinking: () => void;
  completeLinking: (pdfLink: PdfDeepLink) => void;
  clearPendingLinkedElement: () => void;
  getLinkForElement: (elementId: string) => PdfDeepLink | undefined;
  getSceneForFile: (fileId: string | null) => StoredScene | null;
  getSceneRevisionForFile: (fileId: string | null) => number;
  loadFile: (fileId: string | null) => Promise<void>;
  clearWorkspace: () => void;
  saveCurrentFile: () => Promise<void>;
  saveAllDirtyFiles: () => Promise<void>;
  forgetFileSession: (fileId: string) => void;
  forgetSessionsForFiles: (fileIds: string[]) => void;
}

type DirtyState = Pick<LinkState, "dirtyFileIds" | "hasAnyUnsavedChanges" | "hasUnsavedChanges">;

function hasSessionChanges(session: Pick<WorkspaceSession, "sceneRevision" | "savedSceneRevision">) {
  return session.sceneRevision !== session.savedSceneRevision;
}

function updateDirtyFileIds(
  dirtyFileIds: string[],
  fileId: string,
  wasDirty: boolean,
  isDirty: boolean,
) {
  if (wasDirty === isDirty) {
    return dirtyFileIds;
  }

  if (isDirty) {
    return dirtyFileIds.includes(fileId) ? dirtyFileIds : [...dirtyFileIds, fileId];
  }

  return dirtyFileIds.filter((candidate) => candidate !== fileId);
}

function buildDirtyState(
  dirtyFileIds: string[],
  currentFileId: string | null,
  workspaceSessions: Record<string, WorkspaceSession>,
): DirtyState {
  return {
    dirtyFileIds,
    hasAnyUnsavedChanges: dirtyFileIds.length > 0,
    hasUnsavedChanges: currentFileId
      ? Boolean(workspaceSessions[currentFileId]?.hasUnsavedChanges)
      : false,
  };
}

function getActiveSessionState(session: WorkspaceSession | null) {
  return {
    pdfBytes: session?.pdfBytes ?? null,
    links: session?.links ?? [],
    hasUnsavedChanges: session?.hasUnsavedChanges ?? false,
    lastSavedAt: session?.lastSavedAt ?? null,
  };
}

function createSessionPatch(
  state: LinkState,
  fileId: string,
  nextSession: WorkspaceSession,
): Partial<LinkState> {
  const previousSession = state.workspaceSessions[fileId];
  const workspaceSessions = {
    ...state.workspaceSessions,
    [fileId]: nextSession,
  };
  const dirtyFileIds = updateDirtyFileIds(
    state.dirtyFileIds,
    fileId,
    previousSession?.hasUnsavedChanges ?? false,
    nextSession.hasUnsavedChanges,
  );

  return {
    workspaceSessions,
    ...buildDirtyState(dirtyFileIds, state.currentFileId, workspaceSessions),
    ...(state.currentFileId === fileId ? getActiveSessionState(nextSession) : {}),
  };
}

function clearActiveWorkspaceState(state: LinkState): Partial<LinkState> {
  const dirtyState = buildDirtyState(state.dirtyFileIds, null, state.workspaceSessions);

  return {
    currentFileId: null,
    pdfBytes: null,
    links: [],
    activeLink: null,
    linkingElementId: null,
    pendingLinkedElement: null,
    isLoading: false,
    isSaving: false,
    lastSavedAt: null,
    ...dirtyState,
  };
}

async function persistScene(fileId: string, scene: StoredScene | null) {
  await window.desktopApi.saveScene(fileId, scene);
}

let loadRequestId = 0;

export const useLinkStore = create<LinkState>((set, get) => ({
  workspaceSessions: {},
  dirtyFileIds: [],
  hasAnyUnsavedChanges: false,
  currentFileId: null,
  pdfBytes: null,
  links: [],
  activeLink: null,
  linkingElementId: null,
  pendingLinkedElement: null,
  isLoading: false,
  isSaving: false,
  hasUnsavedChanges: false,
  lastSavedAt: null,

  syncSceneState: (fileId, scene, sceneRevision) =>
    set((state) => {
      const session = state.workspaceSessions[fileId];
      if (!session) return state;

      const nextSession: WorkspaceSession = {
        ...session,
        scene,
        links: extractLinksFromScene(scene),
        sceneRevision,
      };
      nextSession.hasUnsavedChanges = hasSessionChanges(nextSession);

      return createSessionPatch(state, fileId, nextSession);
    }),

  setActiveLink: (link) => set({ activeLink: link }),

  clearActiveLink: () => set({ activeLink: null }),

  startLinking: (elementId) => set({ linkingElementId: elementId }),

  cancelLinking: () => set({ linkingElementId: null }),

  completeLinking: (pdfLink) => {
    const { currentFileId, linkingElementId } = get();
    if (!currentFileId || !linkingElementId) return;

    set({
      linkingElementId: null,
      pendingLinkedElement: {
        fileId: currentFileId,
        elementId: linkingElementId,
        pdfLink,
      },
    });
  },

  clearPendingLinkedElement: () => set({ pendingLinkedElement: null }),

  getLinkForElement: (elementId) =>
    get().links.find((link) => link.elementId === elementId)?.pdfLink,

  getSceneForFile: (fileId) => {
    if (!fileId) return null;
    return get().workspaceSessions[fileId]?.scene ?? null;
  },

  getSceneRevisionForFile: (fileId) => {
    if (!fileId) return 0;
    return get().workspaceSessions[fileId]?.sceneRevision ?? 0;
  },

  loadFile: async (fileId) => {
    const requestId = ++loadRequestId;

    if (!fileId) {
      set((state) => clearActiveWorkspaceState(state));
      return;
    }

    const cachedSession = get().workspaceSessions[fileId];
    if (cachedSession) {
      set((state) => ({
        workspaceSessions: state.workspaceSessions,
        currentFileId: fileId,
        ...getActiveSessionState(cachedSession),
        activeLink: null,
        linkingElementId: null,
        pendingLinkedElement: null,
        isLoading: false,
        isSaving: false,
        ...buildDirtyState(state.dirtyFileIds, fileId, state.workspaceSessions),
      }));
      return;
    }

    set({
      isLoading: true,
      activeLink: null,
      linkingElementId: null,
      pendingLinkedElement: null,
    });

    try {
      const workspace = await window.desktopApi.openWorkspace(fileId);
      if (requestId !== loadRequestId) {
        return;
      }

      const session: WorkspaceSession = {
        pdfBytes: new Uint8Array(workspace.pdfBytes),
        links: workspace.links,
        scene: workspace.scene,
        sceneRevision: 0,
        savedSceneRevision: 0,
        hasUnsavedChanges: false,
        lastSavedAt: null,
      };

      set((state) => {
        const workspaceSessions = {
          ...state.workspaceSessions,
          [fileId]: session,
        };

        return {
          workspaceSessions,
          currentFileId: fileId,
          ...getActiveSessionState(session),
          activeLink: null,
          linkingElementId: null,
          pendingLinkedElement: null,
          isLoading: false,
          isSaving: false,
          ...buildDirtyState(state.dirtyFileIds, fileId, workspaceSessions),
        };
      });
    } catch (error) {
      if (requestId === loadRequestId) {
        set({ isLoading: false });
      }
      throw error;
    }
  },

  clearWorkspace: () =>
    set((state) => ({
      workspaceSessions: {},
      dirtyFileIds: [],
      hasAnyUnsavedChanges: false,
      ...clearActiveWorkspaceState({
        ...state,
        workspaceSessions: {},
        dirtyFileIds: [],
      }),
    })),

  saveCurrentFile: async () => {
    const { currentFileId } = get();
    if (!currentFileId) return;

    set({ isSaving: true });

    try {
      const session = get().workspaceSessions[currentFileId];
      if (!session) {
        set({ isSaving: false });
        return;
      }

      await persistScene(currentFileId, session.scene);

      const savedAt = Date.now();

      set((state) => {
        const currentSession = state.workspaceSessions[currentFileId];
        if (!currentSession) {
          return { isSaving: false };
        }

        if (currentSession.sceneRevision !== session.sceneRevision) {
          return { isSaving: false };
        }

        const nextSession: WorkspaceSession = {
          ...currentSession,
          savedSceneRevision: currentSession.sceneRevision,
          hasUnsavedChanges: false,
          lastSavedAt: savedAt,
        };

        return {
          isSaving: false,
          ...createSessionPatch(state, currentFileId, nextSession),
        };
      });
    } catch (error) {
      set({ isSaving: false });
      throw error;
    }
  },

  saveAllDirtyFiles: async () => {
    const dirtySessions = Object.entries(get().workspaceSessions)
      .filter(([, session]) => session.hasUnsavedChanges)
      .map(([fileId, session]) => ({
        fileId,
        scene: session.scene,
        sceneRevision: session.sceneRevision,
      }));

    if (dirtySessions.length === 0) return;

    await Promise.all(
      dirtySessions.map((session) => persistScene(session.fileId, session.scene)),
    );

    const savedAt = Date.now();

    set((state) => {
      let workspaceSessions = state.workspaceSessions;
      let dirtyFileIds = state.dirtyFileIds;

      for (const { fileId, sceneRevision } of dirtySessions) {
        const session = workspaceSessions[fileId];
        if (!session || session.sceneRevision !== sceneRevision) {
          continue;
        }

        if (workspaceSessions === state.workspaceSessions) {
          workspaceSessions = { ...workspaceSessions };
        }

        const nextSession: WorkspaceSession = {
          ...session,
          savedSceneRevision: session.sceneRevision,
          hasUnsavedChanges: false,
          lastSavedAt: savedAt,
        };

        workspaceSessions[fileId] = nextSession;
        dirtyFileIds = updateDirtyFileIds(
          dirtyFileIds,
          fileId,
          session.hasUnsavedChanges,
          nextSession.hasUnsavedChanges,
        );
      }

      const activeSession = state.currentFileId
        ? workspaceSessions[state.currentFileId] ?? null
        : null;

      return {
        workspaceSessions,
        ...getActiveSessionState(activeSession),
        ...buildDirtyState(dirtyFileIds, state.currentFileId, workspaceSessions),
      };
    });
  },

  forgetFileSession: (fileId) =>
    set((state) => {
      if (!(fileId in state.workspaceSessions)) return state;

      const { [fileId]: removedSession, ...workspaceSessions } = state.workspaceSessions;
      void removedSession;

      const dirtyFileIds = state.dirtyFileIds.filter((candidate) => candidate !== fileId);

      if (state.currentFileId === fileId) {
        return {
          workspaceSessions,
          ...clearActiveWorkspaceState({
            ...state,
            workspaceSessions,
            dirtyFileIds,
          }),
        };
      }

      return {
        workspaceSessions,
        ...buildDirtyState(dirtyFileIds, state.currentFileId, workspaceSessions),
      };
    }),

  forgetSessionsForFiles: (fileIds) =>
    set((state) => {
      if (fileIds.length === 0) return state;

      let workspaceSessions = state.workspaceSessions;
      let didChange = false;
      let dirtyFileIds = state.dirtyFileIds;

      for (const fileId of fileIds) {
        if (!(fileId in workspaceSessions)) continue;
        if (!didChange) {
          workspaceSessions = { ...workspaceSessions };
          didChange = true;
        }
        delete workspaceSessions[fileId];
        dirtyFileIds = dirtyFileIds.filter((candidate) => candidate !== fileId);
      }

      if (!didChange) return state;

      if (state.currentFileId && !workspaceSessions[state.currentFileId]) {
        return {
          workspaceSessions,
          ...clearActiveWorkspaceState({
            ...state,
            workspaceSessions,
            dirtyFileIds,
          }),
        };
      }

      return {
        workspaceSessions,
        ...buildDirtyState(dirtyFileIds, state.currentFileId, workspaceSessions),
      };
    }),
}));
