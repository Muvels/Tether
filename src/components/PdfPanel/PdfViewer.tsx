import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Document, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import PdfPage from "./PdfPage";
import { useLinkStore } from "../../store/useLinkStore";
import type { PdfDeepLink, PdfDocumentLike } from "../../types";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const BASE_PAGE_WIDTH = 600;
const MIN_SCALE = 0.1;
const MAX_SCALE = 3;
const ZOOM_STEP = 0.15;

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
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
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [pdfDocument, setPdfDocument] = useState<PdfDocumentLike | null>(null);
  const [highlightsVisible, setHighlightsVisible] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  const pageWidth = BASE_PAGE_WIDTH * scale;

  const highlights = links.map((link) => link.pdfLink);
  const handleSelection = useCallback(() => {}, []);

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

  useEffect(() => {
    if (!activeLink || !scrollRef.current) return;

    const pageEl = pageRefs.current.get(activeLink.page);
    if (pageEl) {
      const containerRect = scrollRef.current.getBoundingClientRect();
      const pageRect = pageEl.getBoundingClientRect();
      const targetY =
        pageRect.top -
        containerRect.top +
        scrollRef.current.scrollTop +
        activeLink.rect.y * pageRect.height -
        containerRect.height / 3;

      scrollRef.current.scrollTo({ top: targetY, behavior: "smooth" });
    }

    const timer = setTimeout(clearActiveLink, 4000);
    return () => clearTimeout(timer);
  }, [activeLink, clearActiveLink]);

  const setPageRef = useCallback((page: number, el: HTMLDivElement | null) => {
    if (el) pageRefs.current.set(page, el);
    else pageRefs.current.delete(page);
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || numPages === 0) return;

    observerRef.current?.disconnect();

    const visiblePages = new Map<number, number>();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const page = Number(entry.target.getAttribute("data-page"));
          if (!page) continue;
          visiblePages.set(page, entry.intersectionRatio);
        }
        let bestPage = 1;
        let bestRatio = 0;
        for (const [page, ratio] of visiblePages) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestPage = page;
          }
        }
        setCurrentPage(bestPage);
      },
      { root: container, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    for (const [, el] of pageRefs.current) {
      observerRef.current.observe(el);
    }

    return () => observerRef.current?.disconnect();
  }, [numPages, scale]);

  const goToPage = useCallback((page: number) => {
    const el = pageRefs.current.get(page);
    if (el && scrollRef.current) {
      const topBarHeight =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--app-topbar-height",
          ),
        ) || 0;
      const containerRect = scrollRef.current.getBoundingClientRect();
      const pageRect = el.getBoundingClientRect();
      const targetY =
        pageRect.top -
        containerRect.top +
        scrollRef.current.scrollTop -
        16 -
        topBarHeight;
      scrollRef.current.scrollTo({ top: targetY, behavior: "smooth" });
    }
  }, []);

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
            try {
              await fitDocumentToVisibleArea(nextDocument);
            } catch (error) {
              console.warn("PDF fit error:", error);
            }
            setNumPages(doc.numPages);
            setPdfDocument(nextDocument);
            setCurrentPage(1);
            setLoadError(null);
            pageRefs.current.clear();
          }}
          onLoadError={(error) => {
            console.error("PDF load error:", error);
            setLoadError(error instanceof Error ? error.message : String(error));
          }}
          error={
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <p className="text-red-500 text-sm font-medium">Failed to load PDF</p>
              {loadError && (
                <p className="max-w-md text-center text-xs text-red-400">{loadError}</p>
              )}
            </div>
          }
          loading={
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          }
        >
          <div className="flex flex-col items-center gap-4">
            {Array.from({ length: numPages }, (_, index) => index + 1).map((page) => (
              <div key={page} data-page={page} ref={(el) => setPageRef(page, el)}>
                <PdfPage
                  pageNumber={page}
                  width={pageWidth}
                  onSelection={handleSelection}
                  highlights={highlightsVisible ? highlights : []}
                  activeLink={highlightsVisible ? activeLink : null}
                  linkingMode={!!linkingElementId}
                  onLinkingClick={handleLinkingClick}
                  pdfDocument={pdfDocument}
                />
              </div>
            ))}
          </div>
        </Document>
      </div>

      {/* Floating controls — circle that expands on hover */}
      <div className="absolute bottom-4 left-4 z-10 group/ctrl">
        <div className="flex items-center bg-card border border-border rounded-full shadow-sm transition-all duration-300 ease-in-out">
          {/* Trigger circle */}
          <div className="size-9 flex items-center justify-center shrink-0 text-muted-foreground">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" x2="4" y1="21" y2="14" /><line x1="4" x2="4" y1="10" y2="3" />
              <line x1="12" x2="12" y1="21" y2="12" /><line x1="12" x2="12" y1="8" y2="3" />
              <line x1="20" x2="20" y1="21" y2="16" /><line x1="20" x2="20" y1="12" y2="3" />
              <line x1="2" x2="6" y1="14" y2="14" /><line x1="10" x2="14" y1="8" y2="8" />
              <line x1="18" x2="22" y1="16" y2="16" />
            </svg>
          </div>

          {/* Expandable strip */}
          <div className="overflow-hidden max-w-0 opacity-0 group-hover/ctrl:max-w-[32rem] group-hover/ctrl:opacity-100 transition-all duration-300 ease-in-out">
            <div className="flex items-center gap-1 pr-2 pl-0.5">
              <div className="w-px h-4 bg-border shrink-0" />

              {/* Zoom */}
              <button
                onClick={() => setScale((s) => clampScale(s - ZOOM_STEP))}
                className="size-7 flex items-center justify-center rounded-md text-sm text-foreground hover:bg-accent transition-colors"
              >
                −
              </button>
              <span className="text-[11px] text-muted-foreground tabular-nums w-10 text-center select-none">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale((s) => clampScale(s + ZOOM_STEP))}
                className="size-7 flex items-center justify-center rounded-md text-sm text-foreground hover:bg-accent transition-colors"
              >
                +
              </button>

              <div className="w-px h-4 bg-border shrink-0" />

              {/* Pages */}
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="size-7 flex items-center justify-center rounded-md text-sm text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-default"
              >
                ‹
              </button>
              <span className="text-[11px] text-muted-foreground tabular-nums min-w-[3rem] text-center select-none">
                {currentPage} / {numPages}
              </span>
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= numPages}
                className="size-7 flex items-center justify-center rounded-md text-sm text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-default"
              >
                ›
              </button>

              <div className="w-px h-4 bg-border shrink-0" />

              {/* Highlights */}
              <button
                onClick={() => setHighlightsVisible((visible) => !visible)}
                className={`h-7 px-2 rounded-md text-[11px] font-medium transition-colors ${
                  highlightsVisible
                    ? "text-foreground bg-accent"
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

      {/* Linking mode banner */}
      {linkingElementId && (
        <div
          className="absolute left-1/2 z-10 -translate-x-1/2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 shadow-md"
          style={{ top: "calc(var(--app-topbar-height) + 0.75rem)" }}
        >
          <span className="text-xs font-medium text-orange-600 animate-pulse">
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
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
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
