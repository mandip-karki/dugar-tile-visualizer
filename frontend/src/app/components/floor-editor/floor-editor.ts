import { Component, Input } from '@angular/core';
import { TileRecord } from '../../models/tile.model';
import { AiGeneratePanel } from '../ai-generate-panel/ai-generate-panel';

@Component({
  selector: 'app-floor-editor',
  standalone: true,
  imports: [AiGeneratePanel],
  templateUrl: './floor-editor.html',
  styleUrl: './floor-editor.scss',
})
export class FloorEditor {
  @Input() photo: HTMLImageElement | null = null;
  @Input() floorTile: TileRecord | null = null;
  @Input() wallTile: TileRecord | null = null;
}
