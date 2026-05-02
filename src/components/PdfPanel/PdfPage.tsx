import { useRef, useCallback } from "react";
import { Page } from "react-pdf";
import SelectionLayer from "./SelectionLayer";
import HighlightLayer from "./HighlightLayer";
import ImageLayer from "./ImageLayer";
import type { PdfDeepLink } from "../../types";
import type { PdfImageRect } from "../../utils/pdfImages";

interface Props {
  pageNumber: number;
  width: number;
  height: number;
  renderTextLayer: boolean;
  enableInteractiveLayers: boolean;
  onSelection: (link: PdfDeepLink) => void;
  highlights: PdfDeepLink[];
  activeLink: PdfDeepLink | null;
  linkingMode: boolean;
  onLinkingClick: (link: PdfDeepLink) => void;
  images: PdfImageRect[] | undefined;
  loadImages: (pageNumber: number) => Promise<PdfImageRect[]>;
  onPageLoadSuccess: (
    pageNumber: number,
    page: import("pdfjs-dist").PDFPageProxy,
  ) => void;
}

export default function PdfPage({
  pageNumber,
  width,
  height,
  renderTextLayer,
  enableInteractiveLayers,
  onSelection,
  highlights,
  activeLink,
  linkingMode,
  onLinkingClick,
  images,
  loadImages,
  onPageLoadSuccess,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const pageHighlights = highlights.filter((h) => h.page === pageNumber);
  const isActivePage = activeLink?.page === pageNumber;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!linkingMode || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      onLinkingClick({
        id: crypto.randomUUID(),
        page: pageNumber,
        rect: { x: x - 0.02, y: y - 0.01, width: 0.04, height: 0.02 },
        type: "area",
      });
    },
    [linkingMode, pageNumber, onLinkingClick],
  );

  return (
    <div
      ref={containerRef}
      className="relative rounded-sm shadow-lg ring-1 ring-border"
      style={{ width, height }}
      onClick={handleClick}
    >
      <Page
        pageNumber={pageNumber}
        width={width}
        renderTextLayer={renderTextLayer}
        renderAnnotationLayer={false}
        onLoadSuccess={(page) => {
          onPageLoadSuccess(
            pageNumber,
            page as import("pdfjs-dist").PDFPageProxy,
          );
        }}
      />

      {enableInteractiveLayers && (
        <>
          <ImageLayer
            pageNumber={pageNumber}
            containerRef={containerRef}
            images={images}
            loadImages={loadImages}
            enabled={enableInteractiveLayers}
          />

          <HighlightLayer
            containerRef={containerRef}
            highlights={pageHighlights}
            activeHighlight={isActivePage ? activeLink : null}
          />

          <SelectionLayer
            pageNumber={pageNumber}
            containerRef={containerRef}
            onSelection={onSelection}
          />
        </>
      )}
    </div>
  );
}
