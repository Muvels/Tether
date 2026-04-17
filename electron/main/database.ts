import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type {
  AppSnapshot,
  ImportPdfInput,
  LinkEntry,
  Project,
  ProjectFile,
  StoredScene,
  WorkspaceData,
} from "../../src/types";

const DEFAULT_PROJECT_NAME = "New Page";
const DEFAULT_PROJECT_EMOJI = "📄";

type Queryable = Pick<PGlite, "exec" | "query">;

interface ProjectRow {
  id: string;
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
  scene_elements_json: string | null;
  scene_app_state_json: string | null;
  scene_files_json: string | null;
}

interface FileLinkRow {
  file_id: string;
  element_id: string;
  pdf_link_json: string;
}

let db: PGlite | null = null;
let dataRoot = "";
let pdfDir = "";

function requireDb() {
  if (!db) {
    throw new Error("Database has not been initialized");
  }
  return db;
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

function mapProjects(projectRows: ProjectRow[], fileRows: ProjectFileRow[]): Project[] {
  return projectRows.map((projectRow) => ({
    id: projectRow.id,
    name: projectRow.name,
    emoji: projectRow.emoji,
    createdAt: projectRow.created_at,
    files: fileRows
      .filter((fileRow) => fileRow.project_id === projectRow.id)
      .map(mapProjectFile),
  }));
}

async function ensureSchema(target: Queryable) {
  await target.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_files (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      stored_rel_path TEXT NOT NULL,
      added_at BIGINT NOT NULL,
      scene_elements_json TEXT,
      scene_app_state_json TEXT,
      scene_files_json TEXT
    );

    CREATE TABLE IF NOT EXISTS file_links (
      file_id TEXT NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
      element_id TEXT NOT NULL,
      pdf_link_json TEXT NOT NULL,
      PRIMARY KEY (file_id, element_id)
    );
  `);
}

async function getProjectRows(target: Queryable) {
  const result = await target.query<ProjectRow>(
    "SELECT id, name, emoji, created_at FROM projects ORDER BY created_at ASC",
  );
  return result.rows;
}

async function getProjectFileRows(target: Queryable) {
  const result = await target.query<ProjectFileRow>(
    `SELECT id, project_id, name, added_at, stored_rel_path, scene_elements_json, scene_app_state_json, scene_files_json
     FROM project_files
     ORDER BY added_at ASC`,
  );
  return result.rows;
}

function buildScene(row: ProjectFileRow): StoredScene | null {
  if (!row.scene_elements_json && !row.scene_app_state_json && !row.scene_files_json) {
    return null;
  }

  return {
    elements: parseJson(row.scene_elements_json, [] as unknown[]),
    appState: parseJson(row.scene_app_state_json, {
      viewBackgroundColor: "#ffffff",
      gridSize: 20,
    }),
    files: parseJson(row.scene_files_json, {} as StoredScene["files"]),
  };
}

export async function initializeDatabase(userDataPath: string) {
  dataRoot = path.join(userDataPath, "app-data");
  pdfDir = path.join(dataRoot, "pdfs");
  const dbDir = path.join(dataRoot, "db");

  await mkdir(pdfDir, { recursive: true });
  await mkdir(dbDir, { recursive: true });

  db = await PGlite.create(dbDir);
  await ensureSchema(db);
}

export async function closeDatabase() {
  if (!db) return;
  await db.close();
  db = null;
}

export async function bootstrap(): Promise<AppSnapshot> {
  const target = requireDb();
  const [projectRows, fileRows] = await Promise.all([
    getProjectRows(target),
    getProjectFileRows(target),
  ]);

  return {
    projects: mapProjects(projectRows, fileRows),
  };
}

export async function createProject() {
  const target = requireDb();
  const project: Project = {
    id: randomUUID(),
    name: DEFAULT_PROJECT_NAME,
    emoji: DEFAULT_PROJECT_EMOJI,
    createdAt: Date.now(),
    files: [],
  };

  await target.query(
    "INSERT INTO projects (id, name, emoji, created_at) VALUES ($1, $2, $3, $4)",
    [project.id, project.name, project.emoji, project.createdAt],
  );

  return project;
}

export async function renameProject(projectId: string, name: string) {
  const target = requireDb();
  await target.query("UPDATE projects SET name = $2 WHERE id = $1", [projectId, name]);
}

export async function deleteProject(projectId: string) {
  const target = requireDb();
  const fileRows = await target.query<Pick<ProjectFileRow, "stored_rel_path">>(
    "SELECT stored_rel_path FROM project_files WHERE project_id = $1",
    [projectId],
  );

  await target.query("DELETE FROM projects WHERE id = $1", [projectId]);

  await Promise.all(
    fileRows.rows.map(async ({ stored_rel_path: storedRelPath }) => {
      try {
        await rm(path.join(pdfDir, storedRelPath), { force: true });
      } catch (error) {
        console.error("Failed to delete stored PDF after project deletion", error);
      }
    }),
  );
}

export async function importPdf(input: ImportPdfInput) {
  const target = requireDb();
  const fileId = randomUUID();
  const storedRelPath = `${fileId}.pdf`;
  const fullPath = path.join(pdfDir, storedRelPath);
  const projectFile: ProjectFile = {
    id: fileId,
    name: input.name,
    addedAt: Date.now(),
  };

  try {
    await writeFile(fullPath, Buffer.from(input.bytes));
    await target.query(
      `INSERT INTO project_files (id, project_id, name, stored_rel_path, added_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [projectFile.id, input.projectId, projectFile.name, storedRelPath, projectFile.addedAt],
    );
  } catch (error) {
    await rm(fullPath, { force: true }).catch(() => undefined);
    throw error;
  }

  return projectFile;
}

export async function renamePdf(projectId: string, fileId: string, name: string) {
  const target = requireDb();
  await target.query(
    "UPDATE project_files SET name = $3 WHERE id = $1 AND project_id = $2",
    [fileId, projectId, name],
  );
}

export async function deletePdf(projectId: string, fileId: string) {
  const target = requireDb();
  const result = await target.query<Pick<ProjectFileRow, "stored_rel_path">>(
    "SELECT stored_rel_path FROM project_files WHERE id = $1 AND project_id = $2",
    [fileId, projectId],
  );

  const storedRelPath = result.rows[0]?.stored_rel_path;
  await target.query("DELETE FROM project_files WHERE id = $1 AND project_id = $2", [
    fileId,
    projectId,
  ]);

  if (!storedRelPath) return;

  try {
    await rm(path.join(pdfDir, storedRelPath), { force: true });
  } catch (error) {
    console.error("Failed to delete stored PDF", error);
  }
}

export async function openWorkspace(fileId: string): Promise<WorkspaceData> {
  const target = requireDb();
  const fileResult = await target.query<ProjectFileRow>(
    `SELECT id, project_id, name, added_at, stored_rel_path, scene_elements_json, scene_app_state_json, scene_files_json
     FROM project_files
     WHERE id = $1`,
    [fileId],
  );
  const fileRow = fileResult.rows[0];

  if (!fileRow) {
    throw new Error(`Unknown file id: ${fileId}`);
  }

  const linkRows = await target.query<FileLinkRow>(
    "SELECT file_id, element_id, pdf_link_json FROM file_links WHERE file_id = $1",
    [fileId],
  );

  const pdfBytes = await readFile(path.join(pdfDir, fileRow.stored_rel_path));

  return {
    pdfBytes: pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength,
    ),
    links: linkRows.rows.map((row) => ({
      elementId: row.element_id,
      pdfLink: parseJson(row.pdf_link_json, null as LinkEntry["pdfLink"] | null)!,
    })),
    scene: buildScene(fileRow),
  };
}

export async function saveLinks(fileId: string, links: LinkEntry[]) {
  const target = requireDb();
  await target.query("DELETE FROM file_links WHERE file_id = $1", [fileId]);

  for (const link of links) {
    await target.query(
      "INSERT INTO file_links (file_id, element_id, pdf_link_json) VALUES ($1, $2, $3)",
      [fileId, link.elementId, JSON.stringify(link.pdfLink)],
    );
  }
}

export async function saveScene(fileId: string, scene: StoredScene | null) {
  const target = requireDb();
  await target.query(
    `UPDATE project_files
     SET scene_elements_json = $2,
         scene_app_state_json = $3,
         scene_files_json = $4
     WHERE id = $1`,
    [
      fileId,
      scene ? JSON.stringify(scene.elements) : null,
      scene ? JSON.stringify(scene.appState) : null,
      scene ? JSON.stringify(scene.files) : null,
    ],
  );
}

export function getDataRoot() {
  return dataRoot;
}

export function getPdfDirectory() {
  return pdfDir;
}
