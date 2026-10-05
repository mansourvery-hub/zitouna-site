# Zitouna site (direction B, "the page ripens")

Static, no dependencies, no cookies, no analytics, no third-party requests.

## Build
    python3 build.py        # writes dist/, zitouna-dist.zip, zitouna-source.zip
Edit `site.config.json` first: SITE (your domain), DOWNLOAD_URL, SUPPORT_URL, OPERATOR, CONTACT.
Anything left empty stays a visible placeholder and the build warns. Pillow is only needed for og.png.

## Deploy
Upload the contents of `dist/` (or unzip `zitouna-dist.zip`) to any static host.
`_headers` works as-is on Netlify and Cloudflare Pages. On nginx/Apache copy the same headers into the server config.
Serve over HTTPS (the CSP uses upgrade-insecure-requests and HSTS is set).

## Before you publish
1. Add the three font files to `src/fonts/` (see the README there) and check their web licences.
2. Replace the favicon and og.png with the app's real logo. Both are redrawn stand-ins.
3. Review the dark-theme colours in styles.css (marked "derived"): only paper #191A11 came from the app.
4. Confirm schema.org applicationCategory ("LifestyleApplication") and the Offer price of 0 suit you.
5. Open the page in real browsers. It has not been rendered by anyone yet.

## Claims and sources
| Claim on the site | Source in the repo |
|---|---|
| Free, no account, offline | README, docs/05 invariants, no auth or analytics packages in pubspec.yaml |
| Android 8 or newer, no iPhone | 01-system-architecture (API 26), release workflow builds APKs only |
| Version 0.1.0 | pubspec.yaml |
| Four colour buckets, weights 0/2/4.5/7, round once, Chemlali 2.0/3.5/5.5 | lib/logic/ripeness_calculator.dart |
| Rendement = litres x 0.916 / kg x 100, label "Extraction Rendement" | rendement_calculator.dart, app_en.arb (2-decimal display assumed) |
| Twelve varieties, EN/FR/AR with RTL, kg/quintal | enums.dart, l10n files, settings screen |
| Backup to a file | settings screen (built, not run) |
| Ranges, never one number | pre_press_estimate.dart |
| Gauge is guidance, not a lab test | docs record the weights as unvalidated |

Not claimed: iOS, camera or photo ripeness, weather, map, source code or licence, store availability.

## Demo: the app's screens, running natively in the page

No downloads, no engine, no blank frame: the demo is plain HTML/CSS/JS (~150KB total)
that renders instantly. It mirrors the app the ChessSRS way — generated inputs, translated
structure, parity-tested:

- `src/demo.js` renders My Trees, the parcel screen with all five tabs (Overview, Ripeness,
  Harvest, Mill, Years) and settings, from seeded example data (one parcel, two seasons).
  Nothing persists; refresh and it resets.
- Rules in `src/logic.js` are ported from the app (`ripeness_calculator.dart`,
  `rendement_calculator.dart`, `pre_press_estimate.dart`, `alternate_bearing.dart`,
  `weight_unit.dart`) and pinned by `tests/logic.test.mjs`. Gauge geometry in `src/gauge.js`
  is ported from `ripeness_arc_gauge.dart`.
- Tokens and strings are generated, not copied: `scripts/sync-design.js` extracts the
  `ZitounaTheme` palettes into `src/demo-tokens.css`, and `scripts/sync-strings.js`
  extracts the parcel tabs, stages, buckets and copy into `design/app-ui.json`, which
  `src/app-ui.js` serves to the demo. Both have `--check` gates.
- `tests/e2e/app-parity.spec.js` renders the real demo and asserts it against the manifest.
  `KNOWN_GAPS` (backup export/import, APK sharing, map picker, non-English locales) are
  features the demo intentionally omits; each must stay present in the manifest or the
  spec fails.
- `tools/check-app-sync.py` cross-checks the translated values against the Dart source.

## Checks (stage 5)
    sh check.sh      # build + static checks + unit tests + contrast; non-zero exit on failure
- `build.py` static checks: one h1, no skipped heading levels, every link and button has a name, anchors and files resolve, no external requests, no inline styles, valid JSON-LD, no cookie, storage or network calls in the scripts.
- `tests/logic.test.mjs` (node --test, Node 18+): ripeness boundaries (2.0, 3.5, 5.5), stage always agrees with the displayed index, rendement, gauge geometry and marker positions.
- `tests/contrast.py`: WCAG ratios for every colour pair in both themes. One known exception is reported, not hidden: the app's own light gold arc on white is 2.71:1. The stage is also given as text, so no information depends on that colour alone.

## What stage 5 found and fixed
- Scrolling back up left the page tinted in the last section's colour (the hero was not observed). Fixed.
- Demo CSS clashed with site CSS on `.note` and `.row`, and the old tray CSS was dead weight. Removed and renamed.
- A button disabled at zero dropped keyboard focus. The demo now uses aria-disabled.
- The live region re-announced the whole gauge on every tap. It now announces one short sentence, for example "Soon. Ripeness index 2.20 of 7.00, from 50 olives."
- Mill inputs were cleared when switching tabs. They are kept now.
- Light-theme stage chips and the small notes on the green section failed 4.5:1. Fixed (see the on-page differences list).
- Added Home and End keys to the demo tabs, and a no-JavaScript message in the demo area.

## Deploy
1. Edit `site.config.json`, add the fonts, run `sh check.sh`, upload `dist/` (or `zitouna-dist.zip`) to the web root.
2. Netlify or Cloudflare Pages: `_headers` is used as is. nginx: include `deploy/nginx-headers.conf`. Other hosts: copy the headers from it.
3. Serve at the domain root: asset paths start with `/`. For a sub-folder, change them in src/index.html.
4. After deploy, check the live headers (securityheaders.com or `curl -I`), then run Lighthouse and a screen-reader pass on a real phone.
5. Re-check the footer sentence "no cookies, no analytics, nothing from other websites" against what the live site really loads (browser network panel).

## Still untested
Nobody has opened this in a browser. Not covered by any test: how the page and demo render, the DOM behaviour of the demo (tabs, focus, live announcements), real screen readers (VoiceOver, TalkBack, NVDA), the scroll colour change, the CSP in a real browser, and performance numbers.
