import {
  useState,
  useRef,
  useCallback,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useProjectStore } from "@/store/useProjectStore";
import { useLinkStore } from "@/store/useLinkStore";
import { ChevronLeftIcon } from "lucide-react";

interface Props {
  left: ReactNode;
  right: ReactNode;
}

const MIN_PANEL_PCT = 20;
const DEFAULT_PCT = 45;

export default function Layout({ left, right }: Props) {
  const [leftPct, setLeftPct] = useState(DEFAULT_PCT);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeFileId = useProjectStore((s) => s.activeFileId);
  const closeFile = useProjectStore((s) => s.closeFile);
  const saveCurrentFile = useLinkStore((s) => s.saveCurrentFile);

  const project = projects.find((p) => p.id === activeProjectId);
  const file = project?.files.find((f) => f.id === activeFileId);

  const handleBack = useCallback(() => {
    saveCurrentFile();
    closeFile();
  }, [saveCurrentFile, closeFile]);

  const onMouseDown = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    dragging.current = true;

    const onMove = (ev: globalThis.MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      let pct = ((ev.clientX - rect.left) / rect.width) * 100;
      pct = Math.max(MIN_PANEL_PCT, Math.min(100 - MIN_PANEL_PCT, pct));
      setLeftPct(pct);
    };

    const onUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Breadcrumb bar */}
      <div className="flex items-center gap-1.5 border-b border-border bg-background px-3 py-1.5 shrink-0">
        <button
          onClick={handleBack}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          {project?.name ?? "Back"}
        </button>
        {file && (
          <>
            <span className="text-xs text-muted-foreground/50">/</span>
            <span className="text-xs text-foreground truncate">{file.name}</span>
          </>
        )}
      </div>

      {/* Split panels */}
      <div ref={containerRef} className="flex flex-1 w-full overflow-hidden">
        <div className="h-full overflow-hidden" style={{ width: `${leftPct}%` }}>
          {left}
        </div>

        <div
          onMouseDown={onMouseDown}
          className="h-full w-1.5 cursor-col-resize bg-gray-200 hover:bg-blue-400 transition-colors flex-shrink-0"
        />

        <div className="h-full overflow-hidden flex-1">{right}</div>
      </div>
    </div>
  );
}
