import type { PdfDeepLink } from "../types";

const MIME_TYPE = "application/x-pdf-deep-link";

export function setDragData(
  dataTransfer: DataTransfer,
  link: PdfDeepLink,
): void {
  dataTransfer.setData(MIME_TYPE, JSON.stringify(link));
  dataTransfer.setData("text/plain", link.text ?? `[PDF p.${link.page}]`);
  dataTransfer.effectAllowed = "copy";
}

export function getDragData(dataTransfer: DataTransfer): PdfDeepLink | null {
  const raw = dataTransfer.getData(MIME_TYPE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PdfDeepLink;
  } catch {
    return null;
  }
}

export function hasDragData(dataTransfer: DataTransfer): boolean {
  return dataTransfer.types.includes(MIME_TYPE);
}
