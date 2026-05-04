import { create } from "zustand";
import type {
  CreateWorkspaceInput,
  Project,
  ProjectFile,
  Workspace,
} from "../types";

export interface OpenTab {
  projectId: string;
  fileId: string;
}

const EMPTY_PROJECTS: Project[] = [];

interface ProjectState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  activeProjectId: string | null;
  activeFileId: string | null;
  openTabs: OpenTab[];
  storageStatus: "ready" | "migration-required";
  migrationMessage: string | null;
  appDataPath: string | null;
  isHydrated: boolean;

  bootstrap: () => Promise<void>;
  createWorkspace: (input: CreateWorkspaceInput) => Promise<string>;
  switchWorkspace: (id: string) => void;
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

function getWorkspaceById(workspaces: Workspace[], workspaceId: string | null) {
  if (!workspaceId) return null;
  return workspaces.find((workspace) => workspace.id === workspaceId) ?? null;
}

function getProjectsForWorkspace(workspaces: Workspace[], workspaceId: string | null) {
  return getWorkspaceById(workspaces, workspaceId)?.projects ?? EMPTY_PROJECTS;
}

function persistActiveWorkspace(workspaceId: string) {
  void window.desktopApi.setActiveWorkspace(workspaceId).catch((error) => {
    console.error("Failed to persist active workspace", error);
  });
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

function updateWorkspace(
  workspaces: Workspace[],
  workspaceId: string,
  updater: (workspace: Workspace) => Workspace,
) {
  return workspaces.map((workspace) =>
    workspace.id === workspaceId ? updater(workspace) : workspace,
  );
}

function updateProjectInWorkspaces(
  workspaces: Workspace[],
  projectId: string,
  updater: (project: Project) => Project,
) {
  return workspaces.map((workspace) => ({
    ...workspace,
    projects: workspace.projects.map((project) =>
      project.id === projectId ? updater(project) : project,
    ),
  }));
}

function removeProjectFromWorkspaces(workspaces: Workspace[], projectId: string) {
  return workspaces.map((workspace) => ({
    ...workspace,
    projects: workspace.projects.filter((project) => project.id !== projectId),
  }));
}

export function selectActiveWorkspace(state: Pick<ProjectState, "workspaces" | "activeWorkspaceId">) {
  return getWorkspaceById(state.workspaces, state.activeWorkspaceId);
}

export function selectProjects(state: Pick<ProjectState, "workspaces" | "activeWorkspaceId">) {
  return getProjectsForWorkspace(state.workspaces, state.activeWorkspaceId);
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  activeProjectId: null,
  activeFileId: null,
  openTabs: [],
  storageStatus: "ready",
  migrationMessage: null,
  appDataPath: null,
  isHydrated: false,

  bootstrap: async () => {
    const snapshot = await window.desktopApi.bootstrap();
    const activeWorkspaceId = snapshot.activeWorkspaceId;
    const projects = getProjectsForWorkspace(snapshot.workspaces, activeWorkspaceId);

    set({
      workspaces: snapshot.workspaces,
      activeWorkspaceId,
      activeProjectId: projects[0]?.id ?? null,
      activeFileId: null,
      openTabs: [],
      storageStatus: snapshot.storageStatus,
      migrationMessage: snapshot.migrationMessage,
      appDataPath: snapshot.appDataPath,
      isHydrated: true,
    });
  },

  createWorkspace: async (input) => {
    const workspace = await window.desktopApi.createWorkspace(input);
    set((state) => ({
      workspaces: [...state.workspaces, workspace],
      activeWorkspaceId: workspace.id,
      activeProjectId: null,
      activeFileId: null,
      openTabs: [],
    }));
    return workspace.id;
  },

  switchWorkspace: (id) => {
    const state = get();
    if (id === state.activeWorkspaceId) return;

    const workspace = getWorkspaceById(state.workspaces, id);
    if (!workspace) return;

    persistActiveWorkspace(workspace.id);
    set({
      activeWorkspaceId: workspace.id,
      activeProjectId: getNextActiveProject(workspace.projects, null),
      activeFileId: null,
      openTabs: [],
    });
  },

  createProject: async () => {
    const { activeWorkspaceId } = get();
    if (!activeWorkspaceId) {
      throw new Error("Cannot create a project without an active workspace");
    }

    const project = await window.desktopApi.createProject(activeWorkspaceId);
    set((state) => ({
      workspaces: updateWorkspace(state.workspaces, activeWorkspaceId, (workspace) => ({
        ...workspace,
        projects: [...workspace.projects, project],
      })),
      activeProjectId: project.id,
      activeFileId: null,
    }));
    return project.id;
  },

  switchProject: (id) => {
    const { workspaces, activeWorkspaceId } = get();
    const projects = getProjectsForWorkspace(workspaces, activeWorkspaceId);
    if (!projects.some((project) => project.id === id)) return;
    set({ activeProjectId: id, activeFileId: null });
  },

  deleteProject: async (id) => {
    await window.desktopApi.deleteProject(id);
    set((state) => {
      const workspaces = removeProjectFromWorkspaces(state.workspaces, id);
      const projects = getProjectsForWorkspace(workspaces, state.activeWorkspaceId);
      const openTabs = state.openTabs.filter((tab) => tab.projectId !== id);
      const wasActiveProject = state.activeProjectId === id;

      return {
        workspaces,
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
      workspaces: updateProjectInWorkspaces(state.workspaces, id, (project) =>
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
      workspaces: updateProjectInWorkspaces(state.workspaces, projectId, (project) =>
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
      workspaces: updateProjectInWorkspaces(state.workspaces, projectId, (project) =>
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
      workspaces: updateProjectInWorkspaces(state.workspaces, projectId, (project) =>
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
      const projectId = findProjectIdForFile(
        getProjectsForWorkspace(state.workspaces, state.activeWorkspaceId),
        fileId,
      );
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
        nextProjectId = getNextActiveProject(
          getProjectsForWorkspace(state.workspaces, state.activeWorkspaceId),
          state.activeProjectId,
        );
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
