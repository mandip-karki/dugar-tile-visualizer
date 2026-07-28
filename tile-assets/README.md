# Kajaria Ramesh Tile Catalogue — Extracted Assets

Extracted from `without bleed_Optimized Catalogue_REVISED_APR27 copy.pdf` (168 pages) on 2026-07-28.

## Contents

- `tiles.json` — 591 tile records (metadata + image paths)
- `images/full/*.webp` — native-resolution swatch crops (quality 90)
- `images/thumb/*.webp` — 300x300 max thumbnails for picker grids (quality 85)

## Record schema

```json
{
  "id": "arctic-mist-p12-97",
  "name": "Arctic Mist",
  "size": "60X120CM",
  "surface": "HD-Polished",
  "category": "Glazed Vitrified Tiles",
  "usage": "floor",
  "sourcePage": 12,
  "nativeWidth": 474,
  "nativeHeight": 243,
  "fullImage": "images/full/arctic-mist-p12-97.webp",
  "thumbImage": "images/thumb/arctic-mist-p12-97.webp",
  "nameSource": "text"
}
```

- `usage`: `"floor"` for Glazed Vitrified Tiles / Heavy Duty Vitrified Tiles, `"wall"` for Digital Wall
  Tiles (30x60cm and 30x45cm sections are wall tiles, not floor — filter these out of a floor picker).
- `nameSource`: `"text"` (521 tiles) read directly from the PDF's text layer, or `"ocr"` (70 tiles)
  recovered with Tesseract from pages where captions were outlined/vector text rather than real text.
  OCR results are lower-confidence — worth a manual skim.

## Known limitations

- **Source resolution is low** (~470x250px for 60x120cm designs, ~240x240px for 40x40cm) — that's the
  native resolution embedded in the print catalogue (~100dpi at print size). Fine for thumbnails; will
  look soft if used as a large tiled/repeated texture at full screen width. For production, ask Kajaria
  Ramesh for higher-res source files per design, or re-extract from a print-ready (not "optimized
  for web") version of the catalogue if one exists.
- **47 image fragments were skipped** (not added to tiles.json) — these are pieces of a few busy mosaic
  patterns (pages 85-88, "Arc Stone" series) that are built from many small tiled image objects in the
  PDF with only one caption for the whole design; the fragments have no caption of their own so they're
  correctly excluded rather than mis-labeled.
  - Also 4 stray out-of-page image references on page 87 (bogus coordinates, harmless artifacts of the PDF).
- **A handful of OCR names may be slightly off** (e.g. truncated at a crop edge) — see rows with
  `"nameSource": "ocr"` in `tiles.json` and spot-check against pages listed in `sourcePage`.
- Some designs show 2-3 "pattern variation" images under one caption (common for large-format
  no-repeat digital prints) — these become multiple tile records sharing the same `name` but different
  `id`; treat them as texture variants of one product, not separate products, if you want a single
  picker entry per design.
