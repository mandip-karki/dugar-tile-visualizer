import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Input,
  ViewChild,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TileRecord } from '../../models/tile.model';
import { TileService } from '../../services/tile.service';
import { FloorWarpService, Point } from '../../services/floor-warp.service';
import { FloorSegmentationService } from '../../services/floor-segmentation.service';
import { parseTileSizeCm } from '../../utils/tile-size';

type Surface = 'floor' | 'wall';
type Quad = [Point, Point, Point, Point];

const BASELINE_TILE_CM = 60;
const BASELINE_REPEAT = 6;

@Component({
  selector: 'app-floor-editor',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './floor-editor.html',
  styleUrl: './floor-editor.scss',
})
export class FloorEditor implements AfterViewInit {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() set photo(img: HTMLImageElement | null) {
    this._photo = img;
    this.masks.floor = null;
    this.masks.wall = null;
    this.surfaceFound.floor = false;
    this.surfaceFound.wall = false;
    this.detectionFailed.set(false);
    if (img) {
      this.quads.floor = this.defaultQuad('floor', img);
      this.quads.wall = this.defaultQuad('wall', img);
      this.runDetection(img);
    }
    this.scheduleRender();
  }

  @Input() set floorTile(t: TileRecord | null) {
    this._floorTile = t;
    this.repeats.floor = this.defaultRepeatFor(t);
    this.loadTileImage(t, (img) => (this.tileImgs.floor = img));
  }

  @Input() set wallTile(t: TileRecord | null) {
    this._wallTile = t;
    this.repeats.wall = this.defaultRepeatFor(t);
    this.loadTileImage(t, (img) => (this.tileImgs.wall = img));
  }

  /** One repeat-count per surface (drives both axes) — floor and wall are scaled independently. */
  readonly repeats: Record<Surface, number> = { floor: BASELINE_REPEAT, wall: BASELINE_REPEAT };
  brightness = 1.5;

  readonly detecting = signal(false);
  readonly detectionFailed = signal(false);
  readonly showHandles = signal(false);

  private _photo: HTMLImageElement | null = null;
  private _floorTile: TileRecord | null = null;
  private _wallTile: TileRecord | null = null;

  private readonly tileImgs: Record<Surface, HTMLImageElement | null> = { floor: null, wall: null };
  private readonly masks: Record<Surface, HTMLCanvasElement | null> = { floor: null, wall: null };
  readonly surfaceFound: Record<Surface, boolean> = { floor: false, wall: false };

  private quads: Record<Surface, Quad> = {
    floor: this.blankQuad(),
    wall: this.blankQuad(),
  };

  private dragTarget:
    | { kind: 'corner'; surface: Surface; index: number }
    | { kind: 'move'; surface: Surface; start: Point; original: Quad }
    | null = null;
  private detectionToken = 0;
  private renderScheduled = false;

  constructor(
    private readonly warp: FloorWarpService,
    private readonly tileService: TileService,
    private readonly segmentation: FloorSegmentationService
  ) {}

  ngAfterViewInit(): void {
    this.scheduleRender();
  }

  /** Smaller tiles default to a denser repeat so switching, say, 30x30cm -> 120x60cm looks sane
   *  by default without the user needing to immediately reach for the slider. */
  private defaultRepeatFor(t: TileRecord | null): number {
    const size = parseTileSizeCm(t?.size);
    if (!size) return BASELINE_REPEAT;
    const avgCm = (size.w + size.h) / 2;
    const repeat = Math.round((BASELINE_REPEAT * BASELINE_TILE_CM) / avgCm);
    return Math.max(2, Math.min(20, repeat));
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

  private async runDetection(img: HTMLImageElement): Promise<void> {
    const token = ++this.detectionToken;
    this.detecting.set(true);
    this.detectionFailed.set(false);
    try {
      const result = await this.segmentation.detectRoom(img);
      if (token !== this.detectionToken) return; // a newer photo arrived meanwhile

      if (result.floor) {
        this.masks.floor = result.floor.maskCanvas;
        this.quads.floor = result.floor.quad;
        this.surfaceFound.floor = true;
      } else {
        this.surfaceFound.floor = false;
      }

      if (result.wall) {
        this.masks.wall = result.wall.maskCanvas;
        this.quads.wall = result.wall.quad;
        this.surfaceFound.wall = true;
      } else {
        this.surfaceFound.wall = false;
      }

      if (!result.floor && !result.wall) {
        this.detectionFailed.set(true);
        this.showHandles.set(true);
      }
    } catch {
      if (token !== this.detectionToken) return;
      this.masks.floor = null;
      this.masks.wall = null;
      this.surfaceFound.floor = false;
      this.surfaceFound.wall = false;
      this.detectionFailed.set(true);
      this.showHandles.set(true);
    } finally {
      if (token === this.detectionToken) this.detecting.set(false);
      this.scheduleRender();
    }
  }

  private blankQuad(): Quad {
    return [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ];
  }

  private defaultQuad(surface: Surface, img: HTMLImageElement): Quad {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    return surface === 'floor'
      ? [
          { x: w * 0.12, y: h * 0.55 },
          { x: w * 0.88, y: h * 0.55 },
          { x: w * 0.98, y: h * 0.97 },
          { x: w * 0.02, y: h * 0.97 },
        ]
      : [
          { x: w * 0.05, y: h * 0.03 },
          { x: w * 0.95, y: h * 0.03 },
          { x: w * 0.9, y: h * 0.5 },
          { x: w * 0.1, y: h * 0.5 },
        ];
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
    if (!canvas || !this._photo) return;

    if (canvas.width !== this._photo.naturalWidth || canvas.height !== this._photo.naturalHeight) {
      canvas.width = this._photo.naturalWidth;
      canvas.height = this._photo.naturalHeight;
    }

    let base: HTMLCanvasElement | HTMLImageElement = this._photo;
    let renderedAny = false;

    for (const surface of ['floor', 'wall'] as Surface[]) {
      const tileImg = this.tileImgs[surface];
      const mask = this.masks[surface];
      if (tileImg && mask) {
        const r = this.repeats[surface];
        this.warp.render(canvas, base, tileImg, this.quads[surface], r, r, this.brightness, mask);
        base = canvas;
        renderedAny = true;
      }
    }

    if (!renderedAny) {
      canvas.getContext('2d')!.drawImage(this._photo, 0, 0);
    }

    if (this.showHandles()) {
      const ctx = canvas.getContext('2d')!;
      if (this.tileImgs.floor || this.surfaceFound.floor) this.drawHandles(ctx, this.quads.floor, '#4f8cff');
      if (this.tileImgs.wall || this.surfaceFound.wall) this.drawHandles(ctx, this.quads.wall, '#ff9d4f');
    }
  }

  private drawHandles(ctx: CanvasRenderingContext2D, quad: Quad, color: string): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, ctx.canvas.width / 400);
    ctx.beginPath();
    ctx.moveTo(quad[0].x, quad[0].y);
    for (const p of quad.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.stroke();

    const r = Math.max(8, ctx.canvas.width / 60);
    for (const p of quad) {
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  onPointerDown(ev: PointerEvent): void {
    if (!this.showHandles()) return;
    const p = this.toCanvasPoint(ev);
    const r = Math.max(8, this.canvasRef.nativeElement.width / 60) * 1.8;
    const activeSurfaces = (['floor', 'wall'] as Surface[]).filter(
      (s) => this.tileImgs[s] || this.surfaceFound[s]
    );

    // 1) grabbing a corner handle reshapes just that corner
    let bestCorner: { surface: Surface; index: number } | null = null;
    let bestDist = Infinity;
    for (const surface of activeSurfaces) {
      this.quads[surface].forEach((q, i) => {
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < r && d < bestDist) {
          bestCorner = { surface, index: i };
          bestDist = d;
        }
      });
    }
    if (bestCorner) {
      const corner: { surface: Surface; index: number } = bestCorner;
      this.dragTarget = { kind: 'corner', surface: corner.surface, index: corner.index };
      this.capturePointer(ev);
      return;
    }

    // 2) grabbing anywhere inside the outline moves the whole selection
    for (const surface of activeSurfaces) {
      if (this.pointInQuad(p, this.quads[surface])) {
        this.dragTarget = { kind: 'move', surface, start: p, original: [...this.quads[surface]] as Quad };
        this.capturePointer(ev);
        return;
      }
    }
  }

  private capturePointer(ev: PointerEvent): void {
    try {
      (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
    } catch {
      // no active pointer session to capture (e.g. synthetic events in tests) — harmless;
      // without capture, fast drags that leave the canvas briefly just stop updating until
      // the pointer re-enters, rather than failing outright
    }
  }

  onPointerMove(ev: PointerEvent): void {
    if (!this.dragTarget) return;
    const p = this.toCanvasPoint(ev);
    if (this.dragTarget.kind === 'corner') {
      this.quads[this.dragTarget.surface][this.dragTarget.index] = p;
    } else {
      const { start, original, surface } = this.dragTarget;
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      this.quads[surface] = original.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })) as Quad;
    }
    this.scheduleRender();
  }

  private pointInQuad(p: Point, quad: Quad): boolean {
    let inside = false;
    for (let i = 0, j = quad.length - 1; i < quad.length; j = i++) {
      const xi = quad[i].x;
      const yi = quad[i].y;
      const xj = quad[j].x;
      const yj = quad[j].y;
      const intersects = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
      if (intersects) inside = !inside;
    }
    return inside;
  }

  @HostListener('window:pointerup')
  onPointerUp(): void {
    this.dragTarget = null;
  }

  private toCanvasPoint(ev: PointerEvent): Point {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (ev.clientX - rect.left) * scaleX,
      y: (ev.clientY - rect.top) * scaleY,
    };
  }

  onRepeatChange(): void {
    this.scheduleRender();
  }

  resetPoints(): void {
    if (!this._photo) return;
    this.quads.floor = this.defaultQuad('floor', this._photo);
    this.quads.wall = this.defaultQuad('wall', this._photo);
    this.scheduleRender();
  }

  toggleHandles(): void {
    this.showHandles.update((v) => !v);
    this.scheduleRender();
  }
}
