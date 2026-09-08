export interface SavedGeneration {
  id: string;
  imageBlob: Blob;
  floorTileId: string | null;
  floorTileName: string | null;
  wallTileId: string | null;
  wallTileName: string | null;
  createdAt: number;
}
