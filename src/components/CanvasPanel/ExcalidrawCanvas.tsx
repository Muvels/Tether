import { useState, useCallback, useRef, useEffect } from "react";
import { Excalidraw, convertToExcalidrawElements, WelcomeScreen } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { getDragData, hasDragData } from "../../utils/dragData";
import { useLinkStore } from "../../store/useLinkStore";
import type { PdfDeepLink } from "../../types";

const SCENE_STORAGE_KEY = "pdf-canvas-linker-scene";

export default function ExcalidrawCanvas() {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const { addLink, setActiveLink, links, startLinking, linkingElementId, cancelLinking } =
    useLinkStore();
  const initialLoadDone = useRef(false);

  // Save scene to localStorage on changes
  const handleChange = useCallback(() => {
    if (!api || !initialLoadDone.current) return;
    try {
      const elements = api.getSceneElements();
      const appState = api.getAppState();
      localStorage.setItem(
        SCENE_STORAGE_KEY,
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
  }, [api]);

  // Load saved scene
  useEffect(() => {
    if (!api) return;
    try {
      const raw = localStorage.getItem(SCENE_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        api.updateScene({
          elements: data.elements ?? [],
        });
      }
    } catch {
      /* ignore */
    }
    initialLoadDone.current = true;
  }, [api]);

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
      if (!pdfLink || !api || !wrapperRef.current) return;

      const rect = wrapperRef.current.getBoundingClientRect();
      const appState = api.getAppState();

      // Convert screen coords to canvas coords
      const canvasX =
        (e.clientX - rect.left - appState.offsetLeft) / appState.zoom.value +
        appState.scrollX * -1;
      const canvasY =
        (e.clientY - rect.top - appState.offsetTop) / appState.zoom.value +
        appState.scrollY * -1;

      const elementId = crypto.randomUUID();

      if (pdfLink.type === "text" && pdfLink.text) {
        const newElements = convertToExcalidrawElements([
          {
            type: "rectangle",
            id: elementId,
            x: canvasX,
            y: canvasY,
            width: 260,
            height: 80,
            backgroundColor: "#e0f2fe",
            fillStyle: "solid",
            strokeColor: "#0284c7",
            strokeWidth: 1,
            roundness: { type: 3 },
            customData: { pdfLink },
          },
          {
            type: "text",
            x: canvasX + 12,
            y: canvasY + 8,
            width: 236,
            height: 24,
            text: `📄 p.${pdfLink.page}`,
            fontSize: 14,
            fontFamily: 5,
            textAlign: "left",
            customData: { pdfLinkLabel: true },
          },
          {
            type: "text",
            x: canvasX + 12,
            y: canvasY + 34,
            width: 236,
            height: 36,
            text: pdfLink.text.slice(0, 120),
            fontSize: 13,
            fontFamily: 5,
            textAlign: "left",
            customData: { pdfLinkLabel: true },
          },
        ]);

        api.updateScene({
          elements: [...api.getSceneElements(), ...newElements],
        });
      } else {
        const newElements = convertToExcalidrawElements([
          {
            type: "rectangle",
            id: elementId,
            x: canvasX,
            y: canvasY,
            width: 160,
            height: 50,
            backgroundColor: "#fef3c7",
            fillStyle: "solid",
            strokeColor: "#d97706",
            strokeWidth: 1,
            roundness: { type: 3 },
            customData: { pdfLink },
          },
          {
            type: "text",
            x: canvasX + 12,
            y: canvasY + 14,
            width: 136,
            height: 22,
            text: `📄 Area p.${pdfLink.page}`,
            fontSize: 14,
            fontFamily: 5,
            textAlign: "left",
            customData: { pdfLinkLabel: true },
          },
        ]);

        api.updateScene({
          elements: [...api.getSceneElements(), ...newElements],
        });
      }

      addLink({ elementId, pdfLink });
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

  const selectedElementId = api
    ? Object.keys(api.getAppState().selectedElementIds).find(
        (id) => api.getAppState().selectedElementIds[id],
      )
    : null;
  const selectedHasLink = selectedElementId
    ? links.some((l) => l.elementId === selectedElementId) ||
      api?.getSceneElements().find((e) => e.id === selectedElementId)?.customData?.pdfLink
    : false;

  return (
    <div className="flex flex-col h-full">
      {/* Canvas toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 shrink-0">
        <span className="text-xs font-medium text-gray-500">Canvas</span>

        {selectedElementId && !selectedHasLink && !linkingElementId && (
          <>
            <span className="text-xs text-gray-400 mx-1">|</span>
            <button
              onClick={handleLinkSelected}
              className="rounded bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700 hover:bg-orange-200 transition-colors"
            >
              🔗 Link to PDF
            </button>
          </>
        )}

        {linkingElementId && (
          <>
            <span className="text-xs text-gray-400 mx-1">|</span>
            <button
              onClick={cancelLinking}
              className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-200 transition-colors"
            >
              Cancel linking
            </button>
          </>
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
