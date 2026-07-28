import { Injectable } from '@angular/core';
import '@tensorflow/tfjs-backend-webgl'; // side-effect import: registers the webgl backend deeplab needs
import * as deeplab from '@tensorflow-models/deeplab';
import { Point } from './floor-warp.service';

export interface SurfaceDetectionResult {
  /** White where the surface was detected, transparent everywhere else. Same size as the source photo. */
  maskCanvas: HTMLCanvasElement;
  /** A trapezoid roughly bounding the detected surface, used to drive the perspective tiling. */
  quad: [Point, Point, Point, Point];
}

export interface RoomDetectionResult {
  floor: SurfaceDetectionResult | null;
  wall: SurfaceDetectionResult | null;
}

@Injectable({ providedIn: 'root' })
export class FloorSegmentationService {
  private modelPromise: Promise<deeplab.SemanticSegmentation> | null = null;

  private getModel(): Promise<deeplab.SemanticSegmentation> {
    if (!this.modelPromise) {
      this.modelPromise = deeplab.load({ base: 'ade20k', quantizationBytes: 2 });
    }
    return this.modelPromise;
  }

  /** Runs one segmentation pass and extracts both the floor and wall regions from it. */
  async detectRoom(image: HTMLImageElement): Promise<RoomDetectionResult> {
    const model = await this.getModel();
    const { legend, width, height, segmentationMap } = await model.segment(image);

    return {
      floor: this.buildResult(segmentationMap, width, height, legend['floor'], image),
      wall: this.buildResult(segmentationMap, width, height, legend['wall'], image),
    };
  }

  private buildResult(
    segmentationMap: Uint8ClampedArray,
    width: number,
    height: number,
    targetColor: [number, number, number] | undefined,
    image: HTMLImageElement
  ): SurfaceDetectionResult | null {
    if (!targetColor) return null;
    const [tr, tg, tb] = targetColor;

    const small = document.createElement('canvas');
    small.width = width;
    small.height = height;
    const sctx = small.getContext('2d')!;
    const smallData = sctx.createImageData(width, height);
    let matchCount = 0;
    for (let i = 0; i < width * height; i++) {
      const o = i * 4;
      const isMatch =
        Math.abs(segmentationMap[o] - tr) < 12 &&
        Math.abs(segmentationMap[o + 1] - tg) < 12 &&
        Math.abs(segmentationMap[o + 2] - tb) < 12;
      smallData.data[o] = 255;
      smallData.data[o + 1] = 255;
      smallData.data[o + 2] = 255;
      smallData.data[o + 3] = isMatch ? 255 : 0;
      if (isMatch) matchCount++;
    }
    if (matchCount < width * height * 0.02) return null; // negligible/not found

    sctx.putImageData(smallData, 0, 0);

    const full = document.createElement('canvas');
    full.width = image.naturalWidth;
    full.height = image.naturalHeight;
    const fctx = full.getContext('2d')!;
    fctx.imageSmoothingEnabled = true;
    fctx.drawImage(small, 0, 0, full.width, full.height);
    // sharpen the smoothed edge back toward a hard mask so we don't get a
    // washed-out translucent border where the resize blurred it
    const fullData = fctx.getImageData(0, 0, full.width, full.height);
    for (let i = 3; i < fullData.data.length; i += 4) {
      fullData.data[i] = fullData.data[i] > 90 ? 255 : 0;
    }
    fctx.putImageData(fullData, 0, 0);

    const quad = this.estimateQuad(fullData, full.width, full.height);
    return { maskCanvas: full, quad };
  }

  private estimateQuad(imageData: ImageData, w: number, h: number): [Point, Point, Point, Point] {
    const data = imageData.data;
    const alphaAt = (x: number, y: number) => data[(y * w + x) * 4 + 3];

    const rowExtent = (y: number): { minX: number; maxX: number } | null => {
      let minX = -1;
      let maxX = -1;
      for (let x = 0; x < w; x += 2) {
        if (alphaAt(x, y) > 128) {
          if (minX === -1) minX = x;
          maxX = x;
        }
      }
      return minX === -1 ? null : { minX, maxX };
    };

    let topY = -1;
    let bottomY = -1;
    for (let y = 0; y < h; y += 2) {
      if (rowExtent(y)) {
        topY = y;
        break;
      }
    }
    for (let y = h - 1; y >= 0; y -= 2) {
      if (rowExtent(y)) {
        bottomY = y;
        break;
      }
    }
    if (topY === -1 || bottomY === -1 || bottomY <= topY) {
      return [
        { x: w * 0.1, y: h * 0.5 },
        { x: w * 0.9, y: h * 0.5 },
        { x: w * 0.98, y: h * 0.98 },
        { x: w * 0.02, y: h * 0.98 },
      ];
    }

    // sample slightly inside the extreme rows to avoid single-pixel noise,
    // and pad the resulting quad outward a bit so it fully covers the mask
    const span = bottomY - topY;
    const topSampleY = Math.min(h - 1, topY + Math.round(span * 0.05));
    const bottomSampleY = Math.max(0, bottomY - Math.round(span * 0.02));
    const top = rowExtent(topSampleY) ?? { minX: w * 0.3, maxX: w * 0.7 };
    const bottom = rowExtent(bottomSampleY) ?? { minX: 0, maxX: w };

    const pad = 0.04;
    const topPad = (top.maxX - top.minX) * pad;
    const bottomPad = (bottom.maxX - bottom.minX) * pad;

    return [
      { x: Math.max(0, top.minX - topPad), y: Math.max(0, topY - span * 0.03) },
      { x: Math.min(w, top.maxX + topPad), y: Math.max(0, topY - span * 0.03) },
      { x: Math.min(w, bottom.maxX + bottomPad), y: Math.min(h, bottomY + span * 0.02) },
      { x: Math.max(0, bottom.minX - bottomPad), y: Math.min(h, bottomY + span * 0.02) },
    ];
  }
}
