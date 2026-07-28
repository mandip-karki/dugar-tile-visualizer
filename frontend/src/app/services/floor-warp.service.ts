import { Injectable } from '@angular/core';

export interface Point {
  x: number;
  y: number;
}

export type Quad = [Point, Point, Point, Point];

/**
 * Maps the unit square (0,0)-(1,0)-(1,1)-(0,1) onto an arbitrary quad via a
 * projective (perspective) transform. Heckbert's square-to-quad mapping.
 */
function squareToQuad(quad: [Point, Point, Point, Point]) {
  const [p0, p1, p2, p3] = quad;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;

  let a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number;

  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    g = 0;
    h = 0;
    a = p1.x - p0.x;
    b = p2.x - p1.x;
    c = p0.x;
    d = p1.y - p0.y;
    e = p2.y - p1.y;
    f = p0.y;
  } else {
    const denom = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / denom;
    h = (dx1 * dy3 - dx3 * dy1) / denom;
    a = p1.x - p0.x + g * p1.x;
    b = p3.x - p0.x + h * p3.x;
    c = p0.x;
    d = p1.y - p0.y + g * p1.y;
    e = p3.y - p0.y + h * p3.y;
    f = p0.y;
  }

  return (u: number, v: number): Point => {
    const denom = g * u + h * v + 1;
    return {
      x: (a * u + b * v + c) / denom,
      y: (d * u + e * v + f) / denom,
    };
  };
}

/** Affine transform (2x3) mapping source triangle -> destination triangle. */
function triangleAffine(src: [Point, Point, Point], dst: [Point, Point, Point]) {
  const [s0, s1, s2] = src;
  const [D0, D1, D2] = dst;
  const denom = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(denom) < 1e-9) return null;

  const a = (D0.x * (s1.y - s2.y) + D1.x * (s2.y - s0.y) + D2.x * (s0.y - s1.y)) / denom;
  const b = (D0.x * (s2.x - s1.x) + D1.x * (s0.x - s2.x) + D2.x * (s1.x - s0.x)) / denom;
  const c =
    (D0.x * (s1.x * s2.y - s2.x * s1.y) +
      D1.x * (s2.x * s0.y - s0.x * s2.y) +
      D2.x * (s0.x * s1.y - s1.x * s0.y)) /
    denom;

  const d = (D0.y * (s1.y - s2.y) + D1.y * (s2.y - s0.y) + D2.y * (s0.y - s1.y)) / denom;
  const e = (D0.y * (s2.x - s1.x) + D1.y * (s0.x - s2.x) + D2.y * (s1.x - s0.x)) / denom;
  const f =
    (D0.y * (s1.x * s2.y - s2.x * s1.y) +
      D1.y * (s2.x * s0.y - s0.x * s2.y) +
      D2.y * (s0.x * s1.y - s1.x * s0.y)) /
    denom;

  return { a, b, c, d, e, f };
}

@Injectable({ providedIn: 'root' })
export class FloorWarpService {
  /**
   * Renders `tileImg` tiled and perspective-warped across `quad`, lit by the
   * luminance of `basePhoto` in that region, and composites the result onto
   * `outputCanvas` (which should already contain basePhoto drawn on it).
   */
  render(
    outputCanvas: HTMLCanvasElement,
    basePhoto: HTMLCanvasElement | HTMLImageElement,
    tileImg: HTMLImageElement,
    quad: [Point, Point, Point, Point],
    repeatX: number,
    repeatY: number,
    brightness = 1.5,
    floorMask: HTMLCanvasElement | null = null
  ): void {
    const w = outputCanvas.width;
    const h = outputCanvas.height;

    const pattern = document.createElement('canvas');
    pattern.width = w;
    pattern.height = h;
    const pctx = pattern.getContext('2d')!;

    const mapUV = squareToQuad(quad);
    const iw = tileImg.naturalWidth;
    const ih = tileImg.naturalHeight;

    for (let j = 0; j < repeatY; j++) {
      for (let i = 0; i < repeatX; i++) {
        const u0 = i / repeatX;
        const u1 = (i + 1) / repeatX;
        const v0 = j / repeatY;
        const v1 = (j + 1) / repeatY;

        const d00 = mapUV(u0, v0);
        const d10 = mapUV(u1, v0);
        const d11 = mapUV(u1, v1);
        const d01 = mapUV(u0, v1);

        this.drawTriangle(pctx, tileImg, [
          { x: 0, y: 0 },
          { x: iw, y: 0 },
          { x: iw, y: ih },
        ], [d00, d10, d11]);

        this.drawTriangle(pctx, tileImg, [
          { x: 0, y: 0 },
          { x: iw, y: ih },
          { x: 0, y: ih },
        ], [d00, d11, d01]);
      }
    }

    // luminance-preserving relight: multiply the warped pattern by the
    // original photo's brightness so shadows/highlights carry through.
    pctx.save();
    pctx.globalCompositeOperation = 'multiply';
    pctx.filter = `grayscale(1) brightness(${brightness})`;
    pctx.drawImage(basePhoto, 0, 0, w, h);
    pctx.restore();

    // punch out anything that isn't actually floor (rugs, furniture, etc.)
    if (floorMask) {
      pctx.save();
      pctx.globalCompositeOperation = 'destination-in';
      pctx.drawImage(floorMask, 0, 0, w, h);
      pctx.restore();
    }

    const octx = outputCanvas.getContext('2d')!;
    octx.drawImage(basePhoto, 0, 0, w, h);

    octx.save();
    if (!floorMask) {
      // no per-pixel mask available: fall back to clipping at the quad outline
      octx.beginPath();
      octx.moveTo(quad[0].x, quad[0].y);
      octx.lineTo(quad[1].x, quad[1].y);
      octx.lineTo(quad[2].x, quad[2].y);
      octx.lineTo(quad[3].x, quad[3].y);
      octx.closePath();
      octx.clip();
    }
    octx.drawImage(pattern, 0, 0);
    octx.restore();
  }

  private drawTriangle(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    src: [Point, Point, Point],
    dst: [Point, Point, Point]
  ): void {
    const m = triangleAffine(src, dst);
    if (!m) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(dst[0].x, dst[0].y);
    ctx.lineTo(dst[1].x, dst[1].y);
    ctx.lineTo(dst[2].x, dst[2].y);
    ctx.closePath();
    ctx.clip();
    ctx.transform(m.a, m.d, m.b, m.e, m.c, m.f);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }
}
