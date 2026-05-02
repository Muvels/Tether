import { useEffect, useState, useCallback, type RefObject } from "react";
import { v4 as uuid } from "uuid";
import type { PdfDeepLink } from "../../types";
import { captureCanvasRegionData, type PdfImageRect } from "../../utils/pdfImages";
import { setDragData } from "../../utils/dragData";

interface Props {
  pageNumber: number;
  containerRef: RefObject<HTMLDivElement | null>;
  images: PdfImageRect[] | undefined;
  loadImages: (pageNumber: number) => Promise<PdfImageRect[]>;
  enabled: boolean;
}

export default function ImageLayer({
  pageNumber,
  containerRef,
  images,
  loadImages,
  enabled,
}: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled || images !== undefined) return;

    let timeoutId: number | null = null;
    let idleId: number | null = null;

    const triggerLoad = () => {
      void loadImages(pageNumber);
    };

    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(triggerLoad, { timeout: 250 });
    } else {
      timeoutId = globalThis.setTimeout(triggerLoad, 120);
    }

    return () => {
      if (idleId !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [enabled, images, loadImages, pageNumber]);

  const handleDragStart = useCallback(
    (e: React.DragEvent, img: PdfImageRect) => {
      const canvas = containerRef.current?.querySelector("canvas");
      if (!canvas) return;

      const capture = captureCanvasRegionData(canvas, img.rect);
      if (!capture) return;

      const link: PdfDeepLink = {
        id: uuid(),
        page: pageNumber,
        rect: img.rect,
        imageDataUrl: capture.dataUrl,
        imageWidth: capture.width,
        imageHeight: capture.height,
        type: "image",
      };

      setDragData(e.dataTransfer, link);

      const preview = new Image();
      preview.src = capture.dataUrl;
      const previewScale = Math.min(200 / capture.width, 200 / capture.height, 1);
      const previewW = capture.width * previewScale;
      const previewH = capture.height * previewScale;
      e.dataTransfer.setDragImage(preview, previewW / 2, previewH / 2);
    },
    [containerRef, pageNumber],
  );

  const pageImages = images ?? [];

  if (!enabled || pageImages.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[5]">
      {pageImages.map((img, idx) => (
        <div
          key={idx}
          className="absolute pointer-events-auto cursor-grab active:cursor-grabbing"
          draggable
          onDragStart={(e) => handleDragStart(e, img)}
          onMouseEnter={() => setHoveredIdx(idx)}
          onMouseLeave={() => setHoveredIdx(null)}
          style={{
            left: `${img.rect.x * 100}%`,
            top: `${img.rect.y * 100}%`,
            width: `${img.rect.width * 100}%`,
            height: `${img.rect.height * 100}%`,
          }}
        >
          <div
            className="absolute inset-0 rounded transition-all duration-150"
            style={{
              border: hoveredIdx === idx ? "2px solid #3b82f6" : "2px solid transparent",
              background: hoveredIdx === idx ? "rgba(59,130,246,0.08)" : "transparent",
            }}
          />
          {hoveredIdx === idx && (
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-blue-600 px-2 py-0.5 text-[10px] text-white shadow pointer-events-none">
              Drag image to canvas
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
