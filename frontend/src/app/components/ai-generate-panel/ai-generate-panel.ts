import { Component, Input, signal } from '@angular/core';
import { TileRecord } from '../../models/tile.model';
import { TileService } from '../../services/tile.service';
import { AiEditService } from '../../services/ai-edit.service';

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
    private readonly tileService: TileService
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
      this.result.set(current as HTMLImageElement);
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
