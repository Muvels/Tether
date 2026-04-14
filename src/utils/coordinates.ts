import type { NormalizedRect } from "../types";

export function normalizeRect(
  absoluteRect: DOMRect,
  containerRect: DOMRect,
): NormalizedRect {
  return {
    x: (absoluteRect.left - containerRect.left) / containerRect.width,
    y: (absoluteRect.top - containerRect.top) / containerRect.height,
    width: absoluteRect.width / containerRect.width,
    height: absoluteRect.height / containerRect.height,
  };
}

export function denormalizeRect(
  normalized: NormalizedRect,
  containerWidth: number,
  containerHeight: number,
): { left: number; top: number; width: number; height: number } {
  return {
    left: normalized.x * containerWidth,
    top: normalized.y * containerHeight,
    width: normalized.width * containerWidth,
    height: normalized.height * containerHeight,
  };
}
