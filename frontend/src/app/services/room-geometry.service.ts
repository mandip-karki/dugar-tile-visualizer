import { Injectable } from '@angular/core';
import { Point, Quad } from './floor-warp.service';

export interface RoomGeometry {
  baseImage: HTMLCanvasElement;
  floorQuad: Quad;
  /** back, left, right — in that draw order */
  wallQuads: Quad[];
}

const CW = 900;
const CH = 650;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const norm = (v: number, lo: number, hi: number) => clamp((v - lo) / (hi - lo), 0, 1);

@Injectable({ providedIn: 'root' })
export class RoomGeometryService {
  build(widthM: number, depthM: number, heightM: number): RoomGeometry {
    const depthFactor = norm(depthM, 2, 10);
    const widthFactor = norm(widthM, 2, 8);
    const heightFactor = norm(heightM, 2, 4);

    // where the back wall meets the floor: deeper rooms push this line up
    // toward the middle of the frame (the far wall is smaller and further away)
    const floorTopY = CH * (0.45 + (1 - depthFactor) * 0.35);

    const backWallHeightPx = CH * clamp(0.22 + heightFactor * 0.22 - depthFactor * 0.06, 0.16, 0.46);
    const backWallBottomY = floorTopY;
    const backWallTopY = backWallBottomY - backWallHeightPx;

    const backWallWidthPx = CW * clamp(0.3 + widthFactor * 0.3 - depthFactor * 0.1, 0.22, 0.6);
    const backWallLeftX = CW / 2 - backWallWidthPx / 2;
    const backWallRightX = CW / 2 + backWallWidthPx / 2;

    const backWallQuad: Quad = [
      { x: backWallLeftX, y: backWallTopY },
      { x: backWallRightX, y: backWallTopY },
      { x: backWallRightX, y: backWallBottomY },
      { x: backWallLeftX, y: backWallBottomY },
    ];

    const floorQuad: Quad = [
      { x: backWallLeftX, y: backWallBottomY },
      { x: backWallRightX, y: backWallBottomY },
      { x: CW * 0.96, y: CH * 0.97 },
      { x: CW * 0.04, y: CH * 0.97 },
    ];

    const leftWallQuad: Quad = [
      { x: CW * 0.02, y: CH * 0.03 },
      { x: backWallLeftX, y: backWallTopY },
      { x: backWallLeftX, y: backWallBottomY },
      { x: CW * 0.02, y: CH * 0.9 },
    ];

    const rightWallQuad: Quad = [
      { x: backWallRightX, y: backWallTopY },
      { x: CW * 0.98, y: CH * 0.03 },
      { x: CW * 0.98, y: CH * 0.9 },
      { x: backWallRightX, y: backWallBottomY },
    ];

    const baseImage = this.buildBaseImage(
      backWallQuad,
      floorQuad,
      leftWallQuad,
      rightWallQuad
    );

    return { baseImage, floorQuad, wallQuads: [backWallQuad, leftWallQuad, rightWallQuad] };
  }

  private buildBaseImage(backWall: Quad, floor: Quad, leftWall: Quad, rightWall: Quad): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = CW;
    canvas.height = CH;
    const ctx = canvas.getContext('2d')!;

    // ceiling / background
    ctx.fillStyle = '#f1eee6';
    ctx.fillRect(0, 0, CW, CH);

    const fillQuad = (q: Quad, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(q[0].x, q[0].y);
      ctx.lineTo(q[1].x, q[1].y);
      ctx.lineTo(q[2].x, q[2].y);
      ctx.lineTo(q[3].x, q[3].y);
      ctx.closePath();
      ctx.fill();
    };
    const strokeQuad = (q: Quad, color: string, width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(q[0].x, q[0].y);
      ctx.lineTo(q[1].x, q[1].y);
      ctx.lineTo(q[2].x, q[2].y);
      ctx.lineTo(q[3].x, q[3].y);
      ctx.closePath();
      ctx.stroke();
    };

    fillQuad(leftWall, '#e3ded2');
    fillQuad(rightWall, '#ece7db');
    fillQuad(backWall, '#e9e4d8');
    fillQuad(floor, '#cdc3ae');

    // soft contact-shadow lines where surfaces meet, for a bit of depth
    strokeQuad(leftWall, 'rgba(0,0,0,0.12)', 2);
    strokeQuad(rightWall, 'rgba(0,0,0,0.12)', 2);
    strokeQuad(backWall, 'rgba(0,0,0,0.12)', 2);
    strokeQuad(floor, 'rgba(0,0,0,0.16)', 2);

    // gentle vignette for depth
    const vignette = ctx.createRadialGradient(CW / 2, CH * 0.4, CH * 0.15, CW / 2, CH * 0.5, CW * 0.75);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, CW, CH);

    return canvas;
  }
}
