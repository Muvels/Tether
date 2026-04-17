import { create } from "zustand";
import type { LinkEntry, PdfDeepLink, StoredScene } from "../types";

interface LinkState {
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
}

async function persistWorkspace(state: Pick<LinkState, "currentFileId" | "links" | "scene">) {
  if (!state.currentFileId) return;
  await Promise.all([
    window.desktopApi.saveLinks(state.currentFileId, state.links),
    window.desktopApi.saveScene(state.currentFileId, state.scene),
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

export const useLinkStore = create<LinkState>((set, get) => ({
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
      const links = [...state.links.filter((link) => link.elementId !== entry.elementId), entry];
      return {
        links,
        hasUnsavedChanges: hasWorkspaceChanges({ ...state, links }),
      };
    }),

  removeLink: (elementId) =>
    set((state) => {
      const links = state.links.filter((link) => link.elementId !== elementId);
      if (links.length === state.links.length) return state;
      return {
        links,
        hasUnsavedChanges: hasWorkspaceChanges({ ...state, links }),
      };
    }),

  setScene: (scene) => {
    set((state) => {
      if (scenesAreEqual(state.scene, scene)) return state;
      return {
        scene,
        hasUnsavedChanges: hasWorkspaceChanges({ ...state, scene }),
      };
    });
  },

  syncSceneBaseline: (scene) =>
    set((state) => ({
      scene,
      savedScene: scene,
      hasUnsavedChanges: hasWorkspaceChanges({ ...state, scene, savedScene: scene }),
    })),

  markDirty: () => set((state) => ({ hasUnsavedChanges: hasWorkspaceChanges(state) })),

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
    if (!fileId) {
      set({
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
      });
      return;
    }

    set({ isLoading: true, activeLink: null, linkingElementId: null });

    try {
      const workspace = await window.desktopApi.openWorkspace(fileId);
      set({
        currentFileId: fileId,
        pdfBytes: new Uint8Array(workspace.pdfBytes),
        links: workspace.links,
        scene: workspace.scene,
        savedLinks: workspace.links,
        savedScene: workspace.scene,
        activeLink: null,
        linkingElementId: null,
        isLoading: false,
        isSaving: false,
        hasUnsavedChanges: false,
        lastSavedAt: null,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  clearWorkspace: () => {
    set({
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
    });
  },

  saveCurrentFile: async () => {
    const { currentFileId, links, scene } = get();
    if (!currentFileId) return;

    set({ isSaving: true });
    try {
      await persistWorkspace({ currentFileId, links, scene });
      const latest = get();
      if (
        latest.currentFileId === currentFileId &&
        linksAreEqual(latest.links, links) &&
        scenesAreEqual(latest.scene, scene)
      ) {
        set({
          savedLinks: links,
          savedScene: scene,
          hasUnsavedChanges: false,
          isSaving: false,
          lastSavedAt: Date.now(),
        });
        return;
      }
      set({ isSaving: false });
    } catch (error) {
      set({ isSaving: false });
      throw error;
    }
  },
}));
