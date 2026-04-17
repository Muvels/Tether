import path from "node:path";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import {
  bootstrap,
  closeDatabase,
  createProject,
  deletePdf,
  deleteProject,
  getPdfDirectory,
  importPdf,
  initializeDatabase,
  openWorkspace,
  renamePdf,
  renameProject,
  saveLinks,
  saveScene,
} from "./database";

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const IS_DEV = Boolean(DEV_SERVER_URL);

function registerIpcHandlers() {
  ipcMain.handle("app:bootstrap", () => bootstrap());
  ipcMain.handle("app:open-saved-files-directory", async () => {
    const directoryPath = getPdfDirectory();
    const openError = await shell.openPath(directoryPath);

    if (openError) {
      throw new Error(openError);
    }

    return directoryPath;
  });
  ipcMain.handle("projects:create", () => createProject());
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
  ipcMain.handle("workspace:save-links", (_event, fileId: string, links) => saveLinks(fileId, links));
  ipcMain.handle("workspace:save-scene", (_event, fileId: string, scene) => saveScene(fileId, scene));
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
    return;
  }

  await window.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
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
