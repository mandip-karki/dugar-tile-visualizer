import { TileRecord } from '../models/tile.model';

/** Draws `img` onto a canvas with a small floor/wall tile label in the bottom-right
 *  corner — a snug, semi-transparent box sized to just fit the text, not a full bar. */
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

  const fontSize = Math.max(11, Math.round(canvas.width * 0.011));
  const padding = fontSize * 0.7;
  const lineHeight = fontSize * 1.35;
  const margin = fontSize;

  ctx.font = `600 ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
  const textWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));

  const boxWidth = textWidth + padding * 2;
  const boxHeight = lineHeight * lines.length + padding * 2;
  const boxX = canvas.width - margin - boxWidth;
  const boxY = canvas.height - margin - boxHeight;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => {
    ctx.fillText(line, boxX + padding, boxY + padding + i * lineHeight);
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
