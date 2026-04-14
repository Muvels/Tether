import { useState, useCallback, useEffect, useRef, type RefObject } from "react";
import { v4 as uuid } from "uuid";
import type { PdfDeepLink, NormalizedRect } from "../../types";
import { normalizeRect } from "../../utils/coordinates";
import { setDragData } from "../../utils/dragData";

const MIN_TEXT_LENGTH = 2;
const SELECTION_SETTLE_MS = 150;

interface Props {
  pageNumber: number;
  containerRef: RefObject<HTMLDivElement | null>;
  onSelection: (link: PdfDeepLink) => void;
}

export default function SelectionLayer({
  pageNumber,
  containerRef,
  onSelection,
}: Props) {
  const [currentSelection, setCurrentSelection] = useState<PdfDeepLink | null>(null);
  const [areaStart, setAreaStart] = useState<{ x: number; y: number } | null>(null);
  const [areaDraft, setAreaDraft] = useState<NormalizedRect | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const captureSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setCurrentSelection(null);
        return;
      }

      const text = sel.toString().trim();
      if (!text || text.length < MIN_TEXT_LENGTH) return;

      const range = sel.getRangeAt(0);
      const rects = range.getClientRects();
      if (rects.length === 0) return;

      const containerRect = container.getBoundingClientRect();

      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i]!;
        minX = Math.min(minX, r.left);
        minY = Math.min(minY, r.top);
        maxX = Math.max(maxX, r.right);
        maxY = Math.max(maxY, r.bottom);
      }

      const w = maxX - minX;
      const h = maxY - minY;
      if (w < 4 || h < 4) return;

      const bounding = new DOMRect(minX, minY, w, h);
      const normalized = normalizeRect(bounding, containerRect);

      const link: PdfDeepLink = {
        id: uuid(),
        page: pageNumber,
        rect: normalized,
        text,
        type: "text",
      };

      setCurrentSelection(link);
      onSelection(link);
    };

    const onMouseUp = () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(captureSelection, SELECTION_SETTLE_MS);
    };

    container.addEventListener("mouseup", onMouseUp);
    return () => {
      container.removeEventListener("mouseup", onMouseUp);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [pageNumber, containerRef, onSelection]);

  // Area selection: Alt+drag on the container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMouseDown = (e: MouseEvent) => {
      if (!e.altKey) return;
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      setAreaStart({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      });
      setAreaDraft(null);
    };

    container.addEventListener("mousedown", onMouseDown);
    return () => container.removeEventListener("mousedown", onMouseDown);
  }, [containerRef]);

  // Track mouse move & up for area selection on the document level
  useEffect(() => {
    if (!areaStart) return;
    const container = containerRef.current;
    if (!container) return;

    const onMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const curX = (e.clientX - rect.left) / rect.width;
      const curY = (e.clientY - rect.top) / rect.height;
      setAreaDraft({
        x: Math.min(areaStart.x, curX),
        y: Math.min(areaStart.y, curY),
        width: Math.abs(curX - areaStart.x),
        height: Math.abs(curY - areaStart.y),
      });
    };

    const onUp = () => {
      setAreaDraft((draft) => {
        if (draft && draft.width >= 0.01 && draft.height >= 0.01) {
          const link: PdfDeepLink = {
            id: uuid(),
            page: pageNumber,
            rect: draft,
            type: "area",
          };
          setCurrentSelection(link);
          onSelection(link);
        }
        return null;
      });
      setAreaStart(null);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [areaStart, containerRef, pageNumber, onSelection]);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (!currentSelection) return;
      setDragData(e.dataTransfer, currentSelection);
    },
    [currentSelection],
  );

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Area selection draft rectangle */}
      {areaDraft && (
        <div
          className="absolute border-2 border-dashed border-blue-500 bg-blue-200/20"
          style={{
            left: `${areaDraft.x * 100}%`,
            top: `${areaDraft.y * 100}%`,
            width: `${areaDraft.width * 100}%`,
            height: `${areaDraft.height * 100}%`,
          }}
        />
      )}

      {/* Drag handle for current selection */}
      {currentSelection && (
        <div
          draggable
          onDragStart={handleDragStart}
          onDragEnd={() => setCurrentSelection(null)}
          className="absolute z-20 flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs text-white shadow-lg cursor-grab active:cursor-grabbing hover:bg-blue-700 transition-colors pointer-events-auto"
          style={{
            left: `${(currentSelection.rect.x + currentSelection.rect.width / 2) * 100}%`,
            top: `${(currentSelection.rect.y + currentSelection.rect.height) * 100}%`,
            transform: "translate(-50%, 6px)",
          }}
          title="Drag to canvas to create linked element"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <circle cx="9" cy="5" r="1.5" fill="currentColor" />
            <circle cx="15" cy="5" r="1.5" fill="currentColor" />
            <circle cx="9" cy="12" r="1.5" fill="currentColor" />
            <circle cx="15" cy="12" r="1.5" fill="currentColor" />
            <circle cx="9" cy="19" r="1.5" fill="currentColor" />
            <circle cx="15" cy="19" r="1.5" fill="currentColor" />
          </svg>
          <span>
            {currentSelection.text
              ? currentSelection.text.slice(0, 24) +
                (currentSelection.text.length > 24 ? "…" : "")
              : `Area p.${currentSelection.page}`}
          </span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </div>
  );
}
