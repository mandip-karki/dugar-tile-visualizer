import { Component, EventEmitter, OnDestroy, OnInit, Output, signal } from '@angular/core';
import { SavedGeneration } from '../../models/saved-generation.model';
import { GalleryService } from '../../services/gallery.service';

interface GalleryItem extends SavedGeneration {
  url: string;
}

@Component({
  selector: 'app-gallery-view',
  standalone: true,
  templateUrl: './gallery-view.html',
  styleUrl: './gallery-view.scss',
})
export class GalleryView implements OnInit, OnDestroy {
  @Output() select = new EventEmitter<SavedGeneration>();
  @Output() closed = new EventEmitter<void>();

  readonly items = signal<GalleryItem[]>([]);
  readonly loading = signal(true);

  constructor(private readonly gallery: GalleryService) {}

  async ngOnInit(): Promise<void> {
    const rows = await this.gallery.getAll();
    this.items.set(rows.map((r) => ({ ...r, url: URL.createObjectURL(r.imageBlob) })));
    this.loading.set(false);
  }

  ngOnDestroy(): void {
    for (const item of this.items()) {
      URL.revokeObjectURL(item.url);
    }
  }

  choose(item: GalleryItem): void {
    this.select.emit(item);
  }

  async remove(item: GalleryItem, event: Event): Promise<void> {
    event.stopPropagation();
    await this.gallery.delete(item.id);
    URL.revokeObjectURL(item.url);
    this.items.update((list) => list.filter((i) => i.id !== item.id));
  }

  close(): void {
    this.closed.emit();
  }
}
