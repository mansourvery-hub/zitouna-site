/**
 * Capture the demo's screens from the REAL Flutter build, as WebP posters.
 *
 * These are not mockups and not hand-drawn: this drives the actual app that
 * `tools/build-demo.sh` just compiled, so every pixel comes from Flutter's own
 * rendering of the app's own widgets. Re-run the script after changing the app
 * and the posters follow.
 *
 * Navigation goes through Flutter's semantics tree (the a11y tree Flutter
 * builds for screen readers) rather than raw canvas coordinates, so a layout
 * change moves the target with it instead of silently capturing the wrong tap.
 *
 * Usage: node tools/capture-demo.mjs --base http://127.0.0.1:8099 --out src/demo-posters
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const BASE = arg('base', 'http://127.0.0.1:8099');
const OUT = arg('out', 'src/demo-posters');

/** Viewport of the phone frame the posters are shown in. */
const PHONE = { width: 390, height: 844 };

/**
 * Each poster: a name, the steps to reach that screen from a fresh boot, and a
 * string that proves we landed on it. `expect` is what stops silent drift: if the
 * app renames or removes a screen, the capture fails instead of quietly
 * photographing whatever replaced it.
 */
const SHOTS = [
  { name: 'my-trees', steps: [], expect: 'My Trees' },
  { name: 'overview', steps: ['open-parcel'], expect: 'Overview' },
  { name: 'ripeness', steps: ['open-parcel', 'tab:Ripeness'], expect: 'Too Early' },
  { name: 'harvest', steps: ['open-parcel', 'tab:Harvest'], expect: 'Add Harvest Entry' },
  { name: 'mill', steps: ['open-parcel', 'tab:Mill'], expect: 'Save Delivery' },
  { name: 'years', steps: ['open-parcel', 'tab:Years'], expect: 'Year-over-Year Trajectory' },
  { name: 'settings', steps: ['open-settings'], expect: 'Units' },
];

/** Flutter paints a frame or two after a state change; wait for it to settle. */
const settle = (page, ms = 1400) => page.waitForTimeout(ms);

async function boot() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: PHONE, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });

  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForSelector('flt-semantics-placeholder', { timeout: 90_000 });
  // The placeholder is parked off-screen at -1px,-1px, so the mouse cannot
  // reach it. Dispatch the click directly to switch Flutter's semantics tree on.
  await page.evaluate(() => document.querySelector('flt-semantics-placeholder')
    .dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForSelector('flt-semantics[role=button]', { timeout: 30_000 });
  await settle(page, 3000);
  return { browser, page, errors };
}

/**
 * Tap a semantics node by its accessible text. Fails loudly rather than drifting.
 *
 * Flutter web puts the label in the element's text content, not in `aria-label`
 * (the attribute is only present on some nodes), so match on text. Nodes are
 * matched by role=button where possible, because Flutter emits a non-interactive
 * `group` with identical text directly above the real button: tapping the group
 * would silently do nothing.
 */
async function tap(page, label) {
  const node = page.locator('flt-semantics[role=button]', { hasText: label }).first();
  await node.waitFor({ state: 'attached', timeout: 15_000 });
  await node.dispatchEvent('click');
  await settle(page);
}

async function applyStep(page, step) {
  if (step === 'open-parcel') return tap(page, 'Near the well');
  if (step === 'back') return tap(page, 'Back');
  // Named so it cannot be confused with a tab: the settings button is in the
  // My Trees app bar, and the demo's Settings screen is reached from there.
  if (step === 'open-settings') return tap(page, 'Settings');
  if (step.startsWith('tab:')) return tap(page, step.slice(4));
  throw new Error(`unknown step: ${step}`);
}

/** After arriving on a screen, prove we are actually on it. */
async function expectText(page, text) {
  const found = await page.locator('flt-semantics', { hasText: text }).count();
  if (!found) {
    const seen = await page.locator('flt-semantics[role=button]').allTextContents();
    throw new Error(
      `expected "${text}" on this screen, so the app probably renamed or moved it.\n` +
      `buttons now present: ${JSON.stringify(seen.map((t) => t.trim().slice(0, 30)))}`
    );
  }
}

async function capture(page, name) {
  const file = path.join(OUT, `${name}.webp`);
  // Full app frame, not the whole page: the marketing page supplies its own
  // chrome and the phone frame supplies the mask.
  await page.screenshot({ path: file, type: 'webp', quality: 80, clip: { x: 0, y: 0, ...PHONE } });
  return file;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const written = [];

  // One boot per poster: every screen is captured from a clean first-run state,
  // so a poster can never show leftovers from the previous one.
  for (const shot of SHOTS) {
    const { browser, page, errors } = await boot();
    try {
      for (const step of shot.steps) await applyStep(page, step);
      await expectText(page, shot.expect);
      const file = await capture(page, shot.name);
      if (errors.length) throw new Error(`console errors on ${shot.name}: ${errors.join(' | ')}`);
      written.push(file);
      console.log(`  ${file}`);
    } finally {
      await browser.close();
    }
  }
  console.log(`\n${written.length} posters written to ${OUT}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });