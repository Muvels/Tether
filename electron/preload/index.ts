import { contextBridge, ipcRenderer } from "electron";
import type {
  AppInfo,
  AppSnapshot,
  CreateWorkspaceInput,
  DeletePdfInput,
  DesktopApi,
  ImportPdfInput,
  Project,
  ProjectFile,
  RenamePdfInput,
  RenameProjectInput,
  StoredScene,
  UpdateState,
  Workspace,
  WorkspaceData,
} from "../../src/types";

const UPDATE_EVENT_CHANNEL = "app:update-state";

const desktopApi: DesktopApi = {
  bootstrap: () => ipcRenderer.invoke("app:bootstrap") as Promise<AppSnapshot>,
  getAppInfo: () => ipcRenderer.invoke("app:get-info") as Promise<AppInfo>,
  checkForUpdates: () => ipcRenderer.invoke("app:check-for-updates") as Promise<void>,
  downloadUpdate: () => ipcRenderer.invoke("app:download-update") as Promise<void>,
  quitAndInstallUpdate: () => ipcRenderer.invoke("app:quit-and-install-update") as Promise<void>,
  onUpdateStateChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: UpdateState) => callback(state);
    ipcRenderer.on(UPDATE_EVENT_CHANNEL, listener);
    void ipcRenderer
      .invoke("app:get-update-state")
      .then((state: UpdateState) => callback(state));
    return () => ipcRenderer.removeListener(UPDATE_EVENT_CHANNEL, listener);
  },
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
  saveScene: (fileId: string, scene: StoredScene | null) =>
    ipcRenderer.invoke("workspace:save-scene", fileId, scene),
};

contextBridge.exposeInMainWorld("desktopApi", desktopApi);
