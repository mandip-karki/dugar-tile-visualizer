import { Component, Input, signal } from '@angular/core';
import { TileRecord } from '../../models/tile.model';
import { TileService } from '../../services/tile.service';
import { AiEditService } from '../../services/ai-edit.service';
import { GalleryService } from '../../services/gallery.service';
import { buildLabeledCanvas, canvasToBlob, canvasToImage } from '../../utils/image-label';

@Component({
  selector: 'app-ai-generate-panel',
  standalone: true,
  templateUrl: './ai-generate-panel.html',
  styleUrl: './ai-generate-panel.scss',
})
export class AiGeneratePanel {
  @Input() photo: HTMLImageElement | HTMLCanvasElement | null = null;
  @Input() floorTile: TileRecord | null = null;
  @Input() wallTile: TileRecord | null = null;

  readonly busy = signal(false);
  readonly stage = signal('');
  readonly error = signal<string | null>(null);
  readonly result = signal<HTMLImageElement | null>(null);

  constructor(
    private readonly aiEdit: AiEditService,
    private readonly tileService: TileService,
    private readonly gallery: GalleryService
  ) {}

  get canGenerate(): boolean {
    return !!this.photo && (!!this.floorTile || !!this.wallTile);
  }

  async generate(): Promise<void> {
    if (!this.photo || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.result.set(null);

    let current: HTMLImageElement | HTMLCanvasElement = this.photo;
    try {
      if (this.floorTile) {
        this.stage.set('Generating floor…');
        const tileImg = await this.loadTileImage(this.floorTile);
        current = await this.aiEdit.edit({
          photo: current,
          tileImg,
          surface: 'floor',
          tileName: this.floorTile.name,
        });
      }
      if (this.wallTile) {
        this.stage.set('Generating wall…');
        const tileImg = await this.loadTileImage(this.wallTile);
        current = await this.aiEdit.edit({
          photo: current,
          tileImg,
          surface: 'wall',
          tileName: this.wallTile.name,
        });
      }

      this.stage.set('Labeling…');
      const labeledCanvas = buildLabeledCanvas(current as HTMLImageElement, this.floorTile, this.wallTile);
      const [labeledImg, blob] = await Promise.all([canvasToImage(labeledCanvas), canvasToBlob(labeledCanvas)]);
      this.result.set(labeledImg);

      await this.gallery.save({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        imageBlob: blob,
        floorTileId: this.floorTile?.id ?? null,
        floorTileName: this.floorTile?.name ?? null,
        wallTileId: this.wallTile?.id ?? null,
        wallTileName: this.wallTile?.name ?? null,
        createdAt: Date.now(),
      });
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'AI generation failed');
    } finally {
      this.busy.set(false);
      this.stage.set('');
    }
  }

  dismiss(): void {
    this.result.set(null);
    this.error.set(null);
  }

  private loadTileImage(t: TileRecord): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load tile image for ${t.name}`));
      img.src = this.tileService.imageUrl(t.fullImage);
    });
  }
}
