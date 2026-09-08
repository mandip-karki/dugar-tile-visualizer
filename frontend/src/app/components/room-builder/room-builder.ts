import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TileRecord } from '../../models/tile.model';
import { RoomGeometryService } from '../../services/room-geometry.service';
import { AiGeneratePanel } from '../ai-generate-panel/ai-generate-panel';

@Component({
  selector: 'app-room-builder',
  standalone: true,
  imports: [FormsModule, AiGeneratePanel],
  templateUrl: './room-builder.html',
  styleUrl: './room-builder.scss',
})
export class RoomBuilder implements OnInit {
  @Input() floorTile: TileRecord | null = null;
  @Input() wallTile: TileRecord | null = null;

  widthM = 4;
  depthM = 4;
  heightM = 2.7;

  baseImageUrl: string | null = null;
  private baseCanvas: HTMLCanvasElement | null = null;

  constructor(private readonly geometry: RoomGeometryService) {}

  ngOnInit(): void {
    this.generate();
  }

  get photo(): HTMLCanvasElement | null {
    return this.baseCanvas;
  }

  generate(): void {
    this.widthM = this.clampDim(this.widthM);
    this.depthM = this.clampDim(this.depthM);
    this.heightM = Math.max(2, Math.min(5, this.heightM || 2.7));

    const room = this.geometry.build(this.widthM, this.depthM, this.heightM);
    this.baseCanvas = room.baseImage;
    this.baseImageUrl = room.baseImage.toDataURL('image/png');
  }

  private clampDim(v: number): number {
    if (!v || isNaN(v)) return 4;
    return Math.max(1.5, Math.min(12, v));
  }
}
