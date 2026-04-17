import { create } from "zustand";
import type { Project, ProjectFile } from "../types";

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  activeFileId: string | null;
  isHydrated: boolean;

  bootstrap: () => Promise<void>;
  createProject: () => Promise<string>;
  switchProject: (id: string) => void;
  deleteProject: (id: string) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  addFile: (projectId: string, file: File) => Promise<ProjectFile>;
  renameFile: (projectId: string, fileId: string, name: string) => Promise<void>;
  removeFile: (projectId: string, fileId: string) => Promise<void>;
  openFile: (fileId: string) => void;
  closeFile: () => void;
}

function getNextActiveProject(projects: Project[], preferredId: string | null) {
  if (preferredId && projects.some((project) => project.id === preferredId)) {
    return preferredId;
  }
  return projects[0]?.id ?? null;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  activeFileId: null,
  isHydrated: false,

  bootstrap: async () => {
    const snapshot = await window.desktopApi.bootstrap();
    set({
      projects: snapshot.projects,
      activeProjectId: snapshot.projects[0]?.id ?? null,
      activeFileId: null,
      isHydrated: true,
    });
  },

  createProject: async () => {
    const project = await window.desktopApi.createProject();
    set((state) => ({
      projects: [...state.projects, project],
      activeProjectId: project.id,
      activeFileId: null,
    }));
    return project.id;
  },

  switchProject: (id) => {
    const { projects } = get();
    if (!projects.some((project) => project.id === id)) return;
    set({ activeProjectId: id, activeFileId: null });
  },

  deleteProject: async (id) => {
    await window.desktopApi.deleteProject(id);
    set((state) => {
      const projects = state.projects.filter((project) => project.id !== id);
      return {
        projects,
        activeProjectId: getNextActiveProject(
          projects,
          state.activeProjectId === id ? null : state.activeProjectId,
        ),
        activeFileId: state.activeProjectId === id ? null : state.activeFileId,
      };
    });
  },

  renameProject: async (id, name) => {
    await window.desktopApi.renameProject({ projectId: id, name });
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === id ? { ...project, name } : project,
      ),
    }));
  },

  addFile: async (projectId, file) => {
    const bytes = await file.arrayBuffer();
    const projectFile = await window.desktopApi.importPdf({
      projectId,
      name: file.name,
      bytes,
    });

    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === projectId
          ? { ...project, files: [...project.files, projectFile] }
          : project,
      ),
    }));

    return projectFile;
  },

  renameFile: async (projectId, fileId, name) => {
    await window.desktopApi.renamePdf({ projectId, fileId, name });
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              files: project.files.map((file) =>
                file.id === fileId ? { ...file, name } : file,
              ),
            }
          : project,
      ),
    }));
  },

  removeFile: async (projectId, fileId) => {
    await window.desktopApi.deletePdf({ projectId, fileId });
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === projectId
          ? { ...project, files: project.files.filter((file) => file.id !== fileId) }
          : project,
      ),
      activeFileId: state.activeFileId === fileId ? null : state.activeFileId,
    }));
  },

  openFile: (fileId) => set({ activeFileId: fileId }),

  closeFile: () => set({ activeFileId: null }),
}));
