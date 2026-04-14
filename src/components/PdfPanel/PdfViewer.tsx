import { useState, useRef, useEffect, useCallback } from "react";
import { Document, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import PdfPage from "./PdfPage";
import { useLinkStore } from "../../store/useLinkStore";
import type { PdfDeepLink } from "../../types";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type PdfFile = { data: Uint8Array } | string;

export default function PdfViewer() {
  const { pdfUrl, setPdfUrl, links, activeLink, clearActiveLink, linkingElementId, completeLinking } =
    useLinkStore();

  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [pdfFile, setPdfFile] = useState<PdfFile | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const baseWidth = 600;
  const pageWidth = baseWidth * scale;

  const highlights = links.map((l) => l.pdfLink);

  const loadFromFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          setPdfFile({ data: new Uint8Array(reader.result) });
          setPdfUrl(file.name);
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [setPdfUrl],
  );

  const loadFromUrl = useCallback(
    (url: string) => {
      setPdfFile(url);
      setPdfUrl(url);
    },
    [setPdfUrl],
  );

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) loadFromFile(file);
    },
    [loadFromFile],
  );

  const resetPdf = useCallback(() => {
    setPdfUrl(null);
    setPdfFile(null);
    setNumPages(0);
  }, [setPdfUrl]);

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

  if (!pdfUrl || !pdfFile) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-8">
        <div className="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-gray-300 rounded-xl bg-white">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          <p className="text-gray-500 text-sm font-medium">Upload a PDF to get started</p>
          <label className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
            Choose PDF
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          <button
            onClick={() => loadFromUrl("/sample.pdf")}
            className="text-xs text-blue-500 underline hover:text-blue-700"
          >
            or load sample PDF
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-100">
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 shrink-0">
        <label className="cursor-pointer rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors">
          Open
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        <span className="text-xs text-gray-400 mx-1">|</span>

        <button
          onClick={() => setScale((s) => Math.max(0.5, s - 0.15))}
          className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
        >
          −
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
        <span className="text-xs text-gray-400">
          {numPages} page{numPages !== 1 ? "s" : ""}
        </span>

        {linkingElementId && (
          <span className="ml-auto text-xs font-medium text-orange-600 animate-pulse">
            Click a position in the PDF to link…
          </span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto p-4">
        <Document
          file={pdfFile}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          onLoadError={(error) => console.error("PDF load error:", error)}
          error={
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <p className="text-red-500 text-sm font-medium">Failed to load PDF</p>
              <button onClick={resetPdf} className="text-xs text-blue-600 underline">
                Try another file
              </button>
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
              <div key={page} ref={(el) => setPageRef(page, el)}>
                <PdfPage
                  pageNumber={page}
                  width={pageWidth}
                  onSelection={handleSelection}
                  highlights={highlights}
                  activeLink={activeLink}
                  linkingMode={!!linkingElementId}
                  onLinkingClick={handleLinkingClick}
                />
              </div>
            ))}
          </div>
        </Document>
      </div>
    </div>
  );
}
