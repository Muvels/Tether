import { contextBridge, ipcRenderer } from "electron";
import type {
  AppSnapshot,
  CreateWorkspaceInput,
  DeletePdfInput,
  DesktopApi,
  ImportPdfInput,
  LinkEntry,
  Project,
  ProjectFile,
  RenamePdfInput,
  RenameProjectInput,
  StoredScene,
  Workspace,
  WorkspaceData,
} from "../../src/types";

const desktopApi: DesktopApi = {
  bootstrap: () => ipcRenderer.invoke("app:bootstrap") as Promise<AppSnapshot>,
  setActiveWorkspace: (workspaceId: string) =>
    ipcRenderer.invoke("app:set-active-workspace", workspaceId),
  createWorkspace: (input: CreateWorkspaceInput) =>
    ipcRenderer.invoke("workspaces:create", input) as Promise<Workspace>,
  createProject: (workspaceId: string) =>
    ipcRenderer.invoke("projects:create", workspaceId) as Promise<Project>,
  renameProject: (input: RenameProjectInput) => ipcRenderer.invoke("projects:rename", input),
  deleteProject: (projectId: string) => ipcRenderer.invoke("projects:delete", projectId),
  importPdf: async (input: ImportPdfInput) =>
    (await ipcRenderer.invoke("pdfs:import", input)) as ProjectFile,
  renamePdf: (input: RenamePdfInput) => ipcRenderer.invoke("pdfs:rename", input),
  deletePdf: (input: DeletePdfInput) => ipcRenderer.invoke("pdfs:delete", input),
  openSavedFilesDirectory: () => ipcRenderer.invoke("app:open-saved-files-directory") as Promise<string>,
  onRequestAppClose: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("app:request-close", listener);
    return () => ipcRenderer.removeListener("app:request-close", listener);
  },
  confirmAppClose: () => ipcRenderer.invoke("app:confirm-close"),
  openWorkspace: async (fileId: string) => {
    const workspace = (await ipcRenderer.invoke("workspace:open", fileId)) as WorkspaceData;
    return {
      ...workspace,
      pdfBytes: workspace.pdfBytes,
    };
  },
  saveLinks: (fileId: string, links: LinkEntry[]) =>
    ipcRenderer.invoke("workspace:save-links", fileId, links),
  saveScene: (fileId: string, scene: StoredScene | null) =>
    ipcRenderer.invoke("workspace:save-scene", fileId, scene),
};

contextBridge.exposeInMainWorld("desktopApi", desktopApi);
