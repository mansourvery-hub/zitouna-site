# AGENTS.md

Navigation only. The README is the documentation; this file exists so you do not
have to rediscover how the demo pipeline fits together.

## Commands

| What | Command | Where it runs |
|---|---|---|
| Build the site | `python3 build.py` | local, fast |
| Everything CI checks | `sh check.sh` | local, fast |
| Serve with real headers | `python3 tools/serve.py` → `http://localhost:8082` | local |
| **Regenerate the demo** | `sh tools/build-demo.sh` | **CI only** — see below |
| Browser tests | `pnpm exec playwright test` | **CI only** — never locally |

Ports 8080 and 8081 are taken by other services; the site uses 8082.

## The demo is generated from the app repo

`src/demo-posters/` and `src/flutter-demo/` are **outputs**, not source. Do not
edit them and do not be surprised when CI overwrites them.

The app lives at `/home/mohamed/Desktop/Github/Zitouna`, branch
`web-target-experiment`. `tools/build-demo.sh` builds it, screenshots its
screens, and vendors the result. `tools/capture-demo.mjs` drives the app through
Flutter's semantics tree and asserts the screen it landed on, so renaming a
screen fails the build rather than shipping a stale poster.

**CI is the source of truth.** `.github/workflows/deploy-pages.yml` clones the
app repo and regenerates everything, gated on the `APP_TOKEN` secret (fine-grained
PAT, Contents: read-only, scoped to the app repo). Without that secret it deploys
the last committed `src/flutter-demo/`.

Consequence worth internalising: **CI reports the app repo's committed state, not
your working tree.** If you change seed data or copy in the app and do not commit
it, the site ships the old version and the pipeline looks broken. It is not — it
is reporting the truth.

## Traps that cost real time

- **`serve.py` must merge every matching `_headers` pattern**, not stop at the
  first. First-match-wins made the framed app inherit the top page's
  `frame-ancestors 'none'` and blocked it. Netlify and Cloudflare merge; so must
  the local server.
- **`_headers` patterns need the Pages subpath.** They are matched against the
  full request path, so without `BASE_PATH` the per-path CSP silently never
  matches on a subpath deploy.
- **GitHub Pages cannot send custom headers**, so live runs skip the CSP
  assertions (2 tests × 2 projects). Local runs apply them via `serve.py`.
- **The demo needs `wasm-unsafe-eval`** for CanvasKit. It cannot be dropped.
- **Drift's generated code is gitignored** in the app repo, so CI runs
  `flutter pub get && dart run build_runner build` before building.

## Never run the browser suite locally

`pnpm exec playwright test` without a narrow `-g` filter saturates the machine.
Use `-g "<name>"` to scope to one test, or push and let CI run it. The visual
baselines are regenerated on CI: dispatch the `Check` workflow with
`update_snapshots=true` and download the `visual-baselines` artifact.

## Verification before claiming done

`sh check.sh` covers the build, unit tests, and contrast. It does **not** render
anything in a browser — CI's `e2e` job does that. A green `check.sh` is not
evidence the page looks right.

For anything touching the demo, verify the live site in a real browser and say
which renderer variant was fetched. Report sizes raw **and** gzipped; comparing
one against the other has already produced one confidently wrong "saving" here.
