import type { ExcalidrawElement, OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { LinkEntry, PdfDeepLink, StoredScene } from "../types";

const DEFAULT_VIEW_BACKGROUND_COLOR = "#fafafa";
const DEFAULT_GRID_SIZE = 20;
const EXCALIDRAW_DOCUMENT_TYPE = "excalidraw";
const EXCALIDRAW_DOCUMENT_VERSION = 2;
const EXCALIDRAW_DOCUMENT_SOURCE = "tether";
type PersistedAppState = Pick<AppState, "viewBackgroundColor" | "gridSize">;

interface SceneCustomData {
  pdfLink?: PdfDeepLink;
  pdfLinkLabel?: boolean;
}

interface ExcalidrawFileDocument {
  type?: string;
  version?: number;
  source?: string;
  elements?: readonly ExcalidrawElement[] | null;
  appState?: Partial<AppState> | null;
  files?: BinaryFiles;
}

function normalizeAppState(appState: PersistedAppState): StoredScene["appState"] {
  return {
    viewBackgroundColor: appState.viewBackgroundColor ?? DEFAULT_VIEW_BACKGROUND_COLOR,
    gridSize: appState.gridSize ?? DEFAULT_GRID_SIZE,
  };
}

function getElementCustomData(element: unknown) {
  return (element as { customData?: SceneCustomData }).customData;
}

function setElementCustomData(
  element: ExcalidrawElement,
  customData: SceneCustomData,
): ExcalidrawElement {
  return {
    ...element,
    customData,
  };
}

export function normalizeSceneSnapshot(
  elements: readonly OrderedExcalidrawElement[],
  appState: PersistedAppState,
  files: BinaryFiles,
): StoredScene | null {
  const normalizedAppState = normalizeAppState(appState);
  const scene: StoredScene = {
    elements,
    appState: normalizedAppState,
    files,
  };

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

export function extractLinksFromElements(elements: readonly unknown[]): LinkEntry[] {
  const links: LinkEntry[] = [];

  for (const rawElement of elements) {
    const element = rawElement as { id?: string };
    const pdfLink = getElementCustomData(rawElement)?.pdfLink;
    if (!element.id || !pdfLink) continue;
    links.push({
      elementId: element.id,
      pdfLink,
    });
  }

  return links;
}

export function extractLinksFromScene(scene: StoredScene | null) {
  if (!scene) return [];
  return extractLinksFromElements(scene.elements);
}

export function upsertElementPdfLink(
  elements: readonly OrderedExcalidrawElement[],
  elementId: string,
  pdfLink: PdfDeepLink,
) {
  let didUpdate = false;

  const nextElements = elements.map((rawElement) => {
    if (rawElement.id !== elementId) {
      return rawElement;
    }

    const customData = getElementCustomData(rawElement);
    if (JSON.stringify(customData?.pdfLink ?? null) === JSON.stringify(pdfLink)) {
      return rawElement;
    }

    didUpdate = true;
    return {
      ...(setElementCustomData(rawElement, {
        ...(customData ?? {}),
        pdfLink,
      }) as OrderedExcalidrawElement),
      strokeColor: "#3b82f6",
    };
  });

  return {
    didUpdate,
    elements: nextElements,
  };
}

export function serializeSceneDocument(scene: StoredScene | null) {
  const document: ExcalidrawFileDocument = {
    type: EXCALIDRAW_DOCUMENT_TYPE,
    version: EXCALIDRAW_DOCUMENT_VERSION,
    source: EXCALIDRAW_DOCUMENT_SOURCE,
    elements: scene?.elements as readonly ExcalidrawElement[] | undefined,
    appState: scene?.appState ?? {
      viewBackgroundColor: DEFAULT_VIEW_BACKGROUND_COLOR,
      gridSize: DEFAULT_GRID_SIZE,
    },
    files: (scene?.files ?? {}) as BinaryFiles,
  };

  return JSON.stringify(document, null, 2);
}

export function deserializeSceneDocument(raw: string): StoredScene | null {
  const parsed = JSON.parse(raw) as ExcalidrawFileDocument;

  if (parsed.type && parsed.type !== EXCALIDRAW_DOCUMENT_TYPE) {
    throw new Error(`Unsupported canvas file type: ${parsed.type}`);
  }

  if (parsed.version && parsed.version !== EXCALIDRAW_DOCUMENT_VERSION) {
    throw new Error(`Unsupported canvas file version: ${parsed.version}`);
  }

  const elements = (parsed.elements ?? []) as readonly OrderedExcalidrawElement[];
  const appState = normalizeAppState({
    viewBackgroundColor:
      parsed.appState?.viewBackgroundColor ?? DEFAULT_VIEW_BACKGROUND_COLOR,
    gridSize: parsed.appState?.gridSize ?? DEFAULT_GRID_SIZE,
  });
  const files = (parsed.files ?? {}) as BinaryFiles;

  return normalizeSceneSnapshot(elements, appState, files);
}
