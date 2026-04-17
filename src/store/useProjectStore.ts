import { create } from "zustand";
import type { Project, ProjectFile } from "../types";

export interface OpenTab {
  projectId: string;
  fileId: string;
}

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  activeFileId: string | null;
  openTabs: OpenTab[];
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
  closeTab: (fileId: string) => { nextProjectId: string | null; nextFileId: string | null };
  reorderTabs: (fromIndex: number, toIndex: number) => void;
}

function getNextActiveProject(projects: Project[], preferredId: string | null) {
  if (preferredId && projects.some((project) => project.id === preferredId)) {
    return preferredId;
  }
  return projects[0]?.id ?? null;
}

function findProjectIdForFile(projects: Project[], fileId: string): string | null {
  for (const project of projects) {
    if (project.files.some((file) => file.id === fileId)) {
      return project.id;
    }
  }
  return null;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  activeFileId: null,
  openTabs: [],
  isHydrated: false,

  bootstrap: async () => {
    const snapshot = await window.desktopApi.bootstrap();
    set({
      projects: snapshot.projects,
      activeProjectId: snapshot.projects[0]?.id ?? null,
      activeFileId: null,
      openTabs: [],
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
      const openTabs = state.openTabs.filter((tab) => tab.projectId !== id);
      const wasActiveProject = state.activeProjectId === id;
      return {
        projects,
        openTabs,
        activeProjectId: getNextActiveProject(
          projects,
          wasActiveProject ? null : state.activeProjectId,
        ),
        activeFileId: wasActiveProject ? null : state.activeFileId,
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
      openTabs: state.openTabs.filter((tab) => tab.fileId !== fileId),
      activeFileId: state.activeFileId === fileId ? null : state.activeFileId,
    }));
  },

  openFile: (fileId) =>
    set((state) => {
      const projectId = findProjectIdForFile(state.projects, fileId);
      if (!projectId) return state;

      const alreadyOpen = state.openTabs.some((tab) => tab.fileId === fileId);
      const openTabs = alreadyOpen
        ? state.openTabs
        : [...state.openTabs, { projectId, fileId }];

      return {
        openTabs,
        activeProjectId: projectId,
        activeFileId: fileId,
      };
    }),

  closeFile: () => set({ activeFileId: null }),

  closeTab: (fileId) => {
    const state = get();
    const index = state.openTabs.findIndex((tab) => tab.fileId === fileId);
    if (index === -1) {
      return { nextProjectId: state.activeProjectId, nextFileId: state.activeFileId };
    }

    const openTabs = state.openTabs.filter((tab) => tab.fileId !== fileId);
    const wasActive = state.activeFileId === fileId;

    let nextProjectId = state.activeProjectId;
    let nextFileId = state.activeFileId;

    if (wasActive) {
      const fallbackTab = openTabs[index] ?? openTabs[index - 1] ?? null;
      if (fallbackTab) {
        nextProjectId = fallbackTab.projectId;
        nextFileId = fallbackTab.fileId;
      } else {
        nextFileId = null;
      }
    }

    set({
      openTabs,
      activeProjectId: nextProjectId,
      activeFileId: nextFileId,
    });

    return { nextProjectId, nextFileId };
  },

  reorderTabs: (fromIndex, toIndex) =>
    set((state) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= state.openTabs.length ||
        toIndex >= state.openTabs.length
      ) {
        return state;
      }
      const openTabs = [...state.openTabs];
      const [moved] = openTabs.splice(fromIndex, 1);
      openTabs.splice(toIndex, 0, moved);
      return { openTabs };
    }),
}));
