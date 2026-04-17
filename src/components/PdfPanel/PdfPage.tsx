import { useRef, useCallback } from "react";
import { Page } from "react-pdf";
import SelectionLayer from "./SelectionLayer";
import HighlightLayer from "./HighlightLayer";
import ImageLayer from "./ImageLayer";
import type { PdfDeepLink, PdfDocumentLike } from "../../types";

interface Props {
  pageNumber: number;
  width: number;
  onSelection: (link: PdfDeepLink) => void;
  highlights: PdfDeepLink[];
  activeLink: PdfDeepLink | null;
  linkingMode: boolean;
  onLinkingClick: (link: PdfDeepLink) => void;
  pdfDocument: PdfDocumentLike | null;
}

export default function PdfPage({
  pageNumber,
  width,
  onSelection,
  highlights,
  activeLink,
  linkingMode,
  onLinkingClick,
  pdfDocument,
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
      className="relative mb-4 shadow-lg ring-1 ring-border rounded-sm"
      style={{ width }}
      onClick={handleClick}
    >
      <Page
        pageNumber={pageNumber}
        width={width}
        renderTextLayer={true}
        renderAnnotationLayer={false}
      />

      {pdfDocument && (
        <ImageLayer
          pageNumber={pageNumber}
          containerRef={containerRef}
          pdfDocument={pdfDocument}
        />
      )}

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
    </div>
  );
}
