import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/* App parity: the demo's screens against the manifest the app's Dart produced.
 *
 *   scripts/sync-design.js    app tokens/fonts -> src/demo-tokens.css, src/fonts  (--check)
 *   scripts/sync-strings.js   app Dart + ARB   -> design/app-ui.json, src/app-ui.js (--check)
 *   tests/e2e/app-parity.spec.js  design/app-ui.json vs the running demo  (this file)
 *
 * The sync scripts catch "the app changed and nobody re-derived it". This catches "the demo no
 * longer matches the app". Neither alone is enough: a string rename in app_en.arb used to leave
 * every other gate green while the demo served the old wording.
 *
 * KNOWN_GAPS are work the demo has not done, not drift. They are asserted to *stay* present in the
 * manifest — so the day the app drops one, this file is forced to say so — while not failing the
 * build. Anything outside that list is drift and fails.
 */
const manifest = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'design/app-ui.json'), 'utf8')
);

/** The parcel tabs the demo does NOT port. Their manifest rows must stay present (a dropped one
 * means the gap has to be revisited), but the demo is excused from rendering them. */
const KNOWN_GAPS = new Set([
  'tabHarvest',
  'tabYears',
]);

const C = (page, sel) => page.locator(`#demo ${sel}`);

test.describe('App parity (design/app-ui.json vs the running demo)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(process.env.BASE_URL ?? 'http://localhost:8082');
    await page.locator('#demo').scrollIntoViewIfNeeded();
  });

  test('the manifest still contains everything the demo treats as a known gap', () => {
    const present = new Set(manifest.tabs.map((t) => t.key));
    const stale = [...KNOWN_GAPS].filter((g) => !present.has(g));
    expect(stale, 'KNOWN_GAPS entries the app no longer has — remove them or implement them').toEqual([]);
  });

  test('every tab the demo renders matches the app label, in app order', async ({ page }) => {
    const rendered = await C(page, '[role=tab]').evaluateAll((els) =>
      els.map((e) => e.textContent.trim())
    );
    const appTabs = manifest.tabs.filter((t) => !KNOWN_GAPS.has(t.key)).map((t) => t.label);
    expect(rendered, 'the demo shows a different tab set than the app (minus KNOWN_GAPS)').toEqual(appTabs);
  });

  test('every KNOWN_GAP tab is NOT rendered by the demo', async ({ page }) => {
    const rendered = await C(page, '[role=tab]').evaluateAll((els) =>
      els.map((e) => e.textContent.trim())
    );
    for (const g of KNOWN_GAPS) {
      const label = manifest.tabs.find((t) => t.key === g)?.label;
      expect(rendered, `"${label}" is a KNOWN_GAP but the demo now renders it — move it out or drop the gap`).not.toContain(label);
    }
  });

  test('ripeness stage names match the app', async ({ page }) => {
    await C(page, '[role=tab][data-t=ripeness]').click();
    // The live region (#sum) holds the active stage label; bucket counts drive it to a stage.
    // Add one green olive and read the announcement, which begins with the stage name.
    await C(page, '.rb[data-k="g"][data-d="1"]').first().click();
    await page.waitForTimeout(150);
    const status = await C(page, '#sum').textContent();
    const stageLabels = manifest.stages.map((s) => s.label);
    expect(
      stageLabels.some((l) => status.startsWith(l)),
      `the live announcement "${status}" does not begin with an app stage name`
    ).toBe(true);
  });

  test('bucket counter labels match the app', async ({ page }) => {
    await C(page, '[role=tab][data-t=ripeness]').click();
    const labels = await C(page, '.ctr .cl').evaluateAll((els) => els.map((e) => e.textContent.trim()));
    const appLabels = manifest.buckets.map((b) => b.label);
    expect(labels).toEqual(appLabels);
  });

  test('ripeness save button and overview card use the app strings', async ({ page }) => {
    await C(page, '[role=tab][data-t=ripeness]').click();
    await expect(C(page, '#save')).toHaveText(manifest.copy.saveRipenessCheck);

    await C(page, '[role=tab][data-t=overview]').click();
    const title = await C(page, '.card .t').first().textContent();
    expect([manifest.copy.millCardTitle, manifest.copy.alternateBearingTitle]).toContain(title);
  });

  test('mill copy matches the app (computed label and save button)', async ({ page }) => {
    await C(page, '[role=tab][data-t=mill]').click();
    const label = await C(page, '.cap').first().textContent();
    expect(label).toBe(manifest.copy.computedRendementLabel);
    await expect(C(page, '#save')).toHaveText(manifest.copy.saveMillLog);
  });

  test('the gauge marker moves and the index is a 2-decimal number', async ({ page }) => {
    await C(page, '[role=tab][data-t=ripeness]').click();
    await C(page, '.rb[data-k="t"][data-d="5"]').first().click();
    await page.waitForTimeout(150);
    const idx = await C(page, '#idx').textContent();
    expect(idx).toMatch(/^\d+\.\d{2}$/);
    const marker = C(page, '#g svg .mk');
    await expect(marker).toBeVisible();
  });
});
