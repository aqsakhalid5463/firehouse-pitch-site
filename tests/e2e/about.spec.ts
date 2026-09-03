import { test, expect } from '@playwright/test';

/**
 * Server HTML with tags removed and whitespace collapsed.
 *
 * RevealText wraps every word of a heading in its own span so it can
 * stagger them in, which means a heading never appears in the markup as
 * one contiguous string. Asserting on raw HTML therefore fails for text
 * that is genuinely present and readable without JavaScript; stripping
 * the tags first tests what a reader (or a crawler) actually gets.
 */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ');
}

test('about page renders its story and credentials in server HTML', async ({
  request,
}) => {
  const text = visibleText(await (await request.get('/about')).text());
  expect(text).toContain('The moving service we needed, so we built it for you');
  expect(text).toContain('What Firehouse actually is');
  expect(text).toContain('Federally licensed');
  expect(text).toContain('(972) 992-1969');
  // The public registrations should reach the server HTML, since the
  // licensing claims above are only checkable because of them.
  expect(text).toContain('USDOT 1939062');
  // The invented founding story must not come back.
  expect(text).not.toContain('one truck, one crew');
});

test('about page loads with no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/about');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});

test('nav links move between the two pages', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'About' }).first().click();
  await expect(page).toHaveURL(/\/about$/);
  await page.getByRole('link', { name: 'Home' }).first().click();
  await expect(page).toHaveURL(/\/$/);
});

// About's sub-headings (the pillars, the value cards, the credentials)
// were plain <h3> elements while every h2 on the page animated, so the
// page went flat below each section title. They now run the same
// per-character entrance, which — like every heading — replays whenever
// it comes back into view.
test('about sub-headings animate and replay', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/about');

  const midFlip = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('h3 [data-char]')].some((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return false;
        // Opacity, not transform: a settled character keeps an inline
        // 3D transform matrix that is visually identity but does not
        // compare equal to one, so transform would report every
        // finished heading as still animating.
        return Number(getComputedStyle(el).opacity) < 0.99;
      }),
    );

  const wheel = async (n: number, dy: number) => {
    for (let i = 0; i < n; i++) {
      await page.mouse.wheel(0, dy);
      await page.waitForTimeout(20);
    }
  };

  // The h3 bands (pillars, then value cards, then credentials) sit
  // roughly 1200-3600px down at this viewport.
  await wheel(8, 400);
  await page.waitForTimeout(150);
  expect(await midFlip()).toBe(true);

  await page.waitForTimeout(1500);
  await wheel(5, -400);
  await page.waitForTimeout(600);
  await wheel(5, 400);
  await page.waitForTimeout(120);
  expect(await midFlip()).toBe(true);
});
