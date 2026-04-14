import { create } from "zustand";
import type { Project, ProjectFile } from "../types";

const STORAGE_KEY = "pdf-canvas-projects";

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  activeFileId: string | null;

  createProject: () => string;
  switchProject: (id: string) => void;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  addFile: (projectId: string, file: ProjectFile) => void;
  removeFile: (projectId: string, fileId: string) => void;
  openFile: (fileId: string) => void;
  closeFile: () => void;
  hydrate: () => void;
}

function persist(state: Pick<ProjectState, "projects" | "activeProjectId" | "activeFileId">) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        activeFileId: state.activeFileId,
      }),
    );
  } catch {
    /* quota exceeded */
  }
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  activeFileId: null,

  createProject: () => {
    const id = crypto.randomUUID();
    const project: Project = {
      id,
      name: "New Page",
      emoji: "📄",
      createdAt: Date.now(),
      files: [],
    };
    set((s) => {
      const projects = [...s.projects, project];
      const next = { projects, activeProjectId: id, activeFileId: null };
      persist(next);
      return next;
    });
    return id;
  },

  switchProject: (id) => {
    const { projects } = get();
    if (!projects.some((p) => p.id === id)) return;
    set({ activeProjectId: id, activeFileId: null });
    persist({ projects, activeProjectId: id, activeFileId: null });
  },

  deleteProject: (id) =>
    set((s) => {
      const project = s.projects.find((p) => p.id === id);
      const projects = s.projects.filter((p) => p.id !== id);
      const activeProjectId =
        s.activeProjectId === id
          ? (projects[0]?.id ?? null)
          : s.activeProjectId;
      const activeFileId = s.activeProjectId === id ? null : s.activeFileId;
      persist({ projects, activeProjectId, activeFileId });

      if (project) {
        try {
          for (const file of project.files) {
            localStorage.removeItem(`pdf-canvas-links-${file.id}`);
            localStorage.removeItem(`pdf-canvas-scene-${file.id}`);
          }
        } catch {
          /* ignore */
        }
      }

      return { projects, activeProjectId, activeFileId };
    }),

  renameProject: (id, name) =>
    set((s) => {
      const projects = s.projects.map((p) =>
        p.id === id ? { ...p, name } : p,
      );
      persist({ projects, activeProjectId: s.activeProjectId, activeFileId: s.activeFileId });
      return { projects };
    }),

  addFile: (projectId, file) =>
    set((s) => {
      const projects = s.projects.map((p) =>
        p.id === projectId ? { ...p, files: [...p.files, file] } : p,
      );
      persist({ projects, activeProjectId: s.activeProjectId, activeFileId: s.activeFileId });
      return { projects };
    }),

  removeFile: (projectId, fileId) =>
    set((s) => {
      const projects = s.projects.map((p) =>
        p.id === projectId
          ? { ...p, files: p.files.filter((f) => f.id !== fileId) }
          : p,
      );
      const activeFileId = s.activeFileId === fileId ? null : s.activeFileId;
      persist({ projects, activeProjectId: s.activeProjectId, activeFileId });

      try {
        localStorage.removeItem(`pdf-canvas-links-${fileId}`);
        localStorage.removeItem(`pdf-canvas-scene-${fileId}`);
      } catch {
        /* ignore */
      }

      return { projects, activeFileId };
    }),

  openFile: (fileId) =>
    set((s) => {
      persist({ projects: s.projects, activeProjectId: s.activeProjectId, activeFileId: fileId });
      return { activeFileId: fileId };
    }),

  closeFile: () =>
    set((s) => {
      persist({ projects: s.projects, activeProjectId: s.activeProjectId, activeFileId: null });
      return { activeFileId: null };
    }),

  hydrate: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      set({
        projects: (data.projects ?? []).map((p: Project) => ({
          ...p,
          files: p.files ?? [],
        })),
        activeProjectId: data.activeProjectId ?? null,
        activeFileId: data.activeFileId ?? null,
      });
    } catch {
      /* corrupt data */
    }
  },
}));
