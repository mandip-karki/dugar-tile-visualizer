export interface TileRecord {
  id: string;
  name: string;
  size: string;
  surface: string | null;
  category: string;
  usage: 'floor' | 'wall';
  sourcePage: number;
  nativeWidth: number;
  nativeHeight: number;
  fullImage: string;
  thumbImage: string;
  nameSource: 'text' | 'ocr';
}
