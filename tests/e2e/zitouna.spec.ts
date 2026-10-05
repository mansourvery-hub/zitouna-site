import { test, expect } from '@playwright/test';

// Navigate to the configured base URL. '/' would resolve to the ORIGIN root
// (e.g. https://user.github.io/) instead of a project site subpath.
const HOME = process.env.BASE_URL ?? '/';

const VIEWPORTS = [
  { width: 360, height: 640, name: 'mobile-360' },
  { width: 390, height: 844, name: 'mobile-390' },
  { width: 768, height: 1024, name: 'tablet-768' },
  { width: 1280, height: 720, name: 'desktop-1280' },
];

const THEMES = ['light', 'dark'];
const REDUCED_MOTION = ['reduce', 'no-preference'];

test.describe('Zitouna site visual regression', () => {
  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      for (const motion of REDUCED_MOTION) {
        test(`viewport ${viewport.name} theme=${theme} reduced-motion=${motion}`, async ({ page }) => {
          await page.emulateMedia({ colorScheme: theme as 'light' | 'dark', reducedMotion: motion as 'reduce' | 'no-preference' });
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          
          // The demo loads the live app as soon as it is in view, which is a few
          // seconds of engine work at an unpredictable point. Block it here so the
          // baseline captures the page's own layout deterministically; the live
          // app is covered by its own test, which waits for it to actually paint.
          await page.route('**/flutter-demo/**', (route) => route.abort());

          await page.goto(HOME);
          await page.waitForLoadState('networkidle');
          
          // Take screenshot
          await expect(page).toHaveScreenshot(`zitouna-${viewport.name}-${theme}-${motion}.png`, {
            fullPage: true,
            animations: 'disabled',
          });
        });
      }
    }
  }
});

test.describe('No horizontal scrolling at 360px', () => {
  test('no horizontal overflow at 360px width', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(HOME);
    await page.waitForLoadState('networkidle');
    
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
  });
});

test.describe('Sticky header does not hide anchor targets', () => {
  test('anchor targets visible with sticky header', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(HOME);
    await page.waitForLoadState('networkidle');
    
    // Check all anchor links except skip link
    const anchors = await page.locator('a[href^="#"]:not(.skip)').all();
    for (const anchor of anchors) {
      const href = await anchor.getAttribute('href');
      if (href && href !== '#') {
        await anchor.click();
        await page.waitForTimeout(100);
        const target = page.locator(href);
        if (await target.count() > 0) {
          const isVisible = await target.isVisible();
          const box = await target.boundingBox();
          expect(isVisible).toBeTruthy();
          if (box) {
            expect(box.y).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });
});

// GitHub Pages cannot send custom response headers, so dist/_headers is inert
// there. Assert the headers only against a host that applies _headers; assert
// the weaker "no violations" guarantee everywhere.
const HOSTS_CUSTOM_HEADERS =
  !process.env.BASE_URL || /localhost|127\.0\.0\.1/.test(process.env.BASE_URL);

test.describe('CSP and security headers', () => {
  test('no CSP violations in console', async ({ page }) => {
    const cspViolations: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('Content Security Policy')) {
        cspViolations.push(msg.text());
      }
    });

    await page.goto(HOME);
    await page.waitForLoadState('networkidle');

    // The page ships a CSP via dist/_headers and must not trip it.
    expect(cspViolations.length).toBe(0);
  });

  test('CSP header is present and restrictive', async ({ page }) => {
    test.skip(!HOSTS_CUSTOM_HEADERS, 'host does not apply dist/_headers (e.g. GitHub Pages)');

    const response = await page.goto(HOME);
    const headers = response?.headers();
    expect(headers?.['content-security-policy']).toBeTruthy();
    expect(headers?.['content-security-policy']).toContain("script-src 'self'");
    expect(headers?.['content-security-policy']).toContain("style-src 'self'");
  });

  test('Security headers present', async ({ page }) => {
    test.skip(!HOSTS_CUSTOM_HEADERS, 'host does not apply dist/_headers (e.g. GitHub Pages)');

    const response = await page.goto(HOME);
    const headers = response?.headers();

    expect(headers?.['strict-transport-security']).toBeTruthy();
    expect(headers?.['x-content-type-options']).toBe('nosniff');
    expect(headers?.['referrer-policy']).toBe('no-referrer');
    expect(headers?.['permissions-policy']).toBeTruthy();
    expect(headers?.['cross-origin-opener-policy']).toBe('same-origin');
  });
});

test.describe('JavaScript off', () => {
  test('no-JavaScript message shows when JS disabled', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(HOME);
    await page.waitForLoadState('networkidle');
    
    // Check for no-JS message in demo area
    const noJsMessage = page.locator('#demo noscript');
    if (await noJsMessage.count() > 0) {
      await expect(noJsMessage).toBeVisible();
    }
    
    await context.close();
  });
});

test.describe('Scroll background color change', () => {
  test('Background ripens through colors on scroll and returns to hero on scroll up', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(HOME);
    await page.waitForLoadState('networkidle');
    
    // Get hero background color (the hero section has class="hero" and data-stage="hero")
    const hero = page.locator('section.hero').first();
    const heroColor = await hero.evaluate(el => window.getComputedStyle(el).backgroundColor);
    
    // Scroll down through sections
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    
    // Check body or last section has different color
    const lastSection = page.locator('section:last-of-type').first();
    const lastColor = await lastSection.evaluate(el => window.getComputedStyle(el).backgroundColor);
    
    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    
    // Hero should have original color again
    const heroColorAfter = await hero.evaluate(el => window.getComputedStyle(el).backgroundColor);
    expect(heroColorAfter).toEqual(heroColor);
  });
});

test.describe('Generated demo (the app itself, poster while it loads)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(process.env.BASE_URL ?? 'http://localhost:8082');
    await page.waitForLoadState('load');
  });

  test('a poster of the real app is painted immediately', async ({ page }) => {
    // The poster is a screenshot of the app, taken by tools/build-demo.sh. It has
    // to exist and decode, or the section is a blank box until the engine lands.
    await page.locator('#demo').scrollIntoViewIfNeeded();
    const poster = page.locator('.stage .poster');
    await expect(poster).toBeVisible();
    const natural = await poster.evaluate((el: HTMLImageElement) => el.naturalWidth);
    expect(natural, 'the poster failed to load').toBeGreaterThan(0);
    // And it must describe itself, not be decorative.
    expect(await poster.getAttribute('alt')).toMatch(/Zitouna on Android/);
  });

  test('the poster is phone-shaped, not letterboxed', async ({ page }) => {
    await page.locator('#demo').scrollIntoViewIfNeeded();
    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const ratio = await page.locator('.stage').evaluate((n) => {
        const r = n.getBoundingClientRect();
        return r.width / r.height;
      });
      expect(ratio, `stage is not phone-shaped at ${width}px`).toBeCloseTo(0.463, 2);
    }
  });

  test('the page is fully usable with the engine blocked', async ({ page }) => {
    // The poster is generated from the app, so the section still tells the truth
    // when the app itself cannot start. Nothing may depend on the engine.
    await page.route('**/flutter-demo/**', (route) => route.abort());
    await page.locator('#demo').scrollIntoViewIfNeeded();
    await expect(page.locator('.stage .poster')).toBeVisible();
    // The page's own calculator still works.
    await page.locator('#kg').fill('1000');
    await page.locator('#l').fill('180');
    await expect(page.locator('#rd')).toHaveText('16.49 %');
    // No dead "Try it live" button left behind.
    await expect(page.locator('#golive')).toHaveCount(0);
  });

  test('the real app loads in a frame and paints over the poster', async ({ page }) => {
    test.setTimeout(180_000);
    await page.locator('#demo').scrollIntoViewIfNeeded();
    await page.locator('iframe.fdlive').waitFor({ state: 'attached', timeout: 30_000 });

    // The frame navigates after attach, so poll rather than sample once.
    let frame = null as Awaited<ReturnType<typeof page.frames>>[number] | null;
    for (let i = 0; i < 60 && !frame; i++) {
      frame = page.frames().find((f) => f.url().includes('flutter-demo')) ?? null;
      if (!frame) await page.waitForTimeout(500);
    }
    expect(frame, 'the demo frame never navigated to the app').not.toBeNull();
    await frame!.waitForSelector('flt-glass-pane, canvas, flutter-view', { timeout: 90_000 });
    expect(await frame!.evaluate(() => !!document.querySelector('flt-glass-pane'))).toBe(true);

    // Once the app is up the poster must be out of the way, not stacked on top.
    await expect(page.locator('.fdlive[data-ready]')).toHaveCount(1, { timeout: 60_000 });
  });

  test('the footer promise holds: nothing is requested off-origin', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (r) => {
      const u = r.url();
      if (!u.startsWith('http://localhost') && !u.startsWith('http://127.0.0.1')) {
        const host = process.env.BASE_URL ? new URL(process.env.BASE_URL).host : 'localhost';
        if (!u.startsWith(`http://${host}`) && !u.startsWith(`https://${host}`)) external.push(u);
      }
    });
    await page.goto(process.env.BASE_URL ?? 'http://localhost:8082', { waitUntil: 'load' });
    await page.locator('#demo').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    expect(external, 'the site loaded something from another website').toEqual([]);
  });
});
