import { create } from "zustand";
import type { LinkEntry, PdfDeepLink, StoredScene } from "../types";

interface WorkspaceSession {
  pdfBytes: Uint8Array;
  links: LinkEntry[];
  scene: StoredScene | null;
  savedLinks: LinkEntry[];
  savedScene: StoredScene | null;
  hasUnsavedChanges: boolean;
  lastSavedAt: number | null;
}

interface LinkState {
  workspaceSessions: Record<string, WorkspaceSession>;
  dirtyFileIds: string[];
  hasAnyUnsavedChanges: boolean;
  currentFileId: string | null;
  pdfBytes: Uint8Array | null;
  links: LinkEntry[];
  scene: StoredScene | null;
  savedLinks: LinkEntry[];
  savedScene: StoredScene | null;
  activeLink: PdfDeepLink | null;
  linkingElementId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSavedAt: number | null;

  addLink: (entry: LinkEntry) => void;
  removeLink: (elementId: string) => void;
  setScene: (scene: StoredScene | null) => void;
  syncSceneBaseline: (scene: StoredScene | null) => void;
  markDirty: () => void;
  setActiveLink: (link: PdfDeepLink | null) => void;
  clearActiveLink: () => void;
  startLinking: (elementId: string) => void;
  cancelLinking: () => void;
  completeLinking: (pdfLink: PdfDeepLink) => void;
  getLinkForElement: (elementId: string) => PdfDeepLink | undefined;
  loadFile: (fileId: string | null) => Promise<void>;
  clearWorkspace: () => void;
  saveCurrentFile: () => Promise<void>;
  saveAllDirtyFiles: () => Promise<void>;
  forgetFileSession: (fileId: string) => void;
  forgetSessionsForFiles: (fileIds: string[]) => void;
}

type DirtyState = Pick<LinkState, "dirtyFileIds" | "hasAnyUnsavedChanges" | "hasUnsavedChanges">;

async function persistWorkspace(state: Pick<LinkState, "currentFileId" | "links" | "scene">) {
  if (!state.currentFileId) return;
  await Promise.all([
    window.desktopApi.saveLinks(state.currentFileId, state.links),
    window.desktopApi.saveScene(state.currentFileId, state.scene),
  ]);
}

async function persistSession(fileId: string, session: Pick<WorkspaceSession, "links" | "scene">) {
  await Promise.all([
    window.desktopApi.saveLinks(fileId, session.links),
    window.desktopApi.saveScene(fileId, session.scene),
  ]);
}

function serializeScene(scene: StoredScene | null) {
  return JSON.stringify(scene);
}

function scenesAreEqual(left: StoredScene | null, right: StoredScene | null) {
  return serializeScene(left) === serializeScene(right);
}

function linksAreEqual(left: LinkEntry[], right: LinkEntry[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function hasWorkspaceChanges(state: Pick<LinkState, "currentFileId" | "links" | "scene" | "savedLinks" | "savedScene">) {
  if (!state.currentFileId) return false;
  return (
    !linksAreEqual(state.links, state.savedLinks) ||
    !scenesAreEqual(state.scene, state.savedScene)
  );
}

function buildDirtyState(
  workspaceSessions: Record<string, WorkspaceSession>,
  currentFileId: string | null,
): DirtyState {
  const dirtyFileIds = Object.entries(workspaceSessions)
    .filter(([, session]) => session.hasUnsavedChanges)
    .map(([fileId]) => fileId);

  return {
    dirtyFileIds,
    hasAnyUnsavedChanges: dirtyFileIds.length > 0,
    hasUnsavedChanges: currentFileId
      ? Boolean(workspaceSessions[currentFileId]?.hasUnsavedChanges)
      : false,
  };
}

function createSessionPatch(
  state: LinkState,
  nextSession: WorkspaceSession,
): Partial<LinkState> {
  if (!state.currentFileId) {
    return {};
  }

  const workspaceSessions = {
    ...state.workspaceSessions,
    [state.currentFileId]: nextSession,
  };
  const dirtyState = buildDirtyState(workspaceSessions, state.currentFileId);

  return {
    workspaceSessions,
    pdfBytes: nextSession.pdfBytes,
    links: nextSession.links,
    scene: nextSession.scene,
    savedLinks: nextSession.savedLinks,
    savedScene: nextSession.savedScene,
    lastSavedAt: nextSession.lastSavedAt,
    ...dirtyState,
  };
}

function clearActiveWorkspaceState(state: LinkState): Partial<LinkState> {
  const dirtyState = buildDirtyState(state.workspaceSessions, null);

  return {
    currentFileId: null,
    pdfBytes: null,
    links: [],
    scene: null,
    savedLinks: [],
    savedScene: null,
    activeLink: null,
    linkingElementId: null,
    isLoading: false,
    isSaving: false,
    lastSavedAt: null,
    ...dirtyState,
  };
}

let loadRequestId = 0;

export const useLinkStore = create<LinkState>((set, get) => ({
  workspaceSessions: {},
  dirtyFileIds: [],
  hasAnyUnsavedChanges: false,
  currentFileId: null,
  pdfBytes: null,
  links: [],
  scene: null,
  savedLinks: [],
  savedScene: null,
  activeLink: null,
  linkingElementId: null,
  isLoading: false,
  isSaving: false,
  hasUnsavedChanges: false,
  lastSavedAt: null,

  addLink: (entry) =>
    set((state) => {
      if (!state.currentFileId || !state.pdfBytes) return state;

      const links = [...state.links.filter((link) => link.elementId !== entry.elementId), entry];
      const hasUnsavedChanges = hasWorkspaceChanges({ ...state, links });

      return createSessionPatch(state, {
        pdfBytes: state.pdfBytes,
        links,
        scene: state.scene,
        savedLinks: state.savedLinks,
        savedScene: state.savedScene,
        hasUnsavedChanges,
        lastSavedAt: state.lastSavedAt,
      });
    }),

  removeLink: (elementId) =>
    set((state) => {
      if (!state.currentFileId || !state.pdfBytes) return state;

      const links = state.links.filter((link) => link.elementId !== elementId);
      if (links.length === state.links.length) return state;

      const hasUnsavedChanges = hasWorkspaceChanges({ ...state, links });

      return createSessionPatch(state, {
        pdfBytes: state.pdfBytes,
        links,
        scene: state.scene,
        savedLinks: state.savedLinks,
        savedScene: state.savedScene,
        hasUnsavedChanges,
        lastSavedAt: state.lastSavedAt,
      });
    }),

  setScene: (scene) =>
    set((state) => {
      if (!state.currentFileId || !state.pdfBytes) return state;
      if (scenesAreEqual(state.scene, scene)) return state;

      const hasUnsavedChanges = hasWorkspaceChanges({ ...state, scene });

      return createSessionPatch(state, {
        pdfBytes: state.pdfBytes,
        links: state.links,
        scene,
        savedLinks: state.savedLinks,
        savedScene: state.savedScene,
        hasUnsavedChanges,
        lastSavedAt: state.lastSavedAt,
      });
    }),

  syncSceneBaseline: (scene) =>
    set((state) => {
      if (!state.currentFileId || !state.pdfBytes) return state;

      const hasUnsavedChanges = hasWorkspaceChanges({
        ...state,
        scene,
        savedScene: scene,
      });

      return createSessionPatch(state, {
        pdfBytes: state.pdfBytes,
        links: state.links,
        scene,
        savedLinks: state.savedLinks,
        savedScene: scene,
        hasUnsavedChanges,
        lastSavedAt: state.lastSavedAt,
      });
    }),

  markDirty: () =>
    set((state) => {
      if (!state.currentFileId || !state.pdfBytes) return state;

      const hasUnsavedChanges = hasWorkspaceChanges(state);

      return createSessionPatch(state, {
        pdfBytes: state.pdfBytes,
        links: state.links,
        scene: state.scene,
        savedLinks: state.savedLinks,
        savedScene: state.savedScene,
        hasUnsavedChanges,
        lastSavedAt: state.lastSavedAt,
      });
    }),

  setActiveLink: (link) => set({ activeLink: link }),

  clearActiveLink: () => set({ activeLink: null }),

  startLinking: (elementId) => set({ linkingElementId: elementId }),

  cancelLinking: () => set({ linkingElementId: null }),

  completeLinking: (pdfLink) => {
    const { linkingElementId } = get();
    if (!linkingElementId) return;
    get().addLink({ elementId: linkingElementId, pdfLink });
    set({ linkingElementId: null });
  },

  getLinkForElement: (elementId) =>
    get().links.find((link) => link.elementId === elementId)?.pdfLink,

  loadFile: async (fileId) => {
    const requestId = ++loadRequestId;

    if (!fileId) {
      set((state) => clearActiveWorkspaceState(state));
      return;
    }

    const cachedSession = get().workspaceSessions[fileId];
    if (cachedSession) {
      set((state) => {
        const workspaceSessions = {
          ...state.workspaceSessions,
          [fileId]: cachedSession,
        };
        const dirtyState = buildDirtyState(workspaceSessions, fileId);

        return {
          workspaceSessions,
          currentFileId: fileId,
          pdfBytes: cachedSession.pdfBytes,
          links: cachedSession.links,
          scene: cachedSession.scene,
          savedLinks: cachedSession.savedLinks,
          savedScene: cachedSession.savedScene,
          activeLink: null,
          linkingElementId: null,
          isLoading: false,
          isSaving: false,
          lastSavedAt: cachedSession.lastSavedAt,
          ...dirtyState,
        };
      });
      return;
    }

    set({ isLoading: true, activeLink: null, linkingElementId: null });

    try {
      const workspace = await window.desktopApi.openWorkspace(fileId);
      if (requestId !== loadRequestId) {
        return;
      }

      const session: WorkspaceSession = {
        pdfBytes: new Uint8Array(workspace.pdfBytes),
        links: workspace.links,
        scene: workspace.scene,
        savedLinks: workspace.links,
        savedScene: workspace.scene,
        hasUnsavedChanges: false,
        lastSavedAt: null,
      };

      set((state) => {
        const workspaceSessions = {
          ...state.workspaceSessions,
          [fileId]: session,
        };
        const dirtyState = buildDirtyState(workspaceSessions, fileId);

        return {
          workspaceSessions,
          currentFileId: fileId,
          pdfBytes: session.pdfBytes,
          links: session.links,
          scene: session.scene,
          savedLinks: session.savedLinks,
          savedScene: session.savedScene,
          activeLink: null,
          linkingElementId: null,
          isLoading: false,
          isSaving: false,
          lastSavedAt: null,
          ...dirtyState,
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
      ...clearActiveWorkspaceState(state),
    })),

  saveCurrentFile: async () => {
    const { currentFileId, links, scene } = get();
    if (!currentFileId) return;

    set({ isSaving: true });

    try {
      await persistWorkspace({ currentFileId, links, scene });

      set((state) => {
        if (state.currentFileId !== currentFileId || !state.pdfBytes) {
          return { isSaving: false };
        }

        if (
          !linksAreEqual(state.links, links) ||
          !scenesAreEqual(state.scene, scene)
        ) {
          return { isSaving: false };
        }

        return createSessionPatch(state, {
          pdfBytes: state.pdfBytes,
          links,
          scene,
          savedLinks: links,
          savedScene: scene,
          hasUnsavedChanges: false,
          lastSavedAt: Date.now(),
        });
      });

      set({ isSaving: false });
    } catch (error) {
      set({ isSaving: false });
      throw error;
    }
  },

  saveAllDirtyFiles: async () => {
    const dirtySessions = Object.entries(get().workspaceSessions).filter(
      ([, session]) => session.hasUnsavedChanges,
    );

    if (dirtySessions.length === 0) return;

    await Promise.all(
      dirtySessions.map(([fileId, session]) =>
        persistSession(fileId, { links: session.links, scene: session.scene }),
      ),
    );

    const savedAt = Date.now();

    set((state) => {
      const workspaceSessions = { ...state.workspaceSessions };

      for (const [fileId] of dirtySessions) {
        const session = workspaceSessions[fileId];
        if (!session) continue;

        workspaceSessions[fileId] = {
          ...session,
          savedLinks: session.links,
          savedScene: session.scene,
          hasUnsavedChanges: false,
          lastSavedAt: savedAt,
        };
      }

      const activeSession = state.currentFileId
        ? workspaceSessions[state.currentFileId]
        : null;
      const dirtyState = buildDirtyState(workspaceSessions, state.currentFileId);

      return {
        workspaceSessions,
        savedLinks: activeSession?.savedLinks ?? state.savedLinks,
        savedScene: activeSession?.savedScene ?? state.savedScene,
        lastSavedAt: activeSession?.lastSavedAt ?? state.lastSavedAt,
        ...dirtyState,
      };
    });
  },

  forgetFileSession: (fileId) =>
    set((state) => {
      if (!(fileId in state.workspaceSessions)) return state;

      const { [fileId]: removedSession, ...workspaceSessions } = state.workspaceSessions;
      void removedSession;

      if (state.currentFileId === fileId) {
        return {
          workspaceSessions,
          ...clearActiveWorkspaceState({
            ...state,
            workspaceSessions,
          }),
        };
      }

      const dirtyState = buildDirtyState(workspaceSessions, state.currentFileId);
      return {
        workspaceSessions,
        ...dirtyState,
      };
    }),

  forgetSessionsForFiles: (fileIds) =>
    set((state) => {
      if (fileIds.length === 0) return state;

      let workspaceSessions = state.workspaceSessions;
      let didChange = false;

      for (const fileId of fileIds) {
        if (!(fileId in workspaceSessions)) continue;
        if (!didChange) {
          workspaceSessions = { ...workspaceSessions };
          didChange = true;
        }
        delete workspaceSessions[fileId];
      }

      if (!didChange) return state;

      if (state.currentFileId && !workspaceSessions[state.currentFileId]) {
        return {
          workspaceSessions,
          ...clearActiveWorkspaceState({
            ...state,
            workspaceSessions,
          }),
        };
      }

      const dirtyState = buildDirtyState(workspaceSessions, state.currentFileId);
      return {
        workspaceSessions,
        ...dirtyState,
      };
    }),
}));
