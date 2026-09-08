import { TileRecord } from '../models/tile.model';

/** Draws `img` onto a canvas with a floor/wall tile label burned into the bottom edge. */
export function buildLabeledCanvas(
  img: HTMLImageElement,
  floorTile: TileRecord | null,
  wallTile: TileRecord | null
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const lines: string[] = [];
  if (floorTile) lines.push(`Floor: ${floorTile.name} (${floorTile.size})`);
  if (wallTile) lines.push(`Wall: ${wallTile.name} (${wallTile.size})`);
  if (lines.length === 0) return canvas;

  const fontSize = Math.max(16, Math.round(canvas.width * 0.018));
  const padding = fontSize * 0.6;
  const lineHeight = fontSize * 1.4;
  const barHeight = padding * 2 + lineHeight * lines.length;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

  ctx.font = `600 ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => {
    ctx.fillText(line, padding, canvas.height - barHeight + padding + i * lineHeight);
  });

  return canvas;
}

export function canvasToImage(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load labeled image'));
    img.src = canvas.toDataURL('image/png');
  });
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to encode image'));
    }, 'image/png');
  });
}
