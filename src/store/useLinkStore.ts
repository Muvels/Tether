import { create } from "zustand";
import type { PdfDeepLink, LinkEntry } from "../types";

interface LinkState {
  links: LinkEntry[];
  activeLink: PdfDeepLink | null;
  linkingElementId: string | null;
  pdfUrl: string | null;

  addLink: (entry: LinkEntry) => void;
  removeLink: (elementId: string) => void;
  setActiveLink: (link: PdfDeepLink | null) => void;
  clearActiveLink: () => void;
  startLinking: (elementId: string) => void;
  cancelLinking: () => void;
  completeLinking: (pdfLink: PdfDeepLink) => void;
  setPdfUrl: (url: string | null) => void;
  getLinkForElement: (elementId: string) => PdfDeepLink | undefined;
  hydrate: () => void;
}

const STORAGE_KEY = "pdf-canvas-linker-state";

function persist(state: Pick<LinkState, "links" | "pdfUrl">) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ links: state.links, pdfUrl: state.pdfUrl }),
    );
  } catch {
    /* quota exceeded – silently ignore */
  }
}

export const useLinkStore = create<LinkState>((set, get) => ({
  links: [],
  activeLink: null,
  linkingElementId: null,
  pdfUrl: null,

  addLink: (entry) =>
    set((s) => {
      const links = [...s.links.filter((l) => l.elementId !== entry.elementId), entry];
      persist({ links, pdfUrl: s.pdfUrl });
      return { links };
    }),

  removeLink: (elementId) =>
    set((s) => {
      const links = s.links.filter((l) => l.elementId !== elementId);
      persist({ links, pdfUrl: s.pdfUrl });
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

  setPdfUrl: (url) =>
    set((s) => {
      const urlChanged = url !== s.pdfUrl;
      const links = urlChanged ? [] : s.links;
      persist({ links, pdfUrl: url });
      return { pdfUrl: url, links, activeLink: urlChanged ? null : s.activeLink };
    }),

  getLinkForElement: (elementId) =>
    get().links.find((l) => l.elementId === elementId)?.pdfLink,

  hydrate: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      set({
        links: data.links ?? [],
        pdfUrl: data.pdfUrl ?? null,
      });
    } catch {
      /* corrupt data – ignore */
    }
  },
}));
