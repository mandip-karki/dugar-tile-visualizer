import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'tile-favorites';

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  readonly favoriteIds = signal<Set<string>>(this.load());

  isFavorite(id: string): boolean {
    return this.favoriteIds().has(id);
  }

  toggle(id: string): void {
    const next = new Set(this.favoriteIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.favoriteIds.set(next);
    this.save(next);
  }

  private load(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  }

  private save(ids: Set<string>): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    } catch {
      // storage unavailable (private browsing etc.) — favorites just won't persist
    }
  }
}
