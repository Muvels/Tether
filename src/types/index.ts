export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfDeepLink {
  id: string;
  page: number;
  rect: NormalizedRect;
  text?: string;
  imageDataUrl?: string;
  type: "text" | "area" | "image";
}

export interface LinkEntry {
  elementId: string;
  pdfLink: PdfDeepLink;
}
