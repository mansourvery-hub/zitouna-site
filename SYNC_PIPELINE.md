# Demo ↔ App Sync Pipeline

The app repo (`/home/mohamed/Desktop/Github/Zitouna`) is the source of truth. This document records
which of its inputs reach the demo without a human in the loop, and which do not.

The app is **Android-only** (`platforms: [android]`, no `web/` target), and the app repo is
read-only from this site. So the demo cannot embed a runtime build of the app. Instead, the demo's
inputs are *generated* from the app repo at sync time — the only path that points the demo at the
app rather than a hand-copy of it.

## What syncs automatically

### `scripts/sync-design.js` (`--check` gate)

| Source | Target | Note |
|--------|--------|------|
| `lib/theme/zitouna_theme.dart` — `ZitounaTheme.light` / `.dark` | `src/demo-tokens.css` | Every colour + radius, extracted by field name. Fails loudly on a missing or translucent token. |
| `pubspec.yaml` + `lib/theme/zitouna_theme.dart` | (the version feed) | (The site already reads `VERSION`; the font paths are the real signal here.) |
| `assets/fonts/*.ttf` | `src/fonts/*.woff2` | Converted with `woff2_compress`, not copied — serving TTF bytes as `.woff2` would be rejected by the browser. |

### `scripts/sync-strings.js` (`--check` gate)

| Source | Target | Contents |
|--------|--------|----------|
| `lib/screens/parcel_detail_screen.dart` | `design/app-ui.json` → `src/app-ui.js` | The parcel tab list, in the app's order |
| `lib/data/models/enums.dart` — `RipenessGauge` | `design/app-ui.json` | Stage order → the demo's stage index mapping |
| `lib/l10n/app_en.arb` | `design/app-ui.json` + `src/app-ui.js` | Stage names, bucket names, and the demo's copy (Check Ripeness, Save Ripeness Check, Save Delivery, Extraction Rendement, tab labels, and the rest) |

`src/app-ui.js` is loaded synchronously (`<script src="/app-ui.js">` before `demo.js`) so the demo
paints the app's strings on the first render — no fetch, no flash of the wrong copy.

Because the generated files are **committed**, CI can run the app-parity spec without the app repo.
The `--check` gates, which need the app repo, are run locally before each commit.

## What does NOT sync, and why

| Piece | Why it is hand-written |
|-------|------------------------|
| The demo's widget structure (the parcel screen, the counter rows) | Flutter widget tree → HTML is a translation, not a copy. `demo.js` mirrors it. |
| The ripeness/rendement maths (`src/logic.js`) | Ported from the Dart in `lib/logic/`. The values (weights 0/2/4.5/7, thresholds 2.0/3.5/5.5, density 0.916, round-once) are *checked* by `tools/check-app-sync.py`, but the code itself is a translation. |
| The gauge geometry (`src/gauge.js`) | Ported from `lib/widgets/ripeness_arc_gauge.dart`. Values (340×176, 300×140, radii, stroke widths, marker radii) are *checked* by `tools/check-app-sync.py`. |
| The demo's layout CSS (`src/demo.css`) | Hand-written around the generated tokens. |

This is the split ChessSRS uses: **tokens, fonts and copy are generated; structure and logic are
translated by hand and pinned by tests.**

## The parity test

`tests/e2e/app-parity.spec.js` renders the real demo and compares it against the committed
`design/app-ui.json`:

- Every tab the demo shows matches the app's label, in the app's order.
- The demo does **not** render any tab in `KNOWN_GAPS` (currently `tabHarvest`, `tabYears`).
- Stage names and bucket labels come from the app's strings.
- The ripeness save button, mill save button, and computed-rendement label use the app's copy.
- The gauge marker and 2-decimal index behave as the app's logic requires.

`KNOWN_GAPS` is asserted to *stay* present in the manifest: if the app drops a gap (e.g. removes
the Harvest tab), the spec fails until the gap is either implemented or the excuse is revisited.

## Honesty on the page

The old hand-written "How this demo differs from the app" disclaimer has been removed from the
page. The differences it spelled out are now **enforced**, not described: the manifest's `KNOWN_GAPS`
(ported three of five tabs), and the Dart→JS translations pinned by `tools/check-app-sync.py`.
A disclaimer that describes drift is a snapshot of drift; the pipeline makes drift a failing build.

## Running the sync

```bash
# Regenerate the demo's inputs from the app repo
node scripts/sync-design.js
node scripts/sync-strings.js

# Fail if anything is stale (run before committing)
node scripts/sync-design.js --check
node scripts/sync-strings.js --check

# Cross-check the translated logic/geometry against the Dart
python3 tools/check-app-sync.py /home/mohamed/Desktop/Github/Zitouna
```

The app repo is checked out alongside this one at `/home/mohamed/Desktop/Github/Zitouna`. Override
with `ZITOUNA_APP_DIR=/path/to/Zitouna`.

## Adding a sync path

1. Extract it in `scripts/sync-design.js` (assets) or `scripts/sync-strings.js` (copy/structure).
2. Write the target through `put()` / the manifest writer, never a bare `writeFileSync`, so `--check`
   can see it.
3. Consume it in the demo from `window.ZITOUNA_UI`, the generated CSS, or the generated fonts — not
   from a literal in `demo.js`.
4. If the demo does not implement it yet, add it to `KNOWN_GAPS` in
   `tests/e2e/app-parity.spec.js` with a reason. Adding a gap is the point; silently keeping one is
   not.
5. Add a row to the tables above.
