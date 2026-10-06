# SUPERSEDED — kept for its measurements, not its conclusions

> **Do not follow this document as instructions.** The problem it describes is
> solved: `tools/build-demo.sh` builds the app, captures its screens, and vendors
> it; `.github/workflows/deploy-pages.yml` runs that in CI against the app repo.
>
> What is still worth reading is §2 and §3 — the measured sizes. They justify
> current decisions, and re-deriving them costs an hour.
>
> **One conclusion here was wrong and was corrected in place:** §3's original
> "Finding 1" claimed the engine was loading a needlessly large CanvasKit variant.
> It had compared a raw byte count against a gzipped one. Measured both ways, the
> variant the engine picks is smaller on *both* axes, and the default is correct.
> If you find another "obvious" saving in this file, measure it twice.

# Handoff: import the real Flutter app as a faithful, fast web demo

**For:** a research/engineering agent
**Written:**2026-10-05
**Repos:**
- Site: `/home/mohamed/Desktop/Github/Zitouna-website/zitouna-source` → `mansourvery-hub/zitouna-site`, live at `https://mansourvery-hub.github.io/zitouna-site/`
- App: `/home/mohamed/Desktop/Github/Zitouna` → branch **`web-target-experiment`** (two commits ahead of `main`; `main` and all Android code are untouched)

---

## 1. Why this task exists

The marketing site has an interactive demo section. The user's requirement, stated repeatedly:

> "it should run natively, look at the chess website... it is very primitive and does not look exactly like the app — needs polishing"

**The demo must be the real Flutter app, rendered by Flutter.** Not an HTML re-implementation.

### The two approaches already tried — read this before proposing a third

**Approach A — the real Flutter build in an iframe. (Worked; rejected on performance.)**
The full app compiled with `flutter build web`, vendored into the site at `src/flutter-demo/`, framed by an `<iframe>`. All 9 screens verified in a real browser, zero console errors. Technically faithful — it *is* the app.

It was rejected because first load is ~5MB and ~60 seconds on fast-3G. Adding a spinner + timeout + retry loader did not fix the underlying weight, and the user saw a "Loading the interactive demo…" state that they explicitly called out as unacceptable. **Do not re-ship this as-is without solving the weight.**

**Approach B — native HTML/CSS/JS re-implementation. (Shipped; rejected on fidelity.)**
~150KB, instant, all views navigable, tests green. But it is a *translation* of the app, not the app. The user has now rejected it as "still trash" — it does not look like the app. Several rounds of pixel-matching (theme tokens, gradient parcel cards, app-bars, stage pills, gauge geometry) closed individual gaps and still did not produce the real thing. **Each fix was whack-a-mole because every divergence is a hand-maintained reimplementation.**

**The lesson, which is the core of this task:** fidelity by translation is unbounded work. Fidelity by *running the actual app* is free. So the answer is Approach A plus a real weight reduction — not Approach B continued.

---

## 2. Measured baseline (do not trust estimates; these are real numbers)

Flutter 3.47.4 stable, Dart 3.13.3. Existing build: `build/web` in the app repo, produced by

```
flutter build web --target=lib/main_web_demo.dart --release --no-web-resources-cdn
```

Measured in headless Chromium against `python3 -m http.server`, **uncompressed on the wire** (no gzip — this is the worst case):

| Item | Bytes | Notes |
|---|---|---|
| `canvaskit/chromium/canvaskit.wasm` | **5.18 MB** | ⚠️ see §3 — this is the *wrong variant* |
| `main.dart.js` | **3.67 MB** | 1.1 MB gzipped |
| ZillaSlab TTFs ×4 weights | ~1.04 MB | 0.26 MB each, all four fetched |
| `assets/assets/textures/grain.png` | 221 KB | |
| fallback Roboto | 168 KB | |
| Manrope ×4 weights | ~560 KB | |
| **total, 25 requests** | **11.99 MB** | first frame 2063 ms on localhost |

Gzipped (real-world broadband): `main.dart.js` 1.1 MB, `chromium/canvaskit.wasm` 2.0 MB, `canvaskit.wasm` 2.8 MB, `skwasm.wasm` 1.5 MB, `skwasm_heavy.wasm` 2.2 MB, `wimp.wasm` 1.4 MB.

Note `build/web/canvaskit/` is 37MB on disk but only **one** variant is fetched at runtime. Do not treat the disk size as the download.

### Confirmed: the no-third-party-requests promise currently holds

The site footer promises "This site sets no cookies, uses no analytics and loads nothing from other websites." This was verified with a request interceptor against the running Flutter build:

```
third-party requests: NONE
```

This matters because two deps look risky:
- `google_fonts` — `fonts.gstatic.com` is referenced in `main.dart.js`, but `ZillaSlab`/`Manrope` are **bundled as local TTF** under `assets/assets/fonts/`. Nothing is fetched from Google at runtime. Keep it bundled; do not "fix" it by switching to the CDN.
- `flutter_map` — `tiles.openfreemap.org` appears in the binary but no tile request fires (the map is never opened on the demo path).

**Any solution must keep zero third-party requests.** `--no-web-resources-cdn` is mandatory (otherwise CanvasKit comes from gstatic).

---

## 3. The three findings that matter most

### Finding 1 — CORRECTED. The renderer choice is already optimal; do not "fix" it

An earlier draft of this document claimed the engine was "loading the wrong CanvasKit variant" (the 5.2 MB `chromium/canvaskit.wasm`) and that pinning the full `canvaskit.wasm` would save weight. **That was wrong — it compared a raw byte count against a gzipped byte count.** Measured both ways:

| Variant | Raw | gzip -9 |
|---|---|---|
| **`chromium/canvaskit.wasm` (currently fetched)** | **5.2 MB** | **2.0 MB** |
| `canvaskit.wasm` | 7.0 MB | 2.8 MB |
| `webparagraph/canvaskit.wasm` | 3.6 MB | 1.4 MB |
| `skwasm.wasm` | 3.5 MB | 1.5 MB |
| `skwasm_heavy.wasm` | 5.0 MB | 2.2 MB |
| `wimp.wasm` | 3.5 MB | 1.4 MB |

The chromium variant is smaller **both raw and gzipped**. The engine's sniffing is already picking a good build. Forcing `canvaskit.wasm` would make the download *bigger*. **Leave the default renderer selection alone.**

This also kills a tempting-sounding optimisation: several variants (webparagraph, skwasm, wimp) are smaller on disk, but switching renderers is a fidelity risk, not free savings. Only pursue it as a measured experiment — see §7.

### Finding 2 — four unused font weights are fetched eagerly

All four ZillaSlab weights (400/500/600/700) and all four Manrope weights ship as raw TTF and get fetched even if a screen uses one or two. Options to investigate: font subsetting to the glyphs actually used, converting to WOFF2, `FontManifest` trimming, or lazily loading weights. `google_fonts` is in the dependency list and `lib/theme/zitouna_theme.dart` calls `GoogleFonts.*` 19 times — check how these resolve on web before changing anything.

### Finding 3 — assets that may not need shipping at all

- `assets/NOTICES` is **1.4 MB** of license text, shipped to every visitor, never displayed. Almost certainly strippable from the deployed output.
- `assets/assets/textures/grain.png` is 221 KB.
- `assets/fonts/fallback/Roboto-Regular.ttf` (168 KB) — engine fallback font, only needed if a glyph is missing from the real fonts. With full Arabic + French coverage bundled it may be dead weight; verify whether any glyph actually falls back before removing.

`flutter build web --analyze-size` is not available in 3.47.4 — measure with a request interceptor instead (see §6).

---

## 4. Hard constraints — these are non-negotiable

1. **No third-party requests, ever.** No CDN, no Google Fonts, no analytics, no tile servers. `--no-web-resources-cdn`.
2. **The site must load instantly and independently of the demo.** The demo must never block or delay first paint of the marketing page. The iframe-on-demand / lazy pattern is the right architecture — keep it.
3. **Do not break the marketing page.** It is a static, no-framework site with a strict CSP, Playwright visual regression tests, and its own sync gates. `sh check.sh` must stay green.
4. **Never modify git history.** No `git filter-repo`, no force-push, no history rewrite. Plain commits and merges only.
5. **Do not touch `main` or the Android code paths in the app repo.** All Flutter-web work stays on `web-target-experiment`.
6. **Do not melt the user's machine.** No full/wide test suites locally — no `flutter test` over the whole repo, no full Playwright matrix, no multi-worker runs. Scope every test run to specific paths. This is an absolute rule, learned the hard way on this project.
7. **No placeholder text, no personal info** (no real names, emails, or phone numbers) in anything shipped.

---

## 5. What already exists and should be reused, not rewritten

The web-target work is **done and verified**. Do not redo it.

`lib/main_web_demo.dart` (45 lines) boots the real `ZitounaApp` and overrides only persistence:

```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  runApp(ProviderScope(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      parcelRepositoryProvider.overrideWithValue(MemoryParcelRepository(DemoSeed.parcel())),
      ripenessCheckRepositoryProvider.overrideWithValue(MemoryRipenessCheckRepository(DemoSeed.ripenessChecks())),
      harvestLogRepositoryProvider.overrideWithValue(MemoryHarvestLogRepository(DemoSeed.harvestLogs())),
      millLogRepositoryProvider.overrideWithValue(MemoryMillLogRepository(DemoSeed.millLogs())),
    ],
    child: const ZitounaApp(),
  ));
}
```

Because it mounts the real widget tree, **every screen renders with production code**: real `RipenessArcGauge`, real `StagePill`, real `ZitounaTheme`, real `RipenessCalculator`/`RendementCalculator`/`PrePressEstimateCalculator`/`AlternateBearingCalculator`. Navigation, all 5 parcel tabs, years, forecasts, settings all work.

Supporting pieces already in place:
- `lib/demo/memory_repositories.dart` (456 lines) — in-memory fakes for the 4 Drift repos, seeded with 2 seasons via `DemoSeed`
- Conditional imports to keep `dart:io` / `dart:ffi` out of the web compile graph:
  - `lib/data/database/connection.dart` + `connection_native.dart` + `connection_web.dart`
  - `lib/repositories/backup_file_io*.dart`
  - `lib/services/apk_file_io*.dart`
- Deliberately unavailable (friendly failure messages, not crashes): backup export/import, APK sharing, satellite map tiles, persistence.

State at cutoff: `flutter analyze` clean, all 351 app tests pass.

### Site-side integration (from the reverted commit `4c1e660` / `8537034` — recoverable from git history, do not rewrite from scratch)

- `src/index.html` — `<iframe class="fdemo" src="/flutter-demo/">` inside `<div id="demo">`, plus a loading overlay
- `src/main.js` — polls for a painted canvas, then hides the loader
- `src/styles.css` — `.fdemo*` rules
- `build.py` — ships `src/flutter-demo`, rewrites Flutter's `<base href>` per deploy target, and writes `_headers` with **per-path CSP**:
  - top page: `frame-ancestors 'none'`
  - `/flutter-demo/*`: `frame-ancestors 'self'`, `script-src 'self' 'wasm-unsafe-eval'`, `style-src 'self' 'unsafe-inline'`, `connect-src 'self'`, `base-uri 'self'`

`tools/serve.py` applies `_headers` locally on **port 8082** (8080/8081 are taken by other services).

**CSP note:** GitHub Pages cannot send custom headers, so live runs skip the CSP assertions (2 tests × 2 projects). `wasm-unsafe-eval` is required for CanvasKit WASM compilation and cannot be dropped.

---

## 6. How to measure (the only trustworthy method here)

`flutter build web --analyze-size` does not exist in 3.47.4. Measure the real critical path instead. Pattern that produced the numbers in §2:

```js
import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const reqs = [];
p.on('response', async (r) => reqs.push({
  url: r.url().replace('http://127.0.0.1:8099/', ''),
  size: (await r.body()).length,
  type: r.headers()['content-type'] || '',
}));
const t0 = Date.now();
await p.goto('http://127.0.0.1:8099/', { waitUntil: 'load' });
await p.waitForSelector('flt-glass-pane, canvas, flutter-view', { timeout: 60000 });
console.log('first frame:', Date.now() - t0, 'ms');
console.log('total MB:', (reqs.reduce((s, r) => s + r.size, 0) / 1048576).toFixed(2));
for (const r of reqs.sort((a, b) => b.size - a.size).slice(0, 12)) console.log(r.size, r.url);
```

Always also run a **third-party request assertion** in the same harness (see §2) — it is the only way to keep constraint 1 honest.

Report both raw and gzipped, and state which renderer variant was actually fetched. A "size win" that silently switches renderer is a regression, not a win.

---

## 7. Suggested research directions (not a mandate — validate, then decide)

Ordered by expected payoff:

1. **Pin the renderer/CanvasKit variant.** Potentially −3 MB raw / −1 MB gz with zero code change. Confirm the app's text shaping and SVG rendering are unaffected.
2. **Strip `NOTICES` (1.4 MB) from the deploy.** Verify nothing reads it at runtime.
3. **Font strategy.** Subset to used glyphs, WOFF2, or trim unused weights. The app ships English + French + Arabic — confirm the bundle covers all three before trimming anything.
4. **Verify whether the fallback Roboto is ever reached.** If not, drop it.
5. **Re-measure `--wasm` properly.** It was previously rejected, but possibly measured against the chromium-variant baseline. SkWasm is 1.5 MB vs 2.8 MB CanvasKit. The blocker to check is Arabic text shaping.
6. **Consider a genuinely progressive load.** The marketing page is static and fast; the demo frame could load on intent (visible, or user-initiated) rather than on page load. Combined with the service worker, repeat visits are ~2.2 s.
7. **Only if all of the above fail:** consider whether the demo can be scoped to fewer screens. This is a last resort — the user asked for all screens, and a partial demo was already rejected once.

**Explicitly out of scope:** returning to an HTML re-implementation. That path is exhausted.

---

## 8. Definition of done

- [ ] Real Flutter app rendering in the site, all 9 screens navigable
- [ ] First-load weight measured and reported (raw + gzipped), with a stated target and whether it was met
- [ ] Marketing page first paint not blocked by the demo
- [ ] **Zero third-party requests**, asserted by an automated test, not just once by hand
- [ ] Zero console errors on the live site
- [ ] `sh check.sh` green in the site repo; `flutter analyze` clean in the app repo
- [ ] Playwright: scope runs to touched paths; visual baselines regenerated deliberately
- [ ] No placeholder text, no personal info
- [ ] Committed on a branch and merged without rewriting history
- [ ] Measurements and decisions written down in the commit message

## 9. Environment notes / gotchas

- Local site server: `python3 tools/serve.py` → `http://localhost:8082`
- **Do not** `pkill -f "serve.py"` — it matches the agent's own shell and kills the session. Use:
  `ps aux | grep "[t]ools/serve" | awk '{print $2}' | xargs -r kill -9`
- Playwright against the live site needs `BASE_URL=https://mansourvery-hub.github.io/zitouna-site`; `page.goto('/')` resolves to the origin root, so use the full `HOME` constant.
- The app repo's `web-target-experiment` branch is **local**; confirm whether it needs pushing before a CI build can use it.
- When vendoring the build into the site, `build.py` rewrites Flutter's `<base href>` per deploy target — a missing rewrite shows up as a blank frame with no console error.