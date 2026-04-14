import {
  useState,
  useRef,
  useCallback,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from "react";

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
    <div ref={containerRef} className="flex h-full w-full overflow-hidden">
      <div className="h-full overflow-hidden" style={{ width: `${leftPct}%` }}>
        {left}
      </div>

      <div
        onMouseDown={onMouseDown}
        className="h-full w-1.5 cursor-col-resize bg-gray-200 hover:bg-blue-400 transition-colors flex-shrink-0"
      />

      <div className="h-full overflow-hidden flex-1">{right}</div>
    </div>
  );
}
