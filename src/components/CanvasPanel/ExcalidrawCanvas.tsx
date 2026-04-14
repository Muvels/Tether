import { useState, useCallback, useRef, useEffect } from "react";
import {
  Excalidraw,
  convertToExcalidrawElements,
  WelcomeScreen,
  viewportCoordsToSceneCoords,
} from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawImperativeAPI, DataURL, BinaryFileData } from "@excalidraw/excalidraw/types";
import type { FileId } from "@excalidraw/excalidraw/element/types";
import { getDragData, hasDragData } from "../../utils/dragData";
import { useLinkStore } from "../../store/useLinkStore";
import { useProjectStore } from "../../store/useProjectStore";
import type { PdfDeepLink } from "../../types";

function sceneStorageKey(fileId: string | null) {
  if (!fileId) return "pdf-canvas-scene-default";
  return `pdf-canvas-scene-${fileId}`;
}

export default function ExcalidrawCanvas() {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const { addLink, removeLink, setActiveLink, links, startLinking, linkingElementId, cancelLinking } =
    useLinkStore();
  const activeFileId = useProjectStore((s) => s.activeFileId);
  const initialLoadDone = useRef(false);
  const prevFileId = useRef<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const cleanupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function loadScene(fileId: string | null) {
    if (!api) return;
    try {
      const raw = localStorage.getItem(sceneStorageKey(fileId));
      if (raw) {
        const data = JSON.parse(raw);
        api.updateScene({ elements: data.elements ?? [] });
      } else {
        api.updateScene({ elements: [] });
      }
    } catch {
      api.updateScene({ elements: [] });
    }
  }

  const handleChange = useCallback(() => {
    if (!api || !initialLoadDone.current) return;

    const appState = api.getAppState();
    const selId = Object.keys(appState.selectedElementIds).find(
      (id) => appState.selectedElementIds[id],
    ) ?? null;
    setSelectedElementId(selId);

    try {
      const elements = api.getSceneElements();

      if (cleanupTimer.current) clearTimeout(cleanupTimer.current);
      cleanupTimer.current = setTimeout(() => {
        const currentElements = api.getSceneElements();
        const elementIds = new Set(currentElements.map((el) => el.id));
        const storeLinks = useLinkStore.getState().links;
        for (const link of storeLinks) {
          if (!elementIds.has(link.elementId)) {
            removeLink(link.elementId);
          }
        }
      }, 200);

      localStorage.setItem(
        sceneStorageKey(useProjectStore.getState().activeFileId),
        JSON.stringify({
          elements,
          appState: {
            viewBackgroundColor: appState.viewBackgroundColor,
            gridSize: appState.gridSize,
          },
        }),
      );
    } catch {
      /* ignore */
    }
  }, [api, removeLink]);

  // Load saved scene on initial mount
  useEffect(() => {
    if (!api) return;
    loadScene(useProjectStore.getState().activeFileId);
    prevFileId.current = useProjectStore.getState().activeFileId;
    initialLoadDone.current = true;
  }, [api]);

  // React to file switches
  useEffect(() => {
    if (!api || !initialLoadDone.current) return;
    if (prevFileId.current === activeFileId) return;

    // Save the outgoing file's scene
    if (prevFileId.current !== null) {
      try {
        const elements = api.getSceneElements();
        const appState = api.getAppState();
        localStorage.setItem(
          sceneStorageKey(prevFileId.current),
          JSON.stringify({
            elements,
            appState: {
              viewBackgroundColor: appState.viewBackgroundColor,
              gridSize: appState.gridSize,
            },
          }),
        );
      } catch {
        /* ignore */
      }
    }

    loadScene(activeFileId);
    prevFileId.current = activeFileId;
  }, [api, activeFileId]);

  useEffect(() => {
    if (!api || !initialLoadDone.current) return;
    const linkedIds = new Set(links.map((l) => l.elementId));
    const elements = api.getSceneElements();
    let changed = false;
    const updated = elements.map((el) => {
      if (el.customData?.pdfLink || el.customData?.pdfLinkLabel) return el;

      const isLinked = linkedIds.has(el.id);
      const target = isLinked ? "#3b82f6" : el.strokeColor;
      if (isLinked && el.strokeColor !== "#3b82f6") {
        changed = true;
        return { ...el, strokeColor: target };
      }
      return el;
    });
    if (changed) {
      api.updateScene({ elements: updated });
    }
  }, [api, links]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (hasDragData(e.dataTransfer)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const pdfLink = getDragData(e.dataTransfer);
      if (!pdfLink || !api) return;

      const appState = api.getAppState();
      const { x: canvasX, y: canvasY } = viewportCoordsToSceneCoords(
        { clientX: e.clientX, clientY: e.clientY },
        appState,
      );

      const elementId = crypto.randomUUID();
      const linkWithoutBlob: PdfDeepLink = { ...pdfLink, imageDataUrl: undefined };

      if (pdfLink.type === "image" && pdfLink.imageDataUrl) {
        const fileId = crypto.randomUUID() as unknown as FileId;
        const aspectRatio = pdfLink.rect.width / (pdfLink.rect.height || 1);
        const MAX_DIM = 300;
        const imgW = aspectRatio >= 1 ? MAX_DIM : MAX_DIM * aspectRatio;
        const imgH = aspectRatio >= 1 ? MAX_DIM / aspectRatio : MAX_DIM;

        api.addFiles([
          {
            id: fileId,
            dataURL: pdfLink.imageDataUrl as DataURL,
            mimeType: "image/png",
            created: Date.now(),
          } as BinaryFileData,
        ]);

        const newElements = convertToExcalidrawElements([
          {
            type: "image",
            fileId,
            id: elementId,
            x: canvasX - imgW / 2,
            y: canvasY - imgH / 2,
            width: imgW,
            height: imgH,
            customData: { pdfLink: linkWithoutBlob },
          },
        ], { regenerateIds: false });

        api.updateScene({
          elements: [...api.getSceneElements(), ...newElements],
        });
      } else if (pdfLink.type === "text" && pdfLink.text) {
        const groupId = crypto.randomUUID();
        const CARD_W = 280;
        const ACCENT_W = 4;
        const PAD_X = 18;
        const PAD_Y = 14;
        const TEXT_W = CARD_W - PAD_X - 14;
        const CHARS_PER_LINE = 38;
        const LINE_H = 14 * 1.25;

        const raw = pdfLink.text.slice(0, 250);
        const quoteText = `\u201c${raw}\u201d`;
        const words = quoteText.split(" ");
        const lines: string[] = [];
        let cur = "";
        for (const w of words) {
          if (cur.length + w.length + 1 > CHARS_PER_LINE && cur) {
            lines.push(cur);
            cur = w;
          } else {
            cur = cur ? cur + " " + w : w;
          }
        }
        if (cur) lines.push(cur);
        const wrappedText = lines.join("\n");
        const quoteH = lines.length * LINE_H;

        const refText = `\u2014 Page ${pdfLink.page}`;
        const REF_H = 14.4;
        const CARD_H = PAD_Y + quoteH + 12 + REF_H + PAD_Y;

        const newElements = convertToExcalidrawElements([
          {
            type: "rectangle",
            id: elementId,
            x: canvasX,
            y: canvasY,
            width: CARD_W,
            height: CARD_H,
            backgroundColor: "#f8f9fa",
            fillStyle: "solid",
            strokeColor: "#dee2e6",
            strokeWidth: 1,
            roundness: null,
            customData: { pdfLink: linkWithoutBlob },
            groupIds: [groupId],
          },
          {
            type: "rectangle",
            x: canvasX,
            y: canvasY,
            width: ACCENT_W,
            height: CARD_H,
            backgroundColor: "#1e1e1e",
            fillStyle: "solid",
            strokeColor: "#1e1e1e",
            strokeWidth: 1,
            roughness: 0,
            roundness: null,
            groupIds: [groupId],
          },
          {
            type: "text",
            x: canvasX + PAD_X,
            y: canvasY + PAD_Y,
            width: TEXT_W,
            text: wrappedText,
            fontSize: 14,
            fontFamily: 1,
            textAlign: "left",
            groupIds: [groupId],
          },
          {
            type: "text",
            x: canvasX + ACCENT_W + 10,
            y: canvasY + CARD_H - PAD_Y - REF_H,
            text: refText,
            fontSize: 12,
            fontFamily: 3,
            textAlign: "left",
            groupIds: [groupId],
            customData: { pdfLinkLabel: true },
          },
        ], { regenerateIds: false });

        api.updateScene({
          elements: [...api.getSceneElements(), ...newElements],
        });
      } else {
        const groupId = crypto.randomUUID();
        const newElements = convertToExcalidrawElements([
          {
            type: "rectangle",
            id: elementId,
            x: canvasX,
            y: canvasY,
            width: 160,
            height: 40,
            backgroundColor: "#f8f9fa",
            fillStyle: "solid",
            strokeColor: "#dee2e6",
            strokeWidth: 1,
            roundness: null,
            customData: { pdfLink: linkWithoutBlob },
            groupIds: [groupId],
          },
          {
            type: "rectangle",
            x: canvasX,
            y: canvasY,
            width: 4,
            height: 40,
            backgroundColor: "#1e1e1e",
            fillStyle: "solid",
            strokeColor: "#1e1e1e",
            strokeWidth: 1,
            roughness: 0,
            roundness: null,
            groupIds: [groupId],
          },
          {
            type: "text",
            x: canvasX + 18,
            y: canvasY + 12,
            text: `Area \u2014 Page ${pdfLink.page}`,
            fontSize: 12,
            fontFamily: 3,
            textAlign: "left",
            groupIds: [groupId],
            customData: { pdfLinkLabel: true },
          },
        ], { regenerateIds: false });

        api.updateScene({
          elements: [...api.getSceneElements(), ...newElements],
        });
      }

      addLink({ elementId, pdfLink: linkWithoutBlob });
    },
    [api, addLink],
  );

  // Handle clicks on elements that have pdfLink customData
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!api) return;

      // Small delay to let Excalidraw process the click first
      requestAnimationFrame(() => {
        const appState = api.getAppState();
        const selectedIds = appState.selectedElementIds;
        const selectedId = Object.keys(selectedIds).find(
          (id) => selectedIds[id],
        );
        if (!selectedId) return;

        const elements = api.getSceneElements();
        const el = elements.find((elem) => elem.id === selectedId);
        if (!el) return;

        // Check if element itself has a pdfLink
        const pdfLink = (el.customData as { pdfLink?: PdfDeepLink } | undefined)?.pdfLink;
        if (pdfLink) {
          setActiveLink(pdfLink);
          return;
        }

        // Check store for linked elements
        const storeLink = useLinkStore.getState().getLinkForElement(selectedId);
        if (storeLink) {
          setActiveLink(storeLink);
        }
      });
    },
    [api, setActiveLink],
  );

  const handleLinkSelected = useCallback(() => {
    if (!api) return;
    const appState = api.getAppState();
    const selectedId = Object.keys(appState.selectedElementIds).find(
      (id) => appState.selectedElementIds[id],
    );
    if (selectedId) {
      startLinking(selectedId);
    }
  }, [api, startLinking]);

  const selectedHasLink = selectedElementId
    ? links.some((l) => l.elementId === selectedElementId) ||
      api?.getSceneElements().find((e) => e.id === selectedElementId)?.customData?.pdfLink
    : false;

  return (
    <div className="flex flex-col h-full">
      {/* Canvas toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 shrink-0">
        <span className="text-xs font-medium text-gray-500">Canvas</span>

        <span className="text-xs text-gray-400 mx-1">|</span>

        {linkingElementId ? (
          <button
            onClick={cancelLinking}
            className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-200 transition-colors"
          >
            Cancel linking
          </button>
        ) : (
          <button
            onClick={handleLinkSelected}
            disabled={!selectedElementId || !!selectedHasLink}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              selectedElementId && !selectedHasLink
                ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                : "bg-gray-100 text-gray-400 cursor-default"
            }`}
          >
            🔗 Link to PDF
          </button>
        )}

        {selectedHasLink && (
          <span className="ml-auto text-xs text-green-600 font-medium">✓ Linked to PDF</span>
        )}
      </div>

      <div
        ref={wrapperRef}
        className="flex-1 relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPointerDown={handlePointerDown}
      >
        <Excalidraw
          excalidrawAPI={(a) => setApi(a)}
          onChange={handleChange}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              export: false,
            },
          }}
        >
          <WelcomeScreen>
            <WelcomeScreen.Center>
              <WelcomeScreen.Center.Heading>
                PDF Canvas Linker
              </WelcomeScreen.Center.Heading>
              <WelcomeScreen.Center.Menu>
                <WelcomeScreen.Center.MenuItemHelp />
              </WelcomeScreen.Center.Menu>
            </WelcomeScreen.Center>
          </WelcomeScreen>
        </Excalidraw>

        {dragOver && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-50/80 border-2 border-dashed border-blue-400 rounded pointer-events-none">
            <div className="flex flex-col items-center gap-2">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span className="text-sm font-medium text-blue-600">Drop here to create linked element</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
