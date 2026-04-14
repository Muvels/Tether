import { useState, useRef, useEffect, useCallback } from "react";
import { Document, pdfjs } from "react-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import PdfPage from "./PdfPage";
import { useLinkStore } from "../../store/useLinkStore";
import { consumePendingFile } from "../../utils/pendingFile";
import type { PdfDeepLink } from "../../types";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type PdfFile = { data: Uint8Array } | string;

interface Props {
  pdfUrl: string;
}

export default function PdfViewer({ pdfUrl }: Props) {
  const { links, activeLink, clearActiveLink, linkingElementId, completeLinking } =
    useLinkStore();

  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [highlightsVisible, setHighlightsVisible] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfFile, setPdfFile] = useState<PdfFile | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  const baseWidth = 600;
  const pageWidth = baseWidth * scale;

  const highlights = links.map((l) => l.pdfLink);

  // Pick up a file queued by ProjectPage (or load URL-based pdfUrl on mount)
  useEffect(() => {
    if (pdfFile) return;
    const pending = consumePendingFile();
    if (pending) {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          setPdfFile({ data: new Uint8Array(reader.result) });
        }
      };
      reader.readAsArrayBuffer(pending);
    } else {
      setPdfFile(pdfUrl);
    }
  }, [pdfUrl, pdfFile]);

  const handleSelection = useCallback((_link: PdfDeepLink) => {}, []);

  const handleLinkingClick = useCallback(
    (link: PdfDeepLink) => {
      if (linkingElementId) {
        completeLinking(link);
      }
    },
    [linkingElementId, completeLinking],
  );

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

  const goToPage = useCallback(
    (page: number) => {
      const el = pageRefs.current.get(page);
      if (el && scrollRef.current) {
        const containerRect = scrollRef.current.getBoundingClientRect();
        const pageRect = el.getBoundingClientRect();
        const targetY =
          pageRect.top - containerRect.top + scrollRef.current.scrollTop - 16;
        scrollRef.current.scrollTo({ top: targetY, behavior: "smooth" });
      }
    },
    [],
  );

  if (!pdfFile) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-100">
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 shrink-0">
        <button
          onClick={() => setScale((s) => Math.max(0.5, s - 0.15))}
          className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
        >
          -
        </button>
        <span className="text-xs text-gray-500 tabular-nums w-10 text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale((s) => Math.min(3, s + 0.15))}
          className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
        >
          +
        </button>

        <span className="text-xs text-gray-400 mx-1">|</span>

        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="rounded bg-gray-100 px-1.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-default"
        >
          &lsaquo;
        </button>
        <span className="text-xs text-gray-500 tabular-nums">
          {currentPage} / {numPages}
        </span>
        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= numPages}
          className="rounded bg-gray-100 px-1.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-default"
        >
          &rsaquo;
        </button>

        <span className="text-xs text-gray-400 mx-1">|</span>

        <button
          onClick={() => setHighlightsVisible((v) => !v)}
          className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
            highlightsVisible
              ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
          title={highlightsVisible ? "Hide highlights" : "Show highlights"}
        >
          {highlightsVisible ? "Hide highlights" : "Show highlights"}
        </button>

        {linkingElementId && (
          <span className="ml-auto text-xs font-medium text-orange-600 animate-pulse">
            Click a position in the PDF to link...
          </span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto p-4">
        <Document
          file={pdfFile}
          onLoadSuccess={(doc) => { setNumPages(doc.numPages); setPdfDocument(doc); }}
          onLoadError={(error) => console.error("PDF load error:", error)}
          error={
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <p className="text-red-500 text-sm font-medium">Failed to load PDF</p>
            </div>
          }
          loading={
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          }
        >
          <div className="flex flex-col items-center gap-4">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((page) => (
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
    </div>
  );
}
