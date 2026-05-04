export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfDeepLink {
  id: string;
  page: number;
  rect: NormalizedRect;
  text?: string;
  imageDataUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  type: "text" | "area" | "image";
}

export interface LinkEntry {
  elementId: string;
  pdfLink: PdfDeepLink;
}

export interface SceneFileData {
  id: string;
  dataURL: string;
  mimeType: string;
  created: number;
  lastRetrieved?: number;
  version?: number;
}

export interface StoredScene {
  elements: readonly unknown[];
  appState: {
    viewBackgroundColor: string;
    gridSize: number;
  };
  files: Record<string, SceneFileData>;
}

export interface ProjectFile {
  id: string;
  name: string;
  addedAt: number;
}

export interface Project {
  id: string;
  name: string;
  emoji: string;
  createdAt: number;
  files: ProjectFile[];
}

export interface Workspace {
  id: string;
  name: string;
  icon: string;
  color: string;
  plan: string;
  createdAt: number;
  projects: Project[];
}

export interface AppSnapshot {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  storageStatus: "ready" | "migration-required";
  migrationMessage: string | null;
  appDataPath: string;
}

export type DesktopPlatform =
  | "aix"
  | "android"
  | "darwin"
  | "freebsd"
  | "haiku"
  | "linux"
  | "openbsd"
  | "sunos"
  | "win32"
  | "cygwin"
  | "netbsd";

export interface AppInfo {
  version: string;
  platform: DesktopPlatform;
  isPackaged: boolean;
}

export type UpdateStatus =
  | "idle"
  | "unsupported"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "up-to-date"
  | "error";

export interface UpdateState {
  status: UpdateStatus;
  message: string | null;
  availableVersion: string | null;
  downloadedVersion: string | null;
  releaseDate: string | null;
  releaseNotes: string | null;
  progressPercent: number | null;
  bytesPerSecond: number | null;
  transferredBytes: number | null;
  totalBytes: number | null;
}

export interface WorkspaceData {
  pdfBytes: ArrayBuffer;
  links: LinkEntry[];
  scene: StoredScene | null;
}

export interface PdfDocumentLike {
  numPages: number;
  getPage: (pageNumber: number) => Promise<import("pdfjs-dist").PDFPageProxy>;
}

export interface ImportPdfInput {
  projectId: string;
  name: string;
  bytes: ArrayBuffer;
}

export interface DeletePdfInput {
  projectId: string;
  fileId: string;
}

export interface RenamePdfInput {
  projectId: string;
  fileId: string;
  name: string;
}

export interface RenameProjectInput {
  projectId: string;
  name: string;
}

export interface CreateWorkspaceInput {
  name: string;
  icon: string;
  color: string;
}

export interface DesktopApi {
  bootstrap: () => Promise<AppSnapshot>;
  getAppInfo: () => Promise<AppInfo>;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  quitAndInstallUpdate: () => Promise<void>;
  onUpdateStateChanged: (callback: (state: UpdateState) => void) => () => void;
  setActiveWorkspace: (workspaceId: string) => Promise<void>;
  createWorkspace: (input: CreateWorkspaceInput) => Promise<Workspace>;
  createProject: (workspaceId: string) => Promise<Project>;
  renameProject: (input: RenameProjectInput) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  importPdf: (input: ImportPdfInput) => Promise<ProjectFile>;
  renamePdf: (input: RenamePdfInput) => Promise<void>;
  deletePdf: (input: DeletePdfInput) => Promise<void>;
  openSavedFilesDirectory: () => Promise<string>;
  onRequestAppClose: (callback: () => void) => () => void;
  confirmAppClose: () => Promise<void>;
  openWorkspace: (fileId: string) => Promise<WorkspaceData>;
  saveScene: (fileId: string, scene: StoredScene | null) => Promise<void>;
}
