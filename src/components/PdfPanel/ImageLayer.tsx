import { useEffect, useState, useCallback, type RefObject } from "react";
import { v4 as uuid } from "uuid";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PdfDeepLink } from "../../types";
import { extractPageImages, captureCanvasRegion, type PdfImageRect } from "../../utils/pdfImages";
import { setDragData } from "../../utils/dragData";

interface Props {
  pageNumber: number;
  containerRef: RefObject<HTMLDivElement | null>;
  pdfDocument: PDFDocumentProxy;
}

export default function ImageLayer({ pageNumber, containerRef, pdfDocument }: Props) {
  const [images, setImages] = useState<PdfImageRect[]>([]);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    pdfDocument
      .getPage(pageNumber)
      .then((page) => extractPageImages(page))
      .then((result) => {
        if (!cancelled) setImages(result);
      })
      .catch(() => {
        if (!cancelled) setImages([]);
      });
    return () => { cancelled = true; };
  }, [pdfDocument, pageNumber]);

  const handleDragStart = useCallback(
    (e: React.DragEvent, img: PdfImageRect) => {
      const canvas = containerRef.current?.querySelector("canvas");
      if (!canvas) return;

      const dataUrl = captureCanvasRegion(canvas, img.rect);
      if (!dataUrl) return;

      const link: PdfDeepLink = {
        id: uuid(),
        page: pageNumber,
        rect: img.rect,
        imageDataUrl: dataUrl,
        type: "image",
      };

      setDragData(e.dataTransfer, link);

      const preview = new Image();
      preview.src = dataUrl;
      const previewW = Math.min(img.rect.width * (canvas.width / window.devicePixelRatio), 200);
      const previewH = previewW * (img.rect.height / img.rect.width);
      e.dataTransfer.setDragImage(preview, previewW / 2, previewH / 2);
    },
    [containerRef, pageNumber],
  );

  if (images.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[5]">
      {images.map((img, idx) => (
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
