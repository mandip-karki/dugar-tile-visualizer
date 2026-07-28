import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TileRecord } from '../../models/tile.model';
import { TileService } from '../../services/tile.service';
import { FavoritesService } from '../../services/favorites.service';

@Component({
  selector: 'app-tile-picker',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './tile-picker.html',
  styleUrl: './tile-picker.scss',
})
export class TilePicker {
  private readonly _tiles = signal<TileRecord[]>([]);
  @Input() set tiles(value: TileRecord[]) {
    this._tiles.set(value ?? []);
  }

  @Input() selectedId: string | null = null;
  @Output() tileSelected = new EventEmitter<TileRecord>();

  readonly sizeFilter = signal<string>('ALL');
  readonly searchTerm = signal<string>('');

  readonly sizes = computed(() => {
    const set = new Set(this._tiles().map((t) => t.size));
    return ['ALL', ...Array.from(set).sort()];
  });

  readonly filteredTiles = computed(() => {
    const size = this.sizeFilter();
    const term = this.searchTerm().trim().toLowerCase();
    const favorites = this.favorites.favoriteIds();
    let list = this._tiles();
    if (size !== 'ALL') list = list.filter((t) => t.size === size);
    if (term) list = list.filter((t) => t.name.toLowerCase().includes(term));

    // favorites float to the top; stable otherwise
    return [...list].sort((a, b) => {
      const fa = favorites.has(a.id) ? 1 : 0;
      const fb = favorites.has(b.id) ? 1 : 0;
      return fb - fa;
    });
  });

  constructor(
    private readonly tileService: TileService,
    readonly favorites: FavoritesService
  ) {}

  imgUrl(path: string): string {
    return this.tileService.imageUrl(path);
  }

  select(tile: TileRecord): void {
    this.tileSelected.emit(tile);
  }

  toggleFavorite(tile: TileRecord, event: Event): void {
    event.stopPropagation();
    this.favorites.toggle(tile.id);
  }
}
