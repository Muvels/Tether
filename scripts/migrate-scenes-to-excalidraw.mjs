import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const STORAGE_SCHEMA_VERSION = 2;
const STORAGE_SCHEMA_VERSION_KEY = "storageSchemaVersion";
const DEFAULT_VIEW_BACKGROUND_COLOR = "#fafafa";
const DEFAULT_GRID_SIZE = 20;

function parseArgs(argv) {
  const appDataFlagIndex = argv.indexOf("--app-data");
  if (appDataFlagIndex === -1 || !argv[appDataFlagIndex + 1]) {
    throw new Error('Usage: node scripts/migrate-scenes-to-excalidraw.mjs --app-data "<path>"');
  }

  return {
    appDataPath: path.resolve(argv[appDataFlagIndex + 1]),
  };
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeScene(scene) {
  if (!scene) return null;

  const hasElements = scene.elements.length > 0;
  const hasFiles = Object.keys(scene.files).length > 0;
  const hasCustomBackground =
    scene.appState.viewBackgroundColor !== DEFAULT_VIEW_BACKGROUND_COLOR;
  const hasCustomGrid = scene.appState.gridSize !== DEFAULT_GRID_SIZE;

  if (!hasElements && !hasFiles && !hasCustomBackground && !hasCustomGrid) {
    return null;
  }

  return scene;
}

function buildSceneDocument(scene) {
  return JSON.stringify(
    {
      type: "excalidraw",
      version: 2,
      source: "pdf-canvas-linker",
      elements: scene?.elements ?? [],
      appState: scene?.appState ?? {
        viewBackgroundColor: DEFAULT_VIEW_BACKGROUND_COLOR,
        gridSize: DEFAULT_GRID_SIZE,
      },
      files: scene?.files ?? {},
    },
    null,
    2,
  );
}

async function getTableNames(db) {
  const result = await db.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'`,
  );
  return new Set(result.rows.map((row) => row.table_name));
}

async function getColumnNames(db, tableName) {
  const result = await db.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName],
  );
  return new Set(result.rows.map((row) => row.column_name));
}

async function detectLegacySchema(db) {
  const tableNames = await getTableNames(db);
  if (!tableNames.has("project_files")) {
    throw new Error("No project_files table found in the provided app-data directory.");
  }

  const columnNames = await getColumnNames(db, "project_files");
  const hasLegacySceneColumns =
    columnNames.has("scene_elements_json") ||
    columnNames.has("scene_app_state_json") ||
    columnNames.has("scene_files_json");

  if (!hasLegacySceneColumns || !tableNames.has("file_links")) {
    throw new Error("The provided app-data directory does not contain the legacy canvas schema.");
  }
}

function formatTimestamp(date) {
  return date
    .toISOString()
    .replace(/[:]/g, "-")
    .replace(/\..+$/, "");
}

async function ensureNoCanvasCollisions(projectFiles, canvasesDir) {
  for (const fileRow of projectFiles) {
    const targetPath = path.join(canvasesDir, `${fileRow.id}.excalidraw`);
    try {
      await stat(targetPath);
      throw new Error(`Refusing to overwrite existing canvas file: ${targetPath}`);
    } catch (error) {
      if (error?.code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }
}

async function main() {
  const { appDataPath } = parseArgs(process.argv.slice(2));
  const dbDir = path.join(appDataPath, "db");
  const canvasesDir = path.join(appDataPath, "canvases");

  await stat(appDataPath);
  await stat(dbDir);

  let db = await PGlite.create(dbDir);
  try {
    await detectLegacySchema(db);
  } finally {
    await db.close();
  }

  const timestamp = formatTimestamp(new Date());
  const backupPath = path.join(
    path.dirname(appDataPath),
    `${path.basename(appDataPath)}-backup-${timestamp}`,
  );

  await cp(appDataPath, backupPath, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });

  await mkdir(canvasesDir, { recursive: true });

  db = await PGlite.create(dbDir);
  try {
    await db.exec(`
      ALTER TABLE project_files
      ADD COLUMN IF NOT EXISTS scene_rel_path TEXT;
    `);

    const projectFilesResult = await db.query(
      `SELECT id, scene_elements_json, scene_app_state_json, scene_files_json
       FROM project_files
       ORDER BY added_at ASC`,
    );
    const linkRowsResult = await db.query(
      `SELECT file_id, element_id, pdf_link_json
       FROM file_links`,
    );

    await ensureNoCanvasCollisions(projectFilesResult.rows, canvasesDir);

    const linksByFileId = new Map();
    for (const row of linkRowsResult.rows) {
      const fileLinks = linksByFileId.get(row.file_id) ?? new Map();
      fileLinks.set(row.element_id, parseJson(row.pdf_link_json, null));
      linksByFileId.set(row.file_id, fileLinks);
    }

    let migratedCanvases = 0;
    let skippedEmptyScenes = 0;
    let droppedOrphanLinks = 0;

    for (const row of projectFilesResult.rows) {
      const sceneRelPath = `${row.id}.excalidraw`;
      const fileLinks = linksByFileId.get(row.id) ?? new Map();
      const rawElements = parseJson(row.scene_elements_json, []);
      const rawAppState = parseJson(row.scene_app_state_json, {});
      const rawFiles = parseJson(row.scene_files_json, {});
      const hasLegacyScene =
        row.scene_elements_json !== null ||
        row.scene_app_state_json !== null ||
        row.scene_files_json !== null;

      if (!hasLegacyScene) {
        skippedEmptyScenes += 1;
        droppedOrphanLinks += fileLinks.size;
        continue;
      }

      const elementsById = new Set(
        rawElements
          .map((element) => element?.id)
          .filter((elementId) => typeof elementId === "string"),
      );

      const mergedElements = rawElements.map((element) => {
        if (!element?.id || !fileLinks.has(element.id)) {
          return element;
        }

        const dbLink = fileLinks.get(element.id);
        if (!dbLink) {
          return element;
        }

        const customData = element.customData ?? {};
        if (customData.pdfLink) {
          return element;
        }

        return {
          ...element,
          customData: {
            ...customData,
            pdfLink: dbLink,
          },
        };
      });

      for (const elementId of fileLinks.keys()) {
        if (!elementsById.has(elementId)) {
          droppedOrphanLinks += 1;
        }
      }

      const scene = normalizeScene({
        elements: mergedElements,
        appState: {
          viewBackgroundColor:
            rawAppState.viewBackgroundColor ?? DEFAULT_VIEW_BACKGROUND_COLOR,
          gridSize: rawAppState.gridSize ?? DEFAULT_GRID_SIZE,
        },
        files: rawFiles,
      });

      if (!scene) {
        skippedEmptyScenes += 1;
        continue;
      }

      await writeFile(
        path.join(canvasesDir, sceneRelPath),
        buildSceneDocument(scene),
        "utf8",
      );
      migratedCanvases += 1;
    }

    await db.exec(`
      UPDATE project_files
      SET scene_rel_path = id || '.excalidraw'
      WHERE scene_rel_path IS NULL OR scene_rel_path = '';

      ALTER TABLE project_files
      ALTER COLUMN scene_rel_path SET NOT NULL;

      ALTER TABLE project_files
      DROP COLUMN IF EXISTS scene_elements_json;

      ALTER TABLE project_files
      DROP COLUMN IF EXISTS scene_app_state_json;

      ALTER TABLE project_files
      DROP COLUMN IF EXISTS scene_files_json;

      DROP TABLE IF EXISTS file_links;
    `);

    await db.query(
      `INSERT INTO app_state (key, value_json)
       VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value_json = EXCLUDED.value_json`,
      [STORAGE_SCHEMA_VERSION_KEY, JSON.stringify(STORAGE_SCHEMA_VERSION)],
    );

    console.log(`Backup created: ${backupPath}`);
    console.log(`Migrated canvases: ${migratedCanvases}`);
    console.log(`Skipped empty scenes: ${skippedEmptyScenes}`);
    console.log(`Dropped orphan links: ${droppedOrphanLinks}`);
    console.log(`Schema version set to: ${STORAGE_SCHEMA_VERSION}`);
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
