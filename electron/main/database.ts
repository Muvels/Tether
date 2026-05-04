import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type {
  AppSnapshot,
  CreateWorkspaceInput,
  Project,
  ProjectFile,
  StoredScene,
  Workspace,
  WorkspaceData,
} from "../../src/types";
import {
  deserializeSceneDocument,
  extractLinksFromScene,
  serializeSceneDocument,
} from "../../src/utils/scenePersistence";

const DEFAULT_WORKSPACE_NAME = "Personal";
const DEFAULT_WORKSPACE_ICON = "terminal";
const DEFAULT_WORKSPACE_COLOR = "#3b82f6";
const DEFAULT_WORKSPACE_PLAN = "Free";
const DEFAULT_PROJECT_NAME = "New Project";
const DEFAULT_PROJECT_EMOJI = "📄";
const STORAGE_SCHEMA_VERSION = 2;
const STORAGE_SCHEMA_VERSION_KEY = "storageSchemaVersion";
const MIGRATION_MESSAGE =
  "This app data still uses the legacy database-backed canvas format. Run the migration script against the revealed app-data directory before opening workspaces in this version.";

type Queryable = Pick<PGlite, "exec" | "query">;

interface WorkspaceRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  plan: string;
  created_at: number;
}

interface ProjectRow {
  id: string;
  workspace_id: string;
  name: string;
  emoji: string;
  created_at: number;
}

interface ProjectFileRow {
  id: string;
  project_id: string;
  name: string;
  added_at: number;
  stored_rel_path: string;
  scene_rel_path: string;
}

interface AppStateRow {
  key: string;
  value_json: string;
}

interface ColumnRow {
  column_name: string;
}

type StorageState =
  | { kind: "ready" }
  | { kind: "migration-required"; message: string };

let db: PGlite | null = null;
let dataRoot = "";
let pdfDir = "";
let canvasDir = "";
let storageState: StorageState = { kind: "ready" };

function requireDb() {
  if (!db) {
    throw new Error("Database has not been initialized");
  }
  return db;
}

function requireReadyDb() {
  if (storageState.kind !== "ready") {
    throw new Error(storageState.message);
  }
  return requireDb();
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapProjectFile(row: Pick<ProjectFileRow, "id" | "name" | "added_at">): ProjectFile {
  return {
    id: row.id,
    name: row.name,
    addedAt: row.added_at,
  };
}

function mapProject(row: ProjectRow, fileRows: ProjectFileRow[]): Project {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    createdAt: row.created_at,
    files: fileRows
      .filter((fileRow) => fileRow.project_id === row.id)
      .map(mapProjectFile),
  };
}

function mapWorkspaces(
  workspaceRows: WorkspaceRow[],
  projectRows: ProjectRow[],
  fileRows: ProjectFileRow[],
): Workspace[] {
  return workspaceRows.map((workspaceRow) => ({
    id: workspaceRow.id,
    name: workspaceRow.name,
    icon: workspaceRow.icon,
    color: workspaceRow.color,
    plan: workspaceRow.plan,
    createdAt: workspaceRow.created_at,
    projects: projectRows
      .filter((projectRow) => projectRow.workspace_id === workspaceRow.id)
      .map((projectRow) => mapProject(projectRow, fileRows)),
  }));
}

async function getAppStateValue<T>(target: Queryable, key: string, fallback: T): Promise<T> {
  const result = await target.query<Pick<AppStateRow, "value_json">>(
    "SELECT value_json FROM app_state WHERE key = $1",
    [key],
  );
  return parseJson(result.rows[0]?.value_json ?? null, fallback);
}

async function setAppStateValue(target: Queryable, key: string, value: unknown) {
  await target.query(
    `INSERT INTO app_state (key, value_json)
     VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value_json = EXCLUDED.value_json`,
    [key, JSON.stringify(value)],
  );
}

async function getTableNames(target: Queryable) {
  const result = await target.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'`,
  );
  return new Set(result.rows.map((row) => row.table_name));
}

async function getColumnNames(target: Queryable, tableName: string) {
  const result = await target.query<ColumnRow>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName],
  );
  return new Set(result.rows.map((row) => row.column_name));
}

async function ensureDefaultWorkspace(target: Queryable) {
  const existingWorkspace = await target.query<Pick<WorkspaceRow, "id">>(
    "SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1",
  );

  const workspaceId = existingWorkspace.rows[0]?.id ?? randomUUID();

  if (existingWorkspace.rows.length === 0) {
    await target.query(
      `INSERT INTO workspaces (id, name, icon, color, plan, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        workspaceId,
        DEFAULT_WORKSPACE_NAME,
        DEFAULT_WORKSPACE_ICON,
        DEFAULT_WORKSPACE_COLOR,
        DEFAULT_WORKSPACE_PLAN,
        Date.now(),
      ],
    );
  }

  await target.query("UPDATE projects SET workspace_id = $1 WHERE workspace_id IS NULL", [workspaceId]);
  return workspaceId;
}

async function ensureSchema(target: Queryable) {
  await target.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      plan TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      workspace_id TEXT,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_files (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      stored_rel_path TEXT NOT NULL,
      scene_rel_path TEXT NOT NULL,
      added_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );
  `);

  await target.exec(`
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS workspace_id TEXT;
  `);

  await ensureDefaultWorkspace(target);
  await setAppStateValue(target, STORAGE_SCHEMA_VERSION_KEY, STORAGE_SCHEMA_VERSION);
}

async function detectStorageState(target: Queryable): Promise<"fresh" | StorageState> {
  const tableNames = await getTableNames(target);
  const hasProjectFiles = tableNames.has("project_files");
  const hasAppState = tableNames.has("app_state");
  const hasAnyKnownTables =
    hasProjectFiles ||
    tableNames.has("workspaces") ||
    tableNames.has("projects") ||
    hasAppState ||
    tableNames.has("file_links");

  if (!hasAnyKnownTables) {
    return "fresh";
  }

  if (!hasProjectFiles || !hasAppState) {
    return {
      kind: "migration-required",
      message: MIGRATION_MESSAGE,
    };
  }

  const columnNames = await getColumnNames(target, "project_files");
  const hasSceneRelPath = columnNames.has("scene_rel_path");
  const hasLegacySceneColumns =
    columnNames.has("scene_elements_json") ||
    columnNames.has("scene_app_state_json") ||
    columnNames.has("scene_files_json");
  const hasLegacyLinkTable = tableNames.has("file_links");
  const schemaVersion = await getAppStateValue<number | null>(
    target,
    STORAGE_SCHEMA_VERSION_KEY,
    null,
  );

  if (
    hasSceneRelPath &&
    !hasLegacySceneColumns &&
    !hasLegacyLinkTable &&
    schemaVersion === STORAGE_SCHEMA_VERSION
  ) {
    return { kind: "ready" };
  }

  return {
    kind: "migration-required",
    message: MIGRATION_MESSAGE,
  };
}

async function getWorkspaceRows(target: Queryable) {
  const result = await target.query<WorkspaceRow>(
    "SELECT id, name, icon, color, plan, created_at FROM workspaces ORDER BY created_at ASC",
  );
  return result.rows;
}

async function getProjectRows(target: Queryable) {
  const result = await target.query<ProjectRow>(
    "SELECT id, workspace_id, name, emoji, created_at FROM projects ORDER BY created_at ASC",
  );
  return result.rows;
}

async function getProjectFileRows(target: Queryable) {
  const result = await target.query<ProjectFileRow>(
    `SELECT id, project_id, name, added_at, stored_rel_path, scene_rel_path
     FROM project_files
     ORDER BY added_at ASC`,
  );
  return result.rows;
}

async function readScene(sceneRelPath: string) {
  try {
    const raw = await readFile(path.join(canvasDir, sceneRelPath), "utf8");
    return deserializeSceneDocument(raw);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function initializeDatabase(userDataPath: string) {
  dataRoot = path.join(userDataPath, "app-data");
  pdfDir = path.join(dataRoot, "pdfs");
  canvasDir = path.join(dataRoot, "canvases");
  const dbDir = path.join(dataRoot, "db");

  await mkdir(pdfDir, { recursive: true });
  await mkdir(canvasDir, { recursive: true });
  await mkdir(dbDir, { recursive: true });

  db = await PGlite.create(dbDir);

  const detectedStorageState = await detectStorageState(db);
  if (detectedStorageState === "fresh") {
    await ensureSchema(db);
    storageState = { kind: "ready" };
    return;
  }

  storageState = detectedStorageState;
}

export async function closeDatabase() {
  if (!db) return;
  await db.close();
  db = null;
}

export async function bootstrap(): Promise<AppSnapshot> {
  if (storageState.kind !== "ready") {
    return {
      workspaces: [],
      activeWorkspaceId: null,
      storageStatus: "migration-required",
      migrationMessage: storageState.message,
      appDataPath: dataRoot,
    };
  }

  const target = requireReadyDb();
  const [workspaceRows, projectRows, fileRows, savedActiveWorkspaceId] = await Promise.all([
    getWorkspaceRows(target),
    getProjectRows(target),
    getProjectFileRows(target),
    getAppStateValue<string | null>(target, "activeWorkspaceId", null),
  ]);
  const activeWorkspaceId = workspaceRows.some(
    (workspaceRow) => workspaceRow.id === savedActiveWorkspaceId,
  )
    ? savedActiveWorkspaceId
    : workspaceRows[0]?.id ?? null;

  return {
    workspaces: mapWorkspaces(workspaceRows, projectRows, fileRows),
    activeWorkspaceId,
    storageStatus: "ready",
    migrationMessage: null,
    appDataPath: dataRoot,
  };
}

export async function createWorkspace(input: CreateWorkspaceInput) {
  const target = requireReadyDb();
  const workspace: Workspace = {
    id: randomUUID(),
    name: input.name,
    icon: input.icon,
    color: input.color,
    plan: DEFAULT_WORKSPACE_PLAN,
    createdAt: Date.now(),
    projects: [],
  };

  await target.query(
    `INSERT INTO workspaces (id, name, icon, color, plan, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      workspace.id,
      workspace.name,
      workspace.icon,
      workspace.color,
      workspace.plan,
      workspace.createdAt,
    ],
  );
  await setAppStateValue(target, "activeWorkspaceId", workspace.id);

  return workspace;
}

export async function setActiveWorkspace(workspaceId: string) {
  const target = requireReadyDb();
  await setAppStateValue(target, "activeWorkspaceId", workspaceId);
}

export async function createProject(workspaceId: string) {
  const target = requireReadyDb();
  const project: Project = {
    id: randomUUID(),
    name: DEFAULT_PROJECT_NAME,
    emoji: DEFAULT_PROJECT_EMOJI,
    createdAt: Date.now(),
    files: [],
  };

  await target.query(
    "INSERT INTO projects (id, workspace_id, name, emoji, created_at) VALUES ($1, $2, $3, $4, $5)",
    [project.id, workspaceId, project.name, project.emoji, project.createdAt],
  );

  return project;
}

export async function renameProject(projectId: string, name: string) {
  const target = requireReadyDb();
  await target.query("UPDATE projects SET name = $2 WHERE id = $1", [projectId, name]);
}

export async function deleteProject(projectId: string) {
  const target = requireReadyDb();
  const fileRows = await target.query<Pick<ProjectFileRow, "stored_rel_path" | "scene_rel_path">>(
    "SELECT stored_rel_path, scene_rel_path FROM project_files WHERE project_id = $1",
    [projectId],
  );

  await target.query("DELETE FROM projects WHERE id = $1", [projectId]);

  await Promise.all(
    fileRows.rows.flatMap(({ stored_rel_path: storedRelPath, scene_rel_path: sceneRelPath }) => [
      rm(path.join(pdfDir, storedRelPath), { force: true }).catch((error) => {
        console.error("Failed to delete stored PDF after project deletion", error);
      }),
      rm(path.join(canvasDir, sceneRelPath), { force: true }).catch((error) => {
        console.error("Failed to delete stored canvas after project deletion", error);
      }),
    ]),
  );
}

export async function importPdf(input: {
  projectId: string;
  name: string;
  bytes: ArrayBuffer;
}) {
  const target = requireReadyDb();
  const fileId = randomUUID();
  const storedRelPath = `${fileId}.pdf`;
  const sceneRelPath = `${fileId}.excalidraw`;
  const fullPath = path.join(pdfDir, storedRelPath);
  const projectFile: ProjectFile = {
    id: fileId,
    name: input.name,
    addedAt: Date.now(),
  };

  try {
    await writeFile(fullPath, Buffer.from(input.bytes));
    await target.query(
      `INSERT INTO project_files (id, project_id, name, stored_rel_path, scene_rel_path, added_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        projectFile.id,
        input.projectId,
        projectFile.name,
        storedRelPath,
        sceneRelPath,
        projectFile.addedAt,
      ],
    );
  } catch (error) {
    await rm(fullPath, { force: true }).catch(() => undefined);
    throw error;
  }

  return projectFile;
}

export async function renamePdf(projectId: string, fileId: string, name: string) {
  const target = requireReadyDb();
  await target.query(
    "UPDATE project_files SET name = $3 WHERE id = $1 AND project_id = $2",
    [fileId, projectId, name],
  );
}

export async function deletePdf(projectId: string, fileId: string) {
  const target = requireReadyDb();
  const result = await target.query<Pick<ProjectFileRow, "stored_rel_path" | "scene_rel_path">>(
    "SELECT stored_rel_path, scene_rel_path FROM project_files WHERE id = $1 AND project_id = $2",
    [fileId, projectId],
  );

  const storedRelPath = result.rows[0]?.stored_rel_path;
  const sceneRelPath = result.rows[0]?.scene_rel_path;
  await target.query("DELETE FROM project_files WHERE id = $1 AND project_id = $2", [
    fileId,
    projectId,
  ]);

  await Promise.all([
    storedRelPath
      ? rm(path.join(pdfDir, storedRelPath), { force: true }).catch((error) => {
          console.error("Failed to delete stored PDF", error);
        })
      : Promise.resolve(),
    sceneRelPath
      ? rm(path.join(canvasDir, sceneRelPath), { force: true }).catch((error) => {
          console.error("Failed to delete stored canvas", error);
        })
      : Promise.resolve(),
  ]);
}

export async function openWorkspace(fileId: string): Promise<WorkspaceData> {
  const target = requireReadyDb();
  const fileResult = await target.query<ProjectFileRow>(
    `SELECT id, project_id, name, added_at, stored_rel_path, scene_rel_path
     FROM project_files
     WHERE id = $1`,
    [fileId],
  );
  const fileRow = fileResult.rows[0];

  if (!fileRow) {
    throw new Error(`Unknown file id: ${fileId}`);
  }

  const [pdfBytes, scene] = await Promise.all([
    readFile(path.join(pdfDir, fileRow.stored_rel_path)),
    readScene(fileRow.scene_rel_path),
  ]);

  return {
    pdfBytes: pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength,
    ),
    links: extractLinksFromScene(scene),
    scene,
  };
}

export async function saveScene(fileId: string, scene: StoredScene | null) {
  const target = requireReadyDb();
  const result = await target.query<Pick<ProjectFileRow, "scene_rel_path">>(
    "SELECT scene_rel_path FROM project_files WHERE id = $1",
    [fileId],
  );
  const sceneRelPath = result.rows[0]?.scene_rel_path;

  if (!sceneRelPath) {
    throw new Error(`Unknown file id: ${fileId}`);
  }

  const fullPath = path.join(canvasDir, sceneRelPath);

  if (!scene) {
    await rm(fullPath, { force: true }).catch((error) => {
      console.error("Failed to remove empty canvas file", error);
    });
    return;
  }

  await writeFile(fullPath, serializeSceneDocument(scene), "utf8");
}

export function getDataRoot() {
  return dataRoot;
}

export function getPdfDirectory() {
  return pdfDir;
}
