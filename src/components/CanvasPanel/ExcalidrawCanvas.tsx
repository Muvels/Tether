import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  Excalidraw,
  convertToExcalidrawElements,
  viewportCoordsToSceneCoords,
  WelcomeScreen,
} from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type {
  BinaryFileData,
  ExcalidrawImperativeAPI,
  DataURL,
} from "@excalidraw/excalidraw/types";
import type { FileId } from "@excalidraw/excalidraw/element/types";
import { getDragData, hasDragData } from "../../utils/dragData";
import { useLinkStore } from "../../store/useLinkStore";
import { useProjectStore } from "../../store/useProjectStore";
import type { PdfDeepLink, StoredScene } from "../../types";

function normalizeSceneSnapshot(scene: StoredScene): StoredScene | null {
  const hasElements = scene.elements.length > 0;
  const hasFiles = Object.keys(scene.files).length > 0;
  const hasCustomBackground = scene.appState.viewBackgroundColor !== "#fafafa";
  const hasCustomGrid = scene.appState.gridSize !== 20;

  if (!hasElements && !hasFiles && !hasCustomBackground && !hasCustomGrid) {
    return null;
  }

  return scene;
}

function buildSceneSnapshot(api: ExcalidrawImperativeAPI): StoredScene {
  const appState = api.getAppState();
  return {
    elements: api.getSceneElements(),
    appState: {
      viewBackgroundColor: appState.viewBackgroundColor,
      gridSize: appState.gridSize ?? 20,
    },
    files: api.getFiles(),
  };
}

export default function ExcalidrawCanvas() {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const currentFileId = useLinkStore((state) => state.currentFileId);
  const hasUnsavedChanges = useLinkStore((state) => state.hasUnsavedChanges);
  const isSaving = useLinkStore((state) => state.isSaving);
  const saveCurrentFile = useLinkStore((state) => state.saveCurrentFile);
  const addLink = useLinkStore((state) => state.addLink);
  const removeLink = useLinkStore((state) => state.removeLink);
  const setActiveLink = useLinkStore((state) => state.setActiveLink);
  const links = useLinkStore((state) => state.links);
  const startLinking = useLinkStore((state) => state.startLinking);
  const linkingElementId = useLinkStore((state) => state.linkingElementId);
  const cancelLinking = useLinkStore((state) => state.cancelLinking);
  const setScene = useLinkStore((state) => state.setScene);
  const syncSceneBaseline = useLinkStore((state) => state.syncSceneBaseline);
  const scene = useLinkStore((state) => state.scene);
  const activeFileId = useProjectStore((state) => state.activeFileId);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const cleanupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingScene = useRef(false);
  const appliedFileId = useRef<string | null | undefined>(undefined);

  const selectedHasLink = useMemo(() => {
    if (!selectedElementId) return false;

    const sceneElement = api?.getSceneElements().find((element) => element.id === selectedElementId);
    const embeddedLink = (sceneElement?.customData as { pdfLink?: PdfDeepLink } | undefined)?.pdfLink;

    return Boolean(
      links.some((link) => link.elementId === selectedElementId) || embeddedLink,
    );
  }, [api, links, selectedElementId]);

  const initialData = useMemo(() => {
    if (!scene) {
      return { appState: { viewBackgroundColor: "#fafafa" } };
    }

    return {
      elements: scene.elements as Parameters<ExcalidrawImperativeAPI["updateScene"]>[0]["elements"],
      appState: scene.appState,
      files: scene.files as Record<string, BinaryFileData>,
    } as React.ComponentProps<typeof Excalidraw>["initialData"];
  }, [scene]);

  const handleLinkAction = useCallback(() => {
    if (linkingElementId) {
      cancelLinking();
      return;
    }

    if (!api || !selectedElementId || selectedHasLink || !activeFileId) return;
    startLinking(selectedElementId);
  }, [
    activeFileId,
    api,
    cancelLinking,
    linkingElementId,
    selectedElementId,
    selectedHasLink,
    startLinking,
  ]);

  useEffect(() => {
    if (!api) return;
    if (appliedFileId.current === currentFileId) return;

    appliedFileId.current = currentFileId;
    applyingScene.current = true;
    api.resetScene();

    if (scene) {
      const files = Object.values(scene.files);
      if (files.length > 0) {
        api.addFiles(files as BinaryFileData[]);
      }
      api.updateScene({
        elements: scene.elements as Parameters<ExcalidrawImperativeAPI["updateScene"]>[0]["elements"],
        appState: scene.appState,
      });
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        syncSceneBaseline(normalizeSceneSnapshot(buildSceneSnapshot(api)));
        setSelectedElementId(null);
        applyingScene.current = false;
      });
    });
  }, [api, currentFileId, scene, syncSceneBaseline]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const excalidrawRoot = wrapper?.querySelector(".excalidraw");
    if (!wrapper || !excalidrawRoot) return;

    const syncContextMenu = () => {
      const menu = wrapper.querySelector(".context-menu");
      if (!menu) return;

      menu.querySelector(".pdf-link-context-menu-item")?.remove();
      menu.querySelector(".pdf-link-context-menu-separator")?.remove();

      const label = linkingElementId
        ? "Cancel PDF linking"
        : selectedHasLink
          ? "Already linked to PDF"
          : "Link to PDF";
      const disabled = !linkingElementId && (!selectedElementId || !activeFileId || selectedHasLink);

      if (!linkingElementId && !selectedElementId) return;

      const separator = document.createElement("hr");
      separator.className = "context-menu-item-separator pdf-link-context-menu-separator";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "context-menu-item pdf-link-context-menu-item";
      button.disabled = disabled;

      const labelNode = document.createElement("div");
      labelNode.className = "context-menu-item__label";
      labelNode.textContent = label;
      button.appendChild(labelNode);

      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (button.disabled) return;

        handleLinkAction();
        wrapper.dispatchEvent(
          new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            key: "Escape",
          }),
        );
      });

      menu.append(separator, button);
    };

    const observer = new MutationObserver(() => {
      syncContextMenu();
    });

    observer.observe(excalidrawRoot, { childList: true });
    syncContextMenu();

    return () => {
      observer.disconnect();
    };
  }, [activeFileId, handleLinkAction, linkingElementId, selectedElementId, selectedHasLink]);

  const handleChange = useCallback(() => {
    if (!api || applyingScene.current) return;
    if (appliedFileId.current !== currentFileId) return;

    const appState = api.getAppState();
    const selectedId = Object.keys(appState.selectedElementIds).find(
      (id) => appState.selectedElementIds[id],
    ) ?? null;
    setSelectedElementId(selectedId);

    if (cleanupTimer.current) clearTimeout(cleanupTimer.current);
    cleanupTimer.current = setTimeout(() => {
      const currentElements = api.getSceneElements();
      const elementIds = new Set(currentElements.map((element) => element.id));
      const storeLinks = useLinkStore.getState().links;
      for (const link of storeLinks) {
        if (!elementIds.has(link.elementId)) {
          removeLink(link.elementId);
        }
      }
    }, 200);

    setScene(normalizeSceneSnapshot(buildSceneSnapshot(api)));
  }, [api, currentFileId, removeLink, setScene]);

  useEffect(() => {
    if (!api) return;
    const linkedIds = new Set(links.map((link) => link.elementId));
    const elements = api.getSceneElements();
    let changed = false;
    const updated = elements.map((element) => {
      if (element.customData?.pdfLink || element.customData?.pdfLinkLabel) return element;

      if (linkedIds.has(element.id) && element.strokeColor !== "#3b82f6") {
        changed = true;
        return { ...element, strokeColor: "#3b82f6" };
      }
      return element;
    });

    if (changed) {
      applyingScene.current = true;
      api.updateScene({ elements: updated });
      requestAnimationFrame(() => {
        applyingScene.current = false;
      });
    }
  }, [api, links]);

  useEffect(() => {
    return () => {
      if (cleanupTimer.current) {
        clearTimeout(cleanupTimer.current);
      }
    };
  }, []);

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
      const linkWithoutBlob: PdfDeepLink = {
        ...pdfLink,
        imageDataUrl: undefined,
        imageWidth: undefined,
        imageHeight: undefined,
      };

      if (pdfLink.type === "image" && pdfLink.imageDataUrl) {
        const fileId = crypto.randomUUID() as unknown as FileId;
        const sourceWidth = pdfLink.imageWidth ?? 1;
        const sourceHeight = pdfLink.imageHeight ?? 1;
        const aspectRatio = sourceWidth / sourceHeight;
        const maxDimension = 300;
        const imageWidth = aspectRatio >= 1 ? maxDimension : maxDimension * aspectRatio;
        const imageHeight = aspectRatio >= 1 ? maxDimension / aspectRatio : maxDimension;

        api.addFiles([
          {
            id: fileId,
            dataURL: pdfLink.imageDataUrl as DataURL,
            mimeType: "image/png",
            created: Date.now(),
          } as BinaryFileData,
        ]);

        const newElements = convertToExcalidrawElements(
          [
            {
              type: "image",
              fileId,
              id: elementId,
              x: canvasX - imageWidth / 2,
              y: canvasY - imageHeight / 2,
              width: imageWidth,
              height: imageHeight,
              customData: { pdfLink: linkWithoutBlob },
            },
          ],
          { regenerateIds: false },
        );

        api.updateScene({
          elements: [...api.getSceneElements(), ...newElements],
        });
      } else if (pdfLink.type === "text" && pdfLink.text) {
        const groupId = crypto.randomUUID();
        const cardWidth = 280;
        const accentWidth = 4;
        const padX = 18;
        const padY = 14;
        const textWidth = cardWidth - padX - 14;
        const charsPerLine = 38;
        const lineHeight = 14 * 1.25;

        const raw = pdfLink.text.slice(0, 250);
        const quoteText = `\u201c${raw}\u201d`;
        const words = quoteText.split(" ");
        const lines: string[] = [];
        let currentLine = "";
        for (const word of words) {
          if (currentLine.length + word.length + 1 > charsPerLine && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = currentLine ? `${currentLine} ${word}` : word;
          }
        }
        if (currentLine) lines.push(currentLine);
        const wrappedText = lines.join("\n");
        const quoteHeight = lines.length * lineHeight;

        const refText = `\u2014 Page ${pdfLink.page}`;
        const refHeight = 14.4;
        const cardHeight = padY + quoteHeight + 12 + refHeight + padY;

        const newElements = convertToExcalidrawElements(
          [
            {
              type: "rectangle",
              id: elementId,
              x: canvasX,
              y: canvasY,
              width: cardWidth,
              height: cardHeight,
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
              width: accentWidth,
              height: cardHeight,
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
              x: canvasX + padX,
              y: canvasY + padY,
              width: textWidth,
              text: wrappedText,
              fontSize: 14,
              fontFamily: 1,
              textAlign: "left",
              groupIds: [groupId],
            },
            {
              type: "text",
              x: canvasX + accentWidth + 10,
              y: canvasY + cardHeight - padY - refHeight,
              text: refText,
              fontSize: 12,
              fontFamily: 3,
              textAlign: "left",
              groupIds: [groupId],
              customData: { pdfLinkLabel: true },
            },
          ],
          { regenerateIds: false },
        );

        api.updateScene({
          elements: [...api.getSceneElements(), ...newElements],
        });
      } else {
        const groupId = crypto.randomUUID();
        const newElements = convertToExcalidrawElements(
          [
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
          ],
          { regenerateIds: false },
        );

        api.updateScene({
          elements: [...api.getSceneElements(), ...newElements],
        });
      }

      addLink({ elementId, pdfLink: linkWithoutBlob });
    },
    [api, addLink],
  );

  const handlePointerDown = useCallback(() => {
    if (!api) return;

    requestAnimationFrame(() => {
      const appState = api.getAppState();
      const selectedIds = appState.selectedElementIds;
      const selectedId = Object.keys(selectedIds).find((id) => selectedIds[id]);
      if (!selectedId) return;

      const elements = api.getSceneElements();
      const element = elements.find((candidate) => candidate.id === selectedId);
      if (!element) return;

      const pdfLink = (element.customData as { pdfLink?: PdfDeepLink } | undefined)?.pdfLink;
      if (pdfLink) {
        setActiveLink(pdfLink);
        return;
      }

      const storeLink = useLinkStore.getState().getLinkForElement(selectedId);
      if (storeLink) {
        setActiveLink(storeLink);
      }
    });
  }, [api, setActiveLink]);

  const handleKeyDownCapture = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key.toLowerCase() !== "s" || (!event.metaKey && !event.ctrlKey)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (!currentFileId || !hasUnsavedChanges || isSaving) return;

      void saveCurrentFile().catch((error) => {
        console.error("Failed to save workspace from canvas shortcut", error);
      });
    },
    [currentFileId, hasUnsavedChanges, isSaving, saveCurrentFile],
  );

  return (
    <div
      ref={wrapperRef}
      className="excalidraw-shell relative h-full"
      onKeyDownCapture={handleKeyDownCapture}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPointerDown={handlePointerDown}
    >
      <Excalidraw
        excalidrawAPI={(instance) => setApi(instance)}
        onChange={handleChange}
        initialData={initialData}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            export: false,
            saveToActiveFile: false,
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
  );
}
