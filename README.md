# The Dugar Pvt. Ltd. — Tile & Wall Visualizer

Granite, tile & sanitaryware. Live at **https://mandip-karki.github.io/dugar-tile-visualizer/**
— works on desktop and mobile (HTTPS is required for camera access, which GitHub Pages provides).

## Structure

- `tile-assets/` — extraction output + docs: images + `tiles.json` (591 tiles from the Kajaria
  Ramesh catalogue). Source of truth for the catalogue; not deployed directly.
- `frontend/` — the entire deployed app. Angular, **fully static** — `frontend/public/tiles.json`
  and `frontend/public/images/` are a bundled copy of `tile-assets/`, so the site needs no backend
  or database to browse the catalogue. Camera/photo capture and a dimension-based room builder are
  client-side; turning a selection into a photorealistic image goes through the AI worker below.
- `backend/` — ASP.NET Core Web API (`TileFloorApi`). **Not currently used by the deployed site**
  — kept in the repo for future features that need a real server (accounts, saved rooms, order
  requests, etc.). Useful for local dev if you want to experiment with a server-backed `/api/tiles`
  instead of the static JSON, but the deployed app doesn't call it.
- `worker/` — a Cloudflare Worker that proxies AI image-generation requests to Gemini (see
  "AI-generated preview" below). This *is* used by the deployed site — it's the one server-side
  piece, needed only to keep the Gemini API key off the client.

## AI-generated preview (the only rendering path, costs money)

There's no local perspective-warp/segmentation rendering anymore — the only way to see a tile
applied is the "✨ Generate photorealistic version (AI)" button, available in both modes. It
sends the current photo (or, in Room Builder, the dimension-based mockup canvas) plus the
selected floor/wall tile(s) to Google's Gemini 2.5 Flash Image model and shows back a fully
AI-generated photorealistic edit. Both modes use the same shared `AiGeneratePanel` component
and chain floor-then-wall as two sequential edits when both are selected.

An earlier version of this app did the tile placement itself — DeepLab segmentation +
perspective-warping onto the detected/computed floor and wall shapes, entirely client-side and
free. That code (`FloorWarpService`, `FloorSegmentationService`, the TensorFlow.js/DeepLab
dependency) has been removed in favor of AI generation exclusively; it cut the JS bundle from
~965KB to ~226KB as a side effect. If you want that approach back, it's in git history before
this change.

- **Why a separate worker**: the Gemini API key can't live in the Angular app's client-side code
  (anyone could read it from the page source and rack up charges on your account). `worker/`
  is a small Cloudflare Worker that holds the key as a secret and proxies the request —
  deployed independently of the static site, at `https://dugar-ai-tile-proxy.dugarai.workers.dev`.
- **Cost**: Gemini image generation has **no free tier** — it's ~$0.039/image from the very
  first call once billing is enabled on the Google Cloud project backing the API key. There's
  no per-click confirmation in the UI beyond the note next to the button; be aware each click
  spends real money.
- **Redeploying the worker** (e.g. after editing `worker/src/index.ts`):
  ```bash
  cd worker
  npm install   # first time only
  npx wrangler deploy
  ```
  The `GEMINI_API_KEY` secret persists across deploys — only re-run
  `npx wrangler secret put GEMINI_API_KEY` if you need to rotate it.
- **CORS**: the worker only accepts requests from origins listed in `wrangler.toml`'s
  `ALLOWED_ORIGINS` (currently the GitHub Pages URL + `localhost:4200` for dev). Add any new
  origin there before it'll work from that host.
- If Google renames or deprecates the `gemini-2.5-flash-image` model id, that's the one line to
  update in `worker/src/index.ts`.

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

## How it works now

On opening the app you choose one of two modes, both ending at the same AI-generation step:

- **Use a photo** (`floor-editor` component) — capture or upload a photo (`camera-capture`),
  shown as-is with no client-side processing.
- **Build a room from dimensions** (`room-builder` component) — enter width/depth/wall-height
  in meters; `RoomGeometryService` draws a stylized room box (floor + back wall + two side
  walls, correct trapezoid perspective from your numbers) as a plain, untiled mockup image.

In either mode, pick a **floor** tile and/or a **wall** tile from the sidebar's Floor/Wall tab
switcher — each tab filters the bundled `tiles.json` client-side by `usage`, with its own
search box, size filter, and favorites (★, persisted in `localStorage`, shared across both
tabs). Both modes share the same tile-picker selections, so switching modes keeps your choice.

Then click "✨ Generate photorealistic version (AI)" (`AiGeneratePanel`, shared by both modes):
it sends the photo/mockup plus the selected tile(s) to the Gemini worker (chaining floor then
wall as two calls if both are picked) and shows the result in a modal. See "AI-generated
preview" above for the cost and architecture details.

## Known gaps / next steps

- Tile source images are print-resolution (~100dpi) — fine for now, see `tile-assets/README.md`.
- No accounts, saved rooms, or persistence beyond favorites — this is the MVP visualizer only.
- Every generation is a real, billed API call with no caching — regenerating the same
  photo+tile combination costs again. Worth adding a client-side cache keyed on
  photo+tile+surface if this gets used a lot.
- Gemini's edit isn't guaranteed to preserve every detail of the input photo exactly (see the
  caveat in the AI-generated preview section above) — worth spot-checking results against
  real room photos before relying on them for a customer-facing sales conversation.
