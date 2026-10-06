# Zitouna website: handoff prompt for a local agent

You are continuing a project that was started in a chat session without a real browser. The project is the marketing website for **Zitouna** (الزيتونة), a free, offline-first Android app for olive growers. The site is already designed and built. Your job is to put it under version control, test it in real browsers, close the gaps listed below, and get it ready to deploy.

## Rules that never change
- **The app repository is the single source of truth.** Every factual claim on the site (platforms, features, price, privacy, offline, licence, version) must be traceable to it. The claims table is in `README.md`. Invent nothing. If you cannot verify something, remove it or mark it clearly.
- **Never modify the app repository.** Read it only.
- **No cookies, no analytics, no third-party requests.** Do not add Google Fonts, CDNs, trackers or embeds. The footer says so, and the build checks for it.
- **Do not assume a licence or business model.** Do not add a `LICENSE` file to this repo until I decide.
- **Placeholders stay obvious** until I give you real values. Never invent links, names, domains or contact details.
- **Do not say something looks right unless you have seen it.** Say what you saw, at which width and theme.
- **When something is wrong, fix the cause, not the symptom,** and tell me what the cause was.
- **Ask me nothing unless you are blocked.** State your assumption in one line and proceed. Work in phases and **stop after each phase with a short report**: what you did, what you verified and how, what is uncertain.

## Phase 1: create the GitHub repository (do this first)
Assumptions, unless I say otherwise: repository name `zitouna-site`, owner is my own GitHub account, **private** visibility, default branch `main`, and no licence file.

1. Check the tools: `git --version`, `gh --version`, `gh auth status`, `python3 --version`, `node --version`. If `gh` is not logged in, stop and tell me to run `gh auth login`.
2. Check `git config user.name` and `user.email`. If they are missing, stop and ask me for them. Do not invent them.
3. Confirm the folder holds the project: `site.config.json`, `build.py`, `check.sh`, `src/`, `tests/`, `README.md`. Do not copy any `dist/` folder or `*.zip` files into version control.
4. Create `.gitignore` with: `dist/`, `*.zip`, `node_modules/`, `.DS_Store`, `.env`, `test-results/`, `src/fonts/*.woff2`. (The font files stay out of git until I confirm their licence allows it. Keep `src/fonts/README.txt` tracked.)
5. `git init -b main`, then make the first commit with the message `Initial commit: Zitouna site, stages 1 to 5`.
6. Create and push: `gh repo create zitouna-site --private --source=. --remote=origin --push` (use `OWNER/zitouna-site` if I gave you an organisation).
7. Verify: `gh repo view --web` is not needed, but run `gh repo view --json name,visibility,url` and `git status`, and report the URL and visibility. Confirm no secrets, zips or `dist/` were pushed.
8. From now on, work on short-lived branches and open pull requests against `main` for every later change. Do not push further commits straight to `main`.

**Stop and report.**

## Phase 2: verify the existing build
1. Run `sh check.sh`. It builds the site, runs the static checks, the unit tests (`node --test tests/logic.test.mjs`) and the contrast test. All must pass. The only expected warnings are the unset config values and the missing font files.
2. Add `.github/workflows/check.yml` that runs `sh check.sh` on every push and pull request (Python 3.12, Node 22, `pip install pillow`). Open it as a pull request, not a direct push.

**Stop and report.**

## Phase 3: test in real browsers (this was never done)
Nobody has opened this page yet. Layout, rendering, the CSP and the demo's DOM behaviour are all untested.

1. Serve `dist/` locally **with the headers from `dist/_headers` applied**, including the Content-Security-Policy. A plain `python3 -m http.server` does not apply them, so write a small `tools/serve.py` that reads `_headers` and sends them. Then check the browser console for CSP violations.
2. Add Playwright as a **dev-only** tool in a `tests/e2e/` folder (it must not touch `dist/` or the site's own dependencies). Automate and screenshot the page at 360, 390, 768 and 1280 px wide, in light and dark (`prefers-color-scheme`), with reduced motion on, and with JavaScript off.
3. Check by eye and with the tests, and report what you actually saw:
   - The page background ripens through green, gold, wine and near-black as you scroll down, and **returns to the hero colour when you scroll back to the top**.
   - No horizontal scrolling at 360 px. Text never overlaps. The sticky header does not hide anchor targets.
   - Demo: all three tabs work (Overview, Ripeness, Mill). Counters change the gauge and the stage chip. "Save Ripeness Check" updates Overview. The Mill result matches `litres × 0.916 ÷ kg × 100`.
   - Demo keyboard use: Tab order is logical, arrow keys, Home and End move between tabs, the focus ring is always visible, and the minus button does not lose focus at zero.
   - Lighthouse (mobile) for accessibility, performance, best practices and SEO. Record the scores and fix real problems.
4. Do a screen-reader pass: VoiceOver or NVDA on desktop, and TalkBack on an Android phone if I can lend you one. After a tap on a counter, the screen reader should say one sentence such as "Soon. Ripeness index 2.20 of 7.00, from 50 olives." Report anything confusing.
5. Fix every real defect you find on a branch and a pull request, with a test where a test is possible.

**Stop and report.**

## Phase 4: keep the demo faithful to the app
The app's design is **not final**, so the demo will drift. Make drift visible.

1. Ask me for the path to my app repo (this is the one thing you may ask for). Read it, read-only.
2. Write `tools/check-app-sync.py <path-to-app-repo>` that fails if any of these differ from the app's Dart source:
   - `lib/logic/ripeness_calculator.dart`: bucket weights (0, 2.0, 4.5, 7.0), Chemlali thresholds (2.0, 3.5, 5.5), rounding rule and stage order. Compare with `src/logic.js`.
   - `lib/logic/rendement_calculator.dart`: oil density 0.916.
   - `lib/widgets/ripeness_arc_gauge.dart`: gauge sizes, radii, stroke widths, marker radii. Compare with `src/gauge.js`.
   - `lib/theme/zitouna_theme.dart`: light and dark colour tokens used in `src/demo.css`, `src/styles.css` and `tests/contrast.py`.
   - `lib/l10n/app_en.arb`: the strings used in `src/demo.js` (Check Ripeness, Save Ripeness Check, Save Delivery, Extraction Rendement, tab names, stage names, and the rest).
3. Run it. For every mismatch, report it and fix the site, or tell me if the app is the one that looks wrong.
4. If I give you release-build screenshots from a phone (default theme, no debug banner, no test data), compare them with the demo and extend it (Harvest and Years tabs are not built yet). Keep the "How this demo differs from the app" list on the page accurate: every change to the demo must update that list.

**Stop and report.**

## Phase 5: finish and deploy-ready
Ask me once for these values and apply them in `site.config.json` and the assets. Until I answer, leave the placeholders.
- `SITE` (final domain), `DOWNLOAD_URL`, `SUPPORT_URL` (support or donation link), `OPERATOR` (legal name for the footer), `CONTACT`.
- The three font files (`ZillaSlab-Medium.woff2`, `ZillaSlab-Bold.woff2`, `Manrope-Variable.woff2`) in `src/fonts/`. Check each font's licence for web use.
- The real logo or launcher icon, to replace the stand-in `favicon.svg` and `og.png` (the build draws a placeholder social image with DejaVu Serif).

Then:
1. Rebuild, rerun `sh check.sh`, and rerun the browser tests with the real fonts. Fonts change line breaks, so re-check every breakpoint.
2. Hosting: **do not deploy without my go-ahead.** When I choose, prefer Cloudflare Pages or Netlify, because `dist/_headers` works there as is. GitHub Pages cannot send custom response headers, so the CSP, HSTS and the other security headers would be missing. If I pick GitHub Pages, tell me exactly what is lost.
3. After deploying, check the live response headers (`curl -I`), the browser network panel (the footer promises nothing loads from other sites), `robots.txt`, `sitemap.xml`, the social preview of `og.png`, and the structured data in Google's Rich Results Test.

**Stop and report.**

## Open decisions and known issues (do not decide these for me)
- **Download target.** The app's release workflow currently publishes debug-signed "test-build" pre-releases, and the signing keystore was not yet configured in the docs. Do not present those as a stable release. Ask me what the Download button should link to and what wording is true.
- **Licence and source link.** The docs say the app is closed-source and I found no licence file, so the site has no source link. Do not add one.
- **Map and privacy.** The app has a satellite-map parcel picker that requests tiles from `tiles.openfreemap.org`, and the release Android manifest does not declare `INTERNET`. I could not run it to see what happens. The site never claims the map exists and never says "nothing ever leaves your phone". If you can build or run the app, verify this and tell me.
- **Stale docs in the app repo.** The app's README and `AGENT.md` status tables say some features are missing that the code shows as built, and the README string count is out of date. Trust the code where they differ.
- **Contrast in the app itself.** In the light theme the gold gauge arc on white is 2.71:1 and the pale stage-chip colours are too light for text. The demo works around the chips and reports the arc as a known exception in `tests/contrast.py`. I may want to raise this with the app's design.
- **Assumptions to confirm:** schema.org `applicationCategory` is `LifestyleApplication`, the Offer price is 0, the rendement is shown to two decimals, and the dark-theme colours marked "derived" in `src/styles.css` (only the dark paper `#191A11` came from the app; the site should read the rest from `zitouna_theme.dart`).
- **Languages.** The site is English only. The app has English, French and Arabic with right-to-left layout. Ask me before adding a French or Arabic version of the site.

## Reports
End every phase with: **Done** (what changed, with commit or pull request links), **Verified** (what you ran or saw, in which browser, width and theme), **Not verified**, and **Needs from me**.
