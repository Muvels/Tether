import { create } from "zustand";
import type { PdfDeepLink, LinkEntry } from "../types";
import { useProjectStore } from "./useProjectStore";

interface LinkState {
  links: LinkEntry[];
  activeLink: PdfDeepLink | null;
  linkingElementId: string | null;

  addLink: (entry: LinkEntry) => void;
  removeLink: (elementId: string) => void;
  setActiveLink: (link: PdfDeepLink | null) => void;
  clearActiveLink: () => void;
  startLinking: (elementId: string) => void;
  cancelLinking: () => void;
  completeLinking: (pdfLink: PdfDeepLink) => void;
  getLinkForElement: (elementId: string) => PdfDeepLink | undefined;
  loadFile: (fileId: string | null) => void;
  saveCurrentFile: () => void;
}

function storageKey(fileId: string | null) {
  if (!fileId) return "pdf-canvas-links-default";
  return `pdf-canvas-links-${fileId}`;
}

function persist(fileId: string | null, links: LinkEntry[]) {
  try {
    localStorage.setItem(storageKey(fileId), JSON.stringify({ links }));
  } catch {
    /* quota exceeded */
  }
}

function loadFromStorage(fileId: string | null): LinkEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(fileId));
    if (!raw) return [];
    const data = JSON.parse(raw);
    return data.links ?? [];
  } catch {
    return [];
  }
}

function getActiveFileId() {
  return useProjectStore.getState().activeFileId;
}

export const useLinkStore = create<LinkState>((set, get) => ({
  links: [],
  activeLink: null,
  linkingElementId: null,

  addLink: (entry) =>
    set((s) => {
      const links = [...s.links.filter((l) => l.elementId !== entry.elementId), entry];
      persist(getActiveFileId(), links);
      return { links };
    }),

  removeLink: (elementId) =>
    set((s) => {
      const links = s.links.filter((l) => l.elementId !== elementId);
      persist(getActiveFileId(), links);
      return { links };
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
    get().links.find((l) => l.elementId === elementId)?.pdfLink,

  saveCurrentFile: () => {
    const { links } = get();
    persist(getActiveFileId(), links);
  },

  loadFile: (fileId) => {
    const links = loadFromStorage(fileId);
    set({
      links,
      activeLink: null,
      linkingElementId: null,
    });
  },
}));
