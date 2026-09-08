import { Component, OnInit, signal } from '@angular/core';
import { CameraCapture } from './components/camera-capture/camera-capture';
import { TilePicker } from './components/tile-picker/tile-picker';
import { FloorEditor } from './components/floor-editor/floor-editor';
import { RoomBuilder } from './components/room-builder/room-builder';
import { Logo } from './components/logo/logo';
import { GalleryView } from './components/gallery-view/gallery-view';
import { TileService } from './services/tile.service';
import { TileRecord } from './models/tile.model';
import { SavedGeneration } from './models/saved-generation.model';

type PickerTab = 'floor' | 'wall';
type ViewMode = 'landing' | 'photo' | 'room';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CameraCapture, TilePicker, FloorEditor, RoomBuilder, Logo, GalleryView],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  readonly floorTiles = signal<TileRecord[]>([]);
  readonly wallTiles = signal<TileRecord[]>([]);
  readonly photo = signal<HTMLImageElement | null>(null);
  readonly selectedFloorTile = signal<TileRecord | null>(null);
  readonly selectedWallTile = signal<TileRecord | null>(null);
  readonly activeTab = signal<PickerTab>('floor');
  readonly mode = signal<ViewMode>('landing');

  readonly showGallery = signal(false);
  readonly viewingImageUrl = signal<string | null>(null);

  constructor(private readonly tileService: TileService) {}

  ngOnInit(): void {
    this.tileService.getTiles('floor').subscribe((tiles) => this.floorTiles.set(tiles));
    this.tileService.getTiles('wall').subscribe((tiles) => this.wallTiles.set(tiles));
  }

  onPhotoCaptured(img: HTMLImageElement): void {
    this.photo.set(img);
  }

  onTileSelected(tile: TileRecord): void {
    if (this.activeTab() === 'floor') {
      this.selectedFloorTile.set(tile);
    } else {
      this.selectedWallTile.set(tile);
    }
  }

  startPhotoMode(): void {
    this.mode.set('photo');
  }

  startRoomMode(): void {
    this.mode.set('room');
  }

  backToStart(): void {
    this.mode.set('landing');
    this.photo.set(null);
  }

  retake(): void {
    this.photo.set(null);
  }

  openGallery(): void {
    this.showGallery.set(true);
  }

  onGalleryClosed(): void {
    this.showGallery.set(false);
  }

  onGallerySelected(entry: SavedGeneration): void {
    const floor = entry.floorTileId ? this.floorTiles().find((t) => t.id === entry.floorTileId) ?? null : null;
    const wall = entry.wallTileId ? this.wallTiles().find((t) => t.id === entry.wallTileId) ?? null : null;
    this.selectedFloorTile.set(floor);
    this.selectedWallTile.set(wall);

    this.releaseViewingUrl();
    this.viewingImageUrl.set(URL.createObjectURL(entry.imageBlob));
    this.showGallery.set(false);
  }

  closeImageViewer(): void {
    this.releaseViewingUrl();
  }

  private releaseViewingUrl(): void {
    const current = this.viewingImageUrl();
    if (current) URL.revokeObjectURL(current);
    this.viewingImageUrl.set(null);
  }
}
