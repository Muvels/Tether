import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Document, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import PdfPage from "./PdfPage";
import { useSidebar } from "@/components/ui/sidebar";
import { useUiStore } from "@/store/useUiStore";
import { useLinkStore } from "../../store/useLinkStore";
import type { PdfDeepLink, PdfDocumentLike } from "../../types";
import type { PdfImageRect } from "../../utils/pdfImages";
import { extractPageImages } from "../../utils/pdfImages";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const BASE_PAGE_WIDTH = 600;
const MIN_SCALE = 0.1;
const MAX_SCALE = 3;
const ZOOM_STEP = 0.15;
const PAGE_GAP = 16;
const PAGE_OVERSCAN = 2;
const DEFAULT_PAGE_RATIO = Math.SQRT2;

interface PageMetric {
  width: number;
  height: number;
}

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function getPageMetric(page: import("pdfjs-dist").PDFPageProxy): PageMetric {
  const viewport = page.getViewport({ scale: 1 });
  return {
    width: viewport.width,
    height: viewport.height,
  };
}

function getRenderedPageHeight(metric: PageMetric | undefined, width: number) {
  if (!metric || metric.width <= 0 || metric.height <= 0) {
    return width * DEFAULT_PAGE_RATIO;
  }

  return width * (metric.height / metric.width);
}

function getPageItemSize(pageHeight: number, index: number, numPages: number) {
  return pageHeight + (index === numPages - 1 ? 0 : PAGE_GAP);
}

function PdfDocumentView({
  pdfFile,
  links,
  activeLink,
  clearActiveLink,
  linkingElementId,
  completeLinking,
  currentFileId,
}: {
  pdfFile: { data: Uint8Array };
  links: ReturnType<typeof useLinkStore.getState>["links"];
  activeLink: ReturnType<typeof useLinkStore.getState>["activeLink"];
  clearActiveLink: ReturnType<typeof useLinkStore.getState>["clearActiveLink"];
  linkingElementId: ReturnType<typeof useLinkStore.getState>["linkingElementId"];
  completeLinking: ReturnType<typeof useLinkStore.getState>["completeLinking"];
  currentFileId: string | null;
}) {
  const { state: sidebarState, isMobile } = useSidebar();
  const autoFitPdfOnSidebarToggle = useUiStore(
    (s) => s.autoFitPdfOnSidebarToggle,
  );
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [pdfDocument, setPdfDocument] = useState<PdfDocumentLike | null>(null);
  const [highlightsVisible, setHighlightsVisible] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageMetrics, setPageMetrics] = useState<PageMetric[]>([]);
  const [pageImageCache, setPageImageCache] = useState<
    Record<number, PdfImageRect[]>
  >({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousSidebarStateRef = useRef(sidebarState);
  const documentVersionRef = useRef(0);
  const imageLoadPromisesRef = useRef<Map<number, Promise<PdfImageRect[]>>>(
    new Map(),
  );

  const pageWidth = BASE_PAGE_WIDTH * scale;
  const defaultPageHeight = pageWidth * DEFAULT_PAGE_RATIO;

  const highlights = links.map((link) => link.pdfLink);
  const handleSelection = useCallback(() => {}, []);

  const pageHeights = useMemo(
    () =>
      Array.from({ length: numPages }, (_, index) =>
        getRenderedPageHeight(pageMetrics[index], pageWidth),
      ),
    [numPages, pageMetrics, pageWidth],
  );

  const pageOffsets = useMemo(() => {
    const offsets: number[] = [];
    let nextOffset = 0;

    for (let index = 0; index < numPages; index += 1) {
      offsets.push(nextOffset);
      nextOffset += getPageItemSize(
        pageHeights[index] ?? defaultPageHeight,
        index,
        numPages,
      );
    }

    return offsets;
  }, [defaultPageHeight, numPages, pageHeights]);

  const virtualizer = useVirtualizer({
    count: numPages,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) =>
      getPageItemSize(pageHeights[index] ?? defaultPageHeight, index, numPages),
    overscan: PAGE_OVERSCAN,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const scrollOffset = virtualizer.scrollOffset ?? 0;
  const viewportHeight = scrollRef.current?.clientHeight ?? 0;
  const viewportBottom = scrollOffset + viewportHeight;

  useEffect(() => {
    virtualizer.measure();
  }, [pageHeights, virtualizer]);

  useEffect(() => {
    if (numPages === 0 || !scrollRef.current || virtualItems.length === 0) return;

    const viewportCenter = scrollOffset + scrollRef.current.clientHeight / 2;
    let bestPage = currentPage;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const item of virtualItems) {
      const pageHeight = pageHeights[item.index] ?? defaultPageHeight;
      const pageCenter = item.start + pageHeight / 2;
      const distance = Math.abs(pageCenter - viewportCenter);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestPage = item.index + 1;
      }
    }

    if (bestPage !== currentPage) {
      setCurrentPage(bestPage);
    }
  }, [
    currentPage,
    defaultPageHeight,
    numPages,
    pageHeights,
    scrollOffset,
    virtualItems,
  ]);

  const handleLinkingClick = useCallback(
    (link: PdfDeepLink) => {
      if (linkingElementId) {
        completeLinking(link);
      }
    },
    [linkingElementId, completeLinking],
  );

  const fitDocumentToVisibleArea = useCallback(async (doc: PdfDocumentLike) => {
    const container = scrollRef.current;
    if (!container) return;

    const firstPage = await doc.getPage(1);
    const viewport = firstPage.getViewport({ scale: 1 });
    if (viewport.width <= 0 || viewport.height <= 0) return;

    const styles = window.getComputedStyle(container);
    const horizontalPadding =
      Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
    const verticalPadding =
      Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);
    const availableWidth = container.clientWidth - horizontalPadding;
    const availableHeight = container.clientHeight - verticalPadding;
    if (availableWidth <= 0 || availableHeight <= 0) return;

    const pageHeightAtBaseWidth = BASE_PAGE_WIDTH * (viewport.height / viewport.width);
    const fitScale = Math.min(
      availableWidth / BASE_PAGE_WIDTH,
      availableHeight / pageHeightAtBaseWidth,
    );

    setScale(clampScale(fitScale));
  }, []);

  const loadPageImages = useCallback(
    async (pageNumber: number) => {
      if (pageNumber in pageImageCache) {
        return pageImageCache[pageNumber] ?? [];
      }

      const inFlight = imageLoadPromisesRef.current.get(pageNumber);
      if (inFlight) {
        return inFlight;
      }

      if (!pdfDocument) {
        return [];
      }

      const documentVersion = documentVersionRef.current;
      const request = pdfDocument
        .getPage(pageNumber)
        .then((page) => extractPageImages(page))
        .catch(() => [])
        .then((images) => {
          imageLoadPromisesRef.current.delete(pageNumber);

          if (documentVersion === documentVersionRef.current) {
            setPageImageCache((previous) => ({
              ...previous,
              [pageNumber]: images,
            }));
          }

          return images;
        });

      imageLoadPromisesRef.current.set(pageNumber, request);
      return request;
    },
    [pageImageCache, pdfDocument],
  );

  const handlePageLoadSuccess = useCallback(
    (pageNumber: number, page: import("pdfjs-dist").PDFPageProxy) => {
      const metric = getPageMetric(page);

      setPageMetrics((previous) => {
        if (previous.length === 0 || pageNumber < 1 || pageNumber > previous.length) {
          return previous;
        }

        const index = pageNumber - 1;
        const current = previous[index];
        if (
          current &&
          current.width === metric.width &&
          current.height === metric.height
        ) {
          return previous;
        }

        const next = [...previous];
        next[index] = metric;
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    if (!activeLink || !scrollRef.current) return;

    const pageIndex = activeLink.page - 1;
    if (pageIndex < 0 || pageIndex >= numPages) return;

    const container = scrollRef.current;
    const targetY =
      pageOffsets[pageIndex]! +
      (pageHeights[pageIndex] ?? defaultPageHeight) * activeLink.rect.y -
      container.clientHeight / 3;

    container.scrollTo({ top: Math.max(0, targetY), behavior: "smooth" });

    const timer = window.setTimeout(clearActiveLink, 4000);
    return () => window.clearTimeout(timer);
  }, [
    activeLink,
    clearActiveLink,
    defaultPageHeight,
    numPages,
    pageHeights,
    pageOffsets,
  ]);

  useEffect(() => {
    const hasSidebarStateChanged = previousSidebarStateRef.current !== sidebarState;
    previousSidebarStateRef.current = sidebarState;

    if (!hasSidebarStateChanged) {
      return;
    }

    if (isMobile || !pdfDocument || !autoFitPdfOnSidebarToggle) return;

    const timeoutId = window.setTimeout(() => {
      void fitDocumentToVisibleArea(pdfDocument).catch((error) => {
        console.warn("PDF sidebar auto-fit error:", error);
      });
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [
    autoFitPdfOnSidebarToggle,
    fitDocumentToVisibleArea,
    isMobile,
    pdfDocument,
    sidebarState,
  ]);

  const goToPage = useCallback(
    (page: number) => {
      if (!scrollRef.current || page < 1 || page > numPages) return;

      const pageIndex = page - 1;
      scrollRef.current.scrollTo({
        top: pageOffsets[pageIndex] ?? 0,
        behavior: "smooth",
      });
    },
    [numPages, pageOffsets],
  );

  return (
    <div className="relative h-full">
      <div
        ref={scrollRef}
        className="no-scrollbar h-full overflow-auto px-4 pb-4"
        style={{
          paddingTop: "calc(var(--app-topbar-height) + 1rem)",
          backgroundColor: "var(--editor-surface)",
        }}
      >
        <Document
          key={currentFileId ?? "no-file"}
          file={pdfFile}
          onLoadSuccess={async (doc) => {
            const nextDocument = doc as unknown as PdfDocumentLike;
            const documentVersion = documentVersionRef.current + 1;
            documentVersionRef.current = documentVersion;

            imageLoadPromisesRef.current.clear();
            setPageImageCache({});
            setPdfDocument(nextDocument);
            setNumPages(doc.numPages);
            setCurrentPage(1);
            setLoadError(null);

            try {
              const firstPage = await nextDocument.getPage(1);
              const firstMetric = getPageMetric(firstPage);

              setPageMetrics(Array.from({ length: doc.numPages }, () => firstMetric));

              await fitDocumentToVisibleArea(nextDocument);
            } catch (error) {
              console.warn("PDF fit error:", error);
              setPageMetrics([]);
            }
          }}
          onLoadError={(error) => {
            console.error("PDF load error:", error);
            documentVersionRef.current += 1;
            imageLoadPromisesRef.current.clear();
            setNumPages(0);
            setPdfDocument(null);
            setPageMetrics([]);
            setPageImageCache({});
            setLoadError(error instanceof Error ? error.message : String(error));
          }}
          error={
            <div className="flex h-40 flex-col items-center justify-center gap-2">
              <p className="text-sm font-medium text-red-500">Failed to load PDF</p>
              {loadError && (
                <p className="max-w-md text-center text-xs text-red-400">{loadError}</p>
              )}
            </div>
          }
          loading={
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>
          }
        >
          <div
            className="relative"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualItems.map((item) => {
              const pageNumber = item.index + 1;
              const pageHeight = pageHeights[item.index] ?? defaultPageHeight;
              const isVisible =
                item.start < viewportBottom && item.end > scrollOffset;

              return (
                <div
                  key={item.key}
                  className="absolute inset-x-0 flex justify-center"
                  style={{
                    top: item.start,
                    height: pageHeight,
                  }}
                >
                  <PdfPage
                    pageNumber={pageNumber}
                    width={pageWidth}
                    height={pageHeight}
                    renderTextLayer={isVisible}
                    enableInteractiveLayers={isVisible}
                    onSelection={handleSelection}
                    highlights={highlightsVisible ? highlights : []}
                    activeLink={highlightsVisible ? activeLink : null}
                    linkingMode={!!linkingElementId}
                    onLinkingClick={handleLinkingClick}
                    images={pageImageCache[pageNumber]}
                    loadImages={loadPageImages}
                    onPageLoadSuccess={handlePageLoadSuccess}
                  />
                </div>
              );
            })}
          </div>
        </Document>
      </div>

      <div className="group/ctrl absolute bottom-4 left-4 z-10">
        <div className="flex items-center rounded-full border border-border bg-card shadow-sm transition-all duration-300 ease-in-out">
          <div className="flex size-9 shrink-0 items-center justify-center text-muted-foreground">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" x2="4" y1="21" y2="14" />
              <line x1="4" x2="4" y1="10" y2="3" />
              <line x1="12" x2="12" y1="21" y2="12" />
              <line x1="12" x2="12" y1="8" y2="3" />
              <line x1="20" x2="20" y1="21" y2="16" />
              <line x1="20" x2="20" y1="12" y2="3" />
              <line x1="2" x2="6" y1="14" y2="14" />
              <line x1="10" x2="14" y1="8" y2="8" />
              <line x1="18" x2="22" y1="16" y2="16" />
            </svg>
          </div>

          <div className="max-w-0 overflow-hidden opacity-0 transition-all duration-300 ease-in-out group-hover/ctrl:max-w-[32rem] group-hover/ctrl:opacity-100">
            <div className="flex items-center gap-1 pl-0.5 pr-2">
              <div className="h-4 w-px shrink-0 bg-border" />

              <button
                onClick={() => setScale((s) => clampScale(s - ZOOM_STEP))}
                className="flex size-7 items-center justify-center rounded-md text-sm text-foreground transition-colors hover:bg-accent"
              >
                −
              </button>
              <span className="w-10 select-none text-center text-[11px] tabular-nums text-muted-foreground">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale((s) => clampScale(s + ZOOM_STEP))}
                className="flex size-7 items-center justify-center rounded-md text-sm text-foreground transition-colors hover:bg-accent"
              >
                +
              </button>

              <div className="h-4 w-px shrink-0 bg-border" />

              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="flex size-7 items-center justify-center rounded-md text-sm text-foreground transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-30"
              >
                ‹
              </button>
              <span className="min-w-[3rem] select-none text-center text-[11px] tabular-nums text-muted-foreground">
                {currentPage} / {numPages}
              </span>
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= numPages}
                className="flex size-7 items-center justify-center rounded-md text-sm text-foreground transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-30"
              >
                ›
              </button>

              <div className="h-4 w-px shrink-0 bg-border" />

              <button
                onClick={() => setHighlightsVisible((visible) => !visible)}
                className={`h-7 rounded-md px-2 text-[11px] font-medium transition-colors ${
                  highlightsVisible
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent"
                }`}
                title={highlightsVisible ? "Hide highlights" : "Show highlights"}
              >
                Highlights
              </button>
            </div>
          </div>
        </div>
      </div>

      {linkingElementId && (
        <div
          className="absolute left-1/2 z-10 -translate-x-1/2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 shadow-md"
          style={{ top: "calc(var(--app-topbar-height) + 0.75rem)" }}
        >
          <span className="animate-pulse text-xs font-medium text-orange-600">
            Click a position in the PDF to link...
          </span>
        </div>
      )}
    </div>
  );
}

export default function PdfViewer() {
  const {
    pdfBytes,
    links,
    activeLink,
    clearActiveLink,
    linkingElementId,
    completeLinking,
    currentFileId,
    isLoading,
  } = useLinkStore();

  const pdfData = useMemo(() => {
    if (!pdfBytes) return null;
    return new Uint8Array(
      pdfBytes.buffer.slice(
        pdfBytes.byteOffset,
        pdfBytes.byteOffset + pdfBytes.byteLength,
      ),
    );
  }, [pdfBytes]);

  const pdfFile = useMemo(() => {
    if (!pdfData) return null;
    return { data: pdfData };
  }, [pdfData]);

  if (isLoading || !pdfFile) {
    return (
      <div
        className="flex h-full items-center justify-center"
        style={{ backgroundColor: "var(--editor-surface)" }}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <PdfDocumentView
      key={currentFileId ?? "active-pdf"}
      pdfFile={pdfFile}
      links={links}
      activeLink={activeLink}
      clearActiveLink={clearActiveLink}
      linkingElementId={linkingElementId}
      completeLinking={completeLinking}
      currentFileId={currentFileId}
    />
  );
}
