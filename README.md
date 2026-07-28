# The Dugar Pvt. Ltd. — Tile & Wall Visualizer

Granite, tile & sanitaryware. Live at **https://mandip-karki.github.io/dugar-tile-visualizer/**
— works on desktop and mobile (HTTPS is required for camera access, which GitHub Pages provides).

## Structure

- `tile-assets/` — extraction output + docs: images + `tiles.json` (591 tiles from the Kajaria
  Ramesh catalogue). Source of truth for the catalogue; not deployed directly.
- `frontend/` — the entire deployed app. Angular, **fully static** — `frontend/public/tiles.json`
  and `frontend/public/images/` are a bundled copy of `tile-assets/`, so the site needs no backend
  or database to run. Camera/photo capture, in-browser DeepLab segmentation, dimension-based room
  builder, perspective tile warping — all client-side.
- `backend/` — ASP.NET Core Web API (`TileFloorApi`). **Not currently used by the deployed site**
  — kept in the repo for future features that need a real server (accounts, saved rooms, order
  requests, etc.). Useful for local dev if you want to experiment with a server-backed `/api/tiles`
  instead of the static JSON, but the deployed app doesn't call it.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`: builds the Angular app
(`ng build --configuration production --base-href /dugar-tile-visualizer/`) and publishes
`frontend/dist/frontend/browser` to GitHub Pages. No servers to keep running, no cost, no
cold-start delay — it's plain static hosting on GitHub's CDN.

To deploy a change: commit, `git push`, then check progress at
`https://github.com/mandip-karki/dugar-tile-visualizer/actions` (usually done in under a minute).

If the repo name or GitHub username ever changes, update `--base-href` in `deploy.yml` to match
(it must equal the Pages URL's path segment, e.g. `/dugar-tile-visualizer/`).

## Running it locally

```bash
cd frontend
npm install   # first time only
npm start
```

Open **http://localhost:4200** — no backend needed, it's the same static setup as production.

If you want to experiment with the optional ASP.NET backend instead of the static JSON, `cd
backend && dotnet run`, then point `TileService` at `/api/tiles` and re-add a dev proxy — it's
disconnected from the frontend by default (see `frontend/src/app/services/tile.service.ts`).

## How the floor-swap works

On opening the app you choose one of two modes:

- **Use a photo** — the flow below.
- **Build a room from dimensions** (`room-builder` component) — enter width/depth/wall-height
  in meters, no photo needed. `RoomGeometryService` generates a stylized room box (floor +
  back wall + two side walls) with the correct trapezoid perspective computed directly from
  your numbers — no ML detection needed here since the geometry is exact by construction, not
  estimated. The same `FloorWarpService` used for photos then warps floor/wall tiles onto
  all 4 surfaces (wall tile applies to all three visible walls at once).

Both modes share the same floor/wall tile pickers and selections, so switching between them
keeps your chosen tiles.

### Tile scale consistency

Floor and wall tiles are scaled **independently**, not with one shared repeat-count:
- **Room Builder** knows your room's real dimensions, so it parses each tile's actual size
  (e.g. "60X120CM") and computes exactly how many repeats fit across each surface's true
  span (`repeatsFor()` in `room-builder.ts`) — floor, back wall, and the two side walls each
  get their own physically-correct count. A "Tile scale" slider is just a fudge factor on
  top of that, not the primary control.
- **Photo mode** has no real-world calibration (an arbitrary photo has no known scale), so it
  can't be exact — but floor and wall now have independent "tile scale" sliders instead of a
  single shared one, and switching tiles picks a sensible default sized relative to that
  tile's real dimensions (a 40x40cm tile defaults denser than a 120x60cm one).

### Photo mode

1. Capture or upload a photo (`camera-capture` component).
2. Pick a **floor** tile and/or a **wall** tile from the catalogue — the sidebar has a
   Floor/Wall tab switcher, each filtering the bundled `tiles.json` client-side by `usage`,
   with its own search box, size filter, and favorites (★, persisted in `localStorage`,
   shared across both tabs, floats favorited tiles to the top of the list).
3. `floor-editor` automatically detects both regions from a **single** segmentation pass —
   no manual outlining needed:
   - `FloorSegmentationService` runs TensorFlow.js's DeepLab semantic segmentation model
     (ADE20K, 150 classes) entirely in-browser to classify every pixel. It isolates the
     `floor` class and the `wall` class separately and builds one mask per surface; rugs,
     furniture, doors, windows etc. all land in *other* classes (`rug`, `sofa`, `door`,
     `windowpane`, ...) and are automatically excluded from both.
   - A perspective quad is estimated from each mask's extent (for realistic tile scaling
     toward the back of the room) — see "Manual override" below if you want to nudge either one.
4. `FloorWarpService` perspective-warps each selected tile texture across its quad (a
   triangle-mesh projective transform — Heckbert's square-to-quad mapping, subdivided into an
   N×M grid of repeating tiles), relights it by multiplying against the original photo's
   grayscale luminance (so shadows/highlights carry through), then punches the result out
   against that surface's segmentation mask so rugs/furniture/doors show the *original*
   photo, not tiled-over. Floor and wall are rendered as two passes onto the same canvas, so
   **both can be applied at once** — pick a floor tile, a wall tile, or both.

No WebXR, no native app — pure Canvas2D + TensorFlow.js in the browser. This is the
"photo-based swap" approach discussed in the plan; live AR plane-tracking would be a
native/v3 step.

### Manual override

If auto-detection gets it wrong (unusual room shape, bad lighting, no floor/wall recognized),
click "Adjust corners manually" to drag the handles yourself (blue = floor, orange = wall) —
same mechanism as v1, just no longer the default. The status line under the photo shows
whether floor/wall were actually found.

### What this adds to "what gets downloaded"

- `@tensorflow/tfjs-core`, `@tensorflow/tfjs-converter`, `@tensorflow/tfjs-backend-webgl`,
  `@tensorflow-models/deeplab` — installed as normal npm packages (already done).
- At **runtime**, the first time a user opens the app, their **browser** downloads the
  DeepLab ADE20K model weights (~8-10MB, quantized) from Google's TF-Hub CDN — takes a few
  seconds on first load, then it's cached in memory for the rest of the session (browser
  HTTP cache helps across sessions too). Needs internet access; there's no offline fallback
  currently — if the fetch fails, the app falls back to manual corner-dragging.

## Known gaps / next steps

- Tile source images are print-resolution (~100dpi) — fine for now, see `tile-assets/README.md`.
- No accounts, saved rooms, or persistence beyond favorites — this is the MVP visualizer only.
- The auto-estimated quad is a simple trapezoid from the mask's bounding extent — works well
  for a single flat floor plane, less so for L-shaped rooms or multiple floor areas in one
  shot (the mask-based punch-out still avoids obstacles correctly either way, it's just the
  perspective grid that may look slightly off in those cases).
