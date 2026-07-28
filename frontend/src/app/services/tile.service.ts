import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { TileRecord } from '../models/tile.model';

@Injectable({ providedIn: 'root' })
export class TileService {
  private readonly http = inject(HttpClient);

  // fetched once and shared: both floor and wall pickers filter the same static dataset client-side
  private readonly allTiles$ = this.http.get<TileRecord[]>('tiles.json').pipe(shareReplay(1));

  getTiles(usage: 'floor' | 'wall' = 'floor'): Observable<TileRecord[]> {
    return this.allTiles$.pipe(map((tiles) => tiles.filter((t) => t.usage === usage)));
  }

  imageUrl(path: string): string {
    // relative (no leading slash) so it resolves against <base href> — required for
    // GitHub Pages project sites, which serve from a /repo-name/ subpath.
    return path;
  }
}
