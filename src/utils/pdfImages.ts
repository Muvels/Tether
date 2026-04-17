import { pdfjs } from "react-pdf";
import type { NormalizedRect } from "../types";

const OPS = pdfjs.OPS;

export interface PdfImageRect {
  name: string;
  rect: NormalizedRect;
}

const MIN_IMAGE_FRACTION = 0.03;

function multiply(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

export async function extractPageImages(
  page: import("pdfjs-dist").PDFPageProxy,
): Promise<PdfImageRect[]> {
  const viewport = page.getViewport({ scale: 1 });
  const ops = await page.getOperatorList();

  const images: PdfImageRect[] = [];
  let ctm: number[] = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];

    if (fn === OPS.save) {
      stack.push([...ctm]);
    } else if (fn === OPS.restore) {
      ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    } else if (fn === OPS.transform) {
      ctm = multiply(ctm, args as number[]);
    } else if (fn === OPS.paintImageXObject || fn === OPS.paintImageXObjectRepeat) {
      const [a, , , d, e, f] = ctm;

      const [cx0, cy0] = viewport.convertToViewportPoint(e, f);
      const [cx1, cy1] = viewport.convertToViewportPoint(e + a, f + d);

      const left = Math.min(cx0, cx1);
      const top = Math.min(cy0, cy1);
      const w = Math.abs(cx1 - cx0);
      const h = Math.abs(cy1 - cy0);

      const normW = w / viewport.width;
      const normH = h / viewport.height;

      if (normW < MIN_IMAGE_FRACTION && normH < MIN_IMAGE_FRACTION) continue;

      images.push({
        name: args[0] as string,
        rect: {
          x: left / viewport.width,
          y: top / viewport.height,
          width: normW,
          height: normH,
        },
      });
    }
  }

  return images;
}

export function captureCanvasRegion(
  canvas: HTMLCanvasElement,
  rect: NormalizedRect,
): string | null {
  const sx = Math.round(rect.x * canvas.width);
  const sy = Math.round(rect.y * canvas.height);
  const sw = Math.round(rect.width * canvas.width);
  const sh = Math.round(rect.height * canvas.height);

  if (sw < 2 || sh < 2) return null;

  const tmp = document.createElement("canvas");
  tmp.width = sw;
  tmp.height = sh;
  const ctx = tmp.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return tmp.toDataURL("image/png");
}
