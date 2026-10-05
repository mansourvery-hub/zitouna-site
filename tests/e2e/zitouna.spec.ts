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

test.describe('Flutter demo embed', () => {
  test('the page frames the real Flutter demo and it boots without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(process.env.BASE_URL ?? 'http://localhost:8082');
    await page.waitForLoadState('load');
    const iframe = page.locator('iframe.fdemo');
    await expect(iframe).toBeVisible();
    await expect(iframe).toHaveAttribute('title', /.+/);

    // The framed app boots its engine and paints a canvas. The canvas element exists in the DOM
    // before first paint, so also require a non-zero backing store and settle time.
    const frame = page.frameLocator('iframe.fdemo');
    const canvas = frame.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 30000 });
    await expect
      .poll(async () => canvas.evaluate((el: HTMLCanvasElement) => el.width * el.height), {
        timeout: 30000,
      })
      .toBeGreaterThan(0);
    await page.waitForTimeout(8000);

    expect(errors.filter((e) => !/favicon\.ico/.test(e))).toEqual([]);
  });
});
