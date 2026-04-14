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
  type: "text" | "area";
}

export interface LinkEntry {
  elementId: string;
  pdfLink: PdfDeepLink;
}
