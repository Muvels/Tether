import { type RefObject } from "react";
import type { PdfDeepLink } from "../../types";

interface Props {
  containerRef: RefObject<HTMLDivElement | null>;
  highlights: PdfDeepLink[];
  activeHighlight: PdfDeepLink | null;
}

export default function HighlightLayer({
  highlights,
  activeHighlight,
}: Props) {
  return (
    <div className="absolute inset-0 pointer-events-none z-5">
      {highlights.map((h) => {
        const isActive = activeHighlight?.id === h.id;
        return (
          <div
            key={h.id}
            className={`absolute rounded-sm transition-opacity ${
              isActive
                ? "bg-blue-400/50 highlight-active ring-2 ring-blue-500"
                : "bg-yellow-300/30 hover:bg-yellow-300/50"
            }`}
            style={{
              left: `${h.rect.x * 100}%`,
              top: `${h.rect.y * 100}%`,
              width: `${h.rect.width * 100}%`,
              height: `${h.rect.height * 100}%`,
            }}
          />
        );
      })}
    </div>
  );
}
