import path from "node:path";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import {
  bootstrap,
  closeDatabase,
  createWorkspace,
  createProject,
  deletePdf,
  deleteProject,
  getDataRoot,
  importPdf,
  initializeDatabase,
  openWorkspace,
  renamePdf,
  renameProject,
  saveScene,
  setActiveWorkspace,
} from "./database";
import { AppUpdaterService } from "./updater";

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const IS_DEV = Boolean(DEV_SERVER_URL);
const approvedCloseWindows = new WeakSet<BrowserWindow>();
const appUpdater = new AppUpdaterService();

function registerIpcHandlers() {
  ipcMain.handle("app:bootstrap", () => bootstrap());
  ipcMain.handle("app:get-info", () => appUpdater.getAppInfo());
  ipcMain.handle("app:get-update-state", () => appUpdater.getState());
  ipcMain.handle("app:check-for-updates", () => appUpdater.checkForUpdates());
  ipcMain.handle("app:download-update", () => appUpdater.downloadUpdate());
  ipcMain.handle("app:quit-and-install-update", () => {
    appUpdater.quitAndInstall();
  });
  ipcMain.handle("app:set-active-workspace", (_event, workspaceId: string) =>
    setActiveWorkspace(workspaceId),
  );
  ipcMain.handle("app:open-saved-files-directory", async () => {
    const directoryPath = getDataRoot();
    const openError = await shell.openPath(directoryPath);

    if (openError) {
      throw new Error(openError);
    }

    return directoryPath;
  });
  ipcMain.handle("workspaces:create", (_event, input) => createWorkspace(input));
  ipcMain.handle("projects:create", (_event, workspaceId: string) => createProject(workspaceId));
  ipcMain.handle("projects:rename", (_event, input: { projectId: string; name: string }) =>
    renameProject(input.projectId, input.name),
  );
  ipcMain.handle("projects:delete", (_event, projectId: string) => deleteProject(projectId));
  ipcMain.handle("pdfs:import", (_event, input) => importPdf(input));
  ipcMain.handle("pdfs:rename", (_event, input: { projectId: string; fileId: string; name: string }) =>
    renamePdf(input.projectId, input.fileId, input.name),
  );
  ipcMain.handle("pdfs:delete", (_event, input: { projectId: string; fileId: string }) =>
    deletePdf(input.projectId, input.fileId),
  );
  ipcMain.handle("workspace:open", (_event, fileId: string) => openWorkspace(fileId));
  ipcMain.handle("workspace:save-scene", (_event, fileId: string, scene) => saveScene(fileId, scene));
  ipcMain.handle("app:confirm-close", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;

    approvedCloseWindows.add(window);
    window.close();
  });
}

async function createMainWindow() {
  const isMac = process.platform === "darwin";

  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: "#ededed",
    titleBarStyle: isMac ? "hiddenInset" : "default",
    trafficLightPosition: isMac ? { x: 14, y: 15 } : undefined,
    ...(isMac
      ? {
          vibrancy: "sidebar" as const,
          visualEffectState: "active" as const,
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (IS_DEV && DEV_SERVER_URL) {
    await window.loadURL(DEV_SERVER_URL);
    window.webContents.openDevTools({ mode: "detach" });
  } else {
    await window.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  }

  window.webContents.once("did-finish-load", () => {
    appUpdater.scheduleStartupCheck();
  });

  window.on("close", (event) => {
    if (approvedCloseWindows.has(window)) {
      approvedCloseWindows.delete(window);
      return;
    }

    event.preventDefault();
    window.webContents.send("app:request-close");
  });
}

app.whenReady().then(async () => {
  await initializeDatabase(app.getPath("userData"));
  registerIpcHandlers();
  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  void closeDatabase();
});
