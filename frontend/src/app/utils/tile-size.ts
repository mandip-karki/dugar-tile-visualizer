/** Parses a tile record's "60X120CM" size string into physical centimeters. */
export function parseTileSizeCm(size: string | null | undefined): { w: number; h: number } | null {
  if (!size) return null;
  const m = size.match(/^([\d.]+)X([\d.]+)CM$/i);
  if (!m) return null;
  return { w: parseFloat(m[1]), h: parseFloat(m[2]) };
}
