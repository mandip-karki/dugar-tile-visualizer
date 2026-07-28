import { AfterViewInit, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TileRecord } from '../../models/tile.model';
import { TileService } from '../../services/tile.service';
import { FloorWarpService, Quad } from '../../services/floor-warp.service';
import { RoomGeometryService } from '../../services/room-geometry.service';
import { parseTileSizeCm } from '../../utils/tile-size';

@Component({
  selector: 'app-room-builder',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './room-builder.html',
  styleUrl: './room-builder.scss',
})
export class RoomBuilder implements AfterViewInit {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() set floorTile(t: TileRecord | null) {
    this._floorTile = t;
    this.loadTileImage(t, (img) => (this.floorTileImg = img));
  }

  @Input() set wallTile(t: TileRecord | null) {
    this._wallTile = t;
    this.loadTileImage(t, (img) => (this.wallTileImg = img));
  }

  widthM = 4;
  depthM = 4;
  heightM = 2.7;

  /** Fudge factor on top of the physically-computed repeat counts, in case the default looks off. */
  tileScale = 1;
  brightness = 1.3;

  private _floorTile: TileRecord | null = null;
  private _wallTile: TileRecord | null = null;
  private floorTileImg: HTMLImageElement | null = null;
  private wallTileImg: HTMLImageElement | null = null;

  private baseImage: HTMLCanvasElement | null = null;
  private floorQuad: Quad | null = null;
  private wallQuads: Quad[] = [];
  private renderScheduled = false;

  constructor(
    private readonly warp: FloorWarpService,
    private readonly geometry: RoomGeometryService,
    private readonly tileService: TileService
  ) {}

  ngAfterViewInit(): void {
    this.generate();
  }

  private loadTileImage(t: TileRecord | null, assign: (img: HTMLImageElement | null) => void): void {
    if (!t) {
      assign(null);
      this.scheduleRender();
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      assign(img);
      this.scheduleRender();
    };
    img.src = this.tileService.imageUrl(t.fullImage);
  }

  generate(): void {
    const w = this.clampDim(this.widthM);
    const d = this.clampDim(this.depthM);
    const h = Math.max(2, Math.min(5, this.heightM || 2.7));
    this.widthM = w;
    this.depthM = d;
    this.heightM = h;

    const room = this.geometry.build(w, d, h);
    this.baseImage = room.baseImage;
    this.floorQuad = room.floorQuad;
    this.wallQuads = room.wallQuads;
    this.scheduleRender();
  }

  private clampDim(v: number): number {
    if (!v || isNaN(v)) return 4;
    return Math.max(1.5, Math.min(12, v));
  }

  /** How many times a `tileCm`-sized tile repeats across a `spanCm` surface, at the current scale. */
  private repeatsFor(spanCm: number, tileCm: number): number {
    const raw = spanCm / tileCm / this.tileScale;
    return Math.max(1, Math.min(40, Math.round(raw)));
  }

  private scheduleRender(): void {
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    requestAnimationFrame(() => {
      this.renderScheduled = false;
      this.doRender();
    });
  }

  private doRender(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.baseImage || !this.floorQuad) return;

    if (canvas.width !== this.baseImage.width || canvas.height !== this.baseImage.height) {
      canvas.width = this.baseImage.width;
      canvas.height = this.baseImage.height;
    }

    let base: HTMLCanvasElement = this.baseImage;
    canvas.getContext('2d')!.drawImage(base, 0, 0);

    const widthCm = this.widthM * 100;
    const depthCm = this.depthM * 100;
    const heightCm = this.heightM * 100;

    const floorImg = this.floorTileImg;
    if (floorImg) {
      const size = parseTileSizeCm(this._floorTile?.size) ?? { w: 60, h: 60 };
      const repeatX = this.repeatsFor(widthCm, size.w);
      const repeatY = this.repeatsFor(depthCm, size.h);
      this.warp.render(canvas, base, floorImg, this.floorQuad, repeatX, repeatY, this.brightness, null);
      base = canvas;
    }

    const wallImg = this.wallTileImg;
    if (wallImg) {
      const size = parseTileSizeCm(this._wallTile?.size) ?? { w: 30, h: 60 };
      // wallQuads order is [back, left, right]; back spans the room's width, the sides span its depth
      const spans = [widthCm, depthCm, depthCm];
      this.wallQuads.forEach((wallQuad, i) => {
        const repeatX = this.repeatsFor(spans[i], size.w);
        const repeatY = this.repeatsFor(heightCm, size.h);
        this.warp.render(canvas, base, wallImg, wallQuad, repeatX, repeatY, this.brightness, null);
        base = canvas;
      });
    }
  }

  onChange(): void {
    this.generate();
  }
}
