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
  BinaryFiles,
  DataURL,
  ExcalidrawImperativeAPI,
  ExcalidrawProps,
} from "@excalidraw/excalidraw/types";
import type {
  FileId,
  OrderedExcalidrawElement,
} from "@excalidraw/excalidraw/element/types";
import { getDragData, hasDragData } from "../../utils/dragData";
import { useLinkStore } from "../../store/useLinkStore";
import { useProjectStore } from "../../store/useProjectStore";
import type { PdfDeepLink } from "../../types";
import {
  normalizeSceneSnapshot,
  upsertElementPdfLink,
} from "../../utils/scenePersistence";

const DEFAULT_INITIAL_DATA = {
  appState: { viewBackgroundColor: "#fafafa" },
} as ExcalidrawProps["initialData"];

export default function ExcalidrawCanvas() {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const currentFileId = useLinkStore((state) => state.currentFileId);
  const hasUnsavedChanges = useLinkStore((state) => state.hasUnsavedChanges);
  const isSaving = useLinkStore((state) => state.isSaving);
  const saveCurrentFile = useLinkStore((state) => state.saveCurrentFile);
  const syncSceneState = useLinkStore((state) => state.syncSceneState);
  const setActiveLink = useLinkStore((state) => state.setActiveLink);
  const links = useLinkStore((state) => state.links);
  const startLinking = useLinkStore((state) => state.startLinking);
  const linkingElementId = useLinkStore((state) => state.linkingElementId);
  const cancelLinking = useLinkStore((state) => state.cancelLinking);
  const clearPendingLinkedElement = useLinkStore((state) => state.clearPendingLinkedElement);
  const pendingLinkedElement = useLinkStore((state) => state.pendingLinkedElement);
  const getLinkForElement = useLinkStore((state) => state.getLinkForElement);
  const getSceneRevisionForFile = useLinkStore((state) => state.getSceneRevisionForFile);
  const persistedScene = useLinkStore((state) =>
    state.currentFileId
      ? state.workspaceSessions[state.currentFileId]?.scene ?? null
      : null,
  );
  const activeFileId = useProjectStore((state) => state.activeFileId);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const applyingScene = useRef(false);
  const sceneMutationArmedRef = useRef(false);
  const latestElementsRef = useRef<readonly OrderedExcalidrawElement[] | null>(null);
  const latestFilesRef = useRef<BinaryFiles | null>(null);
  const latestViewBackgroundColorRef = useRef("#fafafa");
  const latestGridSizeRef = useRef(20);
  const latestSceneRevisionRef = useRef(0);

  const armSceneMutation = useCallback(() => {
    sceneMutationArmedRef.current = true;
  }, []);

  const selectedHasLink = useMemo(() => {
    if (!selectedElementId) return false;

    const sceneElement = api?.getSceneElements().find((element) => element.id === selectedElementId);
    const embeddedLink = (sceneElement?.customData as { pdfLink?: PdfDeepLink } | undefined)?.pdfLink;

    return Boolean(
      links.some((link) => link.elementId === selectedElementId) || embeddedLink,
    );
  }, [api, links, selectedElementId]);

  const initialData = useMemo(() => {
    if (!persistedScene) {
      return DEFAULT_INITIAL_DATA;
    }

    return {
      elements: persistedScene.elements as Parameters<ExcalidrawImperativeAPI["updateScene"]>[0]["elements"],
      appState: persistedScene.appState,
      files: persistedScene.files as Record<string, BinaryFileData>,
    } as ExcalidrawProps["initialData"];
  }, [persistedScene]);

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
    latestElementsRef.current = null;
    latestFilesRef.current = null;
    latestSceneRevisionRef.current = getSceneRevisionForFile(currentFileId);
    latestViewBackgroundColorRef.current =
      persistedScene?.appState.viewBackgroundColor ?? "#fafafa";
    latestGridSizeRef.current = persistedScene?.appState.gridSize ?? 20;

    requestAnimationFrame(() => {
      setSelectedElementId(null);
    });
  }, [currentFileId, getSceneRevisionForFile, persistedScene]);

  useEffect(() => {
    if (!api) return;

    applyingScene.current = true;
    requestAnimationFrame(() => {
      const appState = api.getAppState();
      latestElementsRef.current = api.getSceneElements() as readonly OrderedExcalidrawElement[];
      latestFilesRef.current = api.getFiles() as BinaryFiles;
      latestViewBackgroundColorRef.current = appState.viewBackgroundColor;
      latestGridSizeRef.current = appState.gridSize ?? 20;

      requestAnimationFrame(() => {
        applyingScene.current = false;
      });
    });
  }, [api, currentFileId, persistedScene]);

  useEffect(() => {
    if (!api || !pendingLinkedElement || pendingLinkedElement.fileId !== currentFileId) return;

    const { didUpdate, elements } = upsertElementPdfLink(
      api.getSceneElements() as readonly OrderedExcalidrawElement[],
      pendingLinkedElement.elementId,
      pendingLinkedElement.pdfLink,
    );

    clearPendingLinkedElement();

    if (!didUpdate) {
      return;
    }

    armSceneMutation();
    applyingScene.current = true;
    api.updateScene({ elements });
    setActiveLink(pendingLinkedElement.pdfLink);

    requestAnimationFrame(() => {
      applyingScene.current = false;
    });
  }, [
    api,
    armSceneMutation,
    clearPendingLinkedElement,
    currentFileId,
    pendingLinkedElement,
    setActiveLink,
  ]);

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

  const handleChange = useCallback<NonNullable<ExcalidrawProps["onChange"]>>(
    (elements, appState, files) => {
      if (!currentFileId || applyingScene.current) return;

      const selectedId = Object.keys(appState.selectedElementIds).find(
        (id) => appState.selectedElementIds[id],
      ) ?? null;
      setSelectedElementId(selectedId);

      const nextGridSize = appState.gridSize ?? 20;
      const didPersistedSceneChange =
        elements !== latestElementsRef.current ||
        files !== latestFilesRef.current ||
        appState.viewBackgroundColor !== latestViewBackgroundColorRef.current ||
        nextGridSize !== latestGridSizeRef.current;

      if (!didPersistedSceneChange) {
        return;
      }

      latestElementsRef.current = elements as readonly OrderedExcalidrawElement[];
      latestFilesRef.current = files as BinaryFiles;
      latestViewBackgroundColorRef.current = appState.viewBackgroundColor;
      latestGridSizeRef.current = nextGridSize;

      if (sceneMutationArmedRef.current) {
        latestSceneRevisionRef.current += 1;
        sceneMutationArmedRef.current = false;
      }

      syncSceneState(
        currentFileId,
        normalizeSceneSnapshot(
          latestElementsRef.current,
          {
            viewBackgroundColor: latestViewBackgroundColorRef.current,
            gridSize: latestGridSizeRef.current,
          },
          latestFilesRef.current,
        ),
        latestSceneRevisionRef.current,
      );
    },
    [currentFileId, syncSceneState],
  );

  const handlePointerDown = useCallback(() => {
    if (!api) return;
    armSceneMutation();

    requestAnimationFrame(() => {
      const appState = api.getAppState();
      const selectedId = Object.keys(appState.selectedElementIds).find(
        (id) => appState.selectedElementIds[id],
      );
      if (!selectedId) return;

      const elements = api.getSceneElements();
      const element = elements.find((candidate) => candidate.id === selectedId);
      if (!element) return;

      const pdfLink = (element.customData as { pdfLink?: PdfDeepLink } | undefined)?.pdfLink;
      if (pdfLink) {
        setActiveLink(pdfLink);
        return;
      }

      const storeLink = getLinkForElement(selectedId);
      if (storeLink) {
        setActiveLink(storeLink);
      }
    });
  }, [api, armSceneMutation, getLinkForElement, setActiveLink]);

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
      armSceneMutation();

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
    },
    [api, armSceneMutation],
  );

  const handleKeyDownCapture = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!["Shift", "Meta", "Control", "Alt"].includes(event.key)) {
        armSceneMutation();
      }

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
    [armSceneMutation, currentFileId, hasUnsavedChanges, isSaving, saveCurrentFile],
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
        key={currentFileId ?? "empty-canvas"}
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
              Tether
            </WelcomeScreen.Center.Heading>
            <WelcomeScreen.Center.Menu>
              <WelcomeScreen.Center.MenuItem onSelect={() => undefined}>
                Drag text, areas, or images from the PDF to build a linked canvas.
              </WelcomeScreen.Center.MenuItem>
            </WelcomeScreen.Center.Menu>
          </WelcomeScreen.Center>
        </WelcomeScreen>
      </Excalidraw>

      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-10 rounded-lg border-2 border-dashed border-primary/60 bg-primary/5" />
      )}
    </div>
  );
}
