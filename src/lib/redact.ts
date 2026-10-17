/**
 * Pure, DOM-free redaction: given ImageData and rectangles in image-pixel
 * coordinates, returns new ImageData with the covered pixels set to solid
 * black. Used both by the browser editor (via canvas ImageData) and by the
 * unit test, so the "exported pixels are actually covered" guarantee is
 * verified by the same code that ships.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function applyRedactions(
  imageData: { width: number; height: number; data: Uint8ClampedArray },
  rects: Rect[]
): { width: number; height: number; data: Uint8ClampedArray } {
  const out = new Uint8ClampedArray(imageData.data);
  for (const r of rects) {
    const x0 = Math.max(0, Math.floor(Math.min(r.x, r.x + r.w)));
    const x1 = Math.min(imageData.width, Math.ceil(Math.max(r.x, r.x + r.w)));
    const y0 = Math.max(0, Math.floor(Math.min(r.y, r.y + r.h)));
    const y1 = Math.min(imageData.height, Math.ceil(Math.max(r.y, r.y + r.h)));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * imageData.width + x) * 4;
        out[i] = 0;
        out[i + 1] = 0;
        out[i + 2] = 0;
        out[i + 3] = 255;
      }
    }
  }
  return { width: imageData.width, height: imageData.height, data: out };
}
