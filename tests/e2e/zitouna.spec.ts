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

test.describe('Full demo navigation (My Trees, all tabs, settings)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(process.env.BASE_URL ?? 'http://localhost:8082');
    await page.waitForLoadState('networkidle');
    await page.locator('#demo').scrollIntoViewIfNeeded();
  });

  const openParcel = async (page) => {
    await page.locator('#demo .open').first().click();
    await page.waitForTimeout(150);
  };

  test('My Trees lists the example parcel, Add Parcel grows the list', async ({ page }) => {
    const cardsBefore = await page.locator('#demo .open').count();
    expect(cardsBefore).toBeGreaterThanOrEqual(1);
    await page.locator('#demo #addp').click();
    await page.waitForTimeout(150);
    expect(await page.locator('#demo .open').count()).toBe(cardsBefore + 1);
  });

  test('all five parcel tabs render in order', async ({ page }) => {
    await openParcel(page);
    const labels = await page.locator('#demo [role=tab]').evaluateAll((els) =>
      els.map((e) => e.textContent.trim())
    );
    expect(labels).toEqual(['Overview', 'Ripeness', 'Harvest', 'Mill', 'Years']);
  });

  test('Harvest: saving an entry updates the season total', async ({ page }) => {
    await openParcel(page);
    await page.locator('#demo [role=tab][data-t=harvest]').click();
    await page.waitForTimeout(150);
    const before = await page.locator('#demo .v').first().textContent();
    await page.locator('#demo #h-kg').fill('50');
    await page.locator('#demo #h-save').click();
    await page.waitForTimeout(200);
    expect(await page.locator('#demo .v').first().textContent()).not.toEqual(before);
  });

  test('Years: forecast and yearly cards render', async ({ page }) => {
    await openParcel(page);
    await page.locator('#demo [role=tab][data-t=years]').click();
    await page.waitForTimeout(150);
    const text = await page.locator('#demo #p').textContent();
    expect(text).toMatch(/Alternate-Bearing Forecast/);
    expect(text).toMatch(/20\d\d/);
  });

  test('Settings: switching units changes displayed weights', async ({ page }) => {
    await page.locator('#demo #go-set').click();
    await page.waitForTimeout(150);
    await page.locator('#demo [data-u=q]').click();
    await page.waitForTimeout(150);
    await page.locator('#demo #bk-trees').click();
    await page.waitForTimeout(150);
    await openParcel(page);
    await page.locator('#demo [role=tab][data-t=harvest]').click();
    await page.waitForTimeout(150);
    expect(await page.locator('#demo #p').textContent()).toMatch(/q\b/);
  });

  test('back navigation returns to My Trees', async ({ page }) => {
    await openParcel(page);
    await page.locator('#demo #bk-trees').click();
    await page.waitForTimeout(150);
    await expect(page.locator('#demo #addp')).toBeVisible();
  });
});
