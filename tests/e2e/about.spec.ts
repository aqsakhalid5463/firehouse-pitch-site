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

test('about page renders its copy and registrations in server HTML', async ({
  request,
}) => {
  const text = visibleText(await (await request.get('/about')).text());
  expect(text).toContain('The crew is the whole product.');
  expect(text).toContain('Why the firehouse model works.');
  expect(text).toContain('What Firehouse actually is');
  expect(text).toContain('Who stands behind the move.');
  expect(text).toContain('Fleet maintained with Ford Pro');
  expect(text).toContain('(972) 992-1969');
  // The registrations must reach the server HTML. They moved to the
  // footer when the credentials section was removed, and they are the
  // one claim on this site a visitor can independently check — an
  // interaction or a canvas decal is not crawlable or readable by
  // assistive tech, so they have to exist as plain text somewhere.
  expect(text).toContain('USDOT 1939062');
  expect(text).toContain('TXDMV 000570404B');
  // The invented founding story must not come back.
  expect(text).not.toContain('one truck, one crew');
  // Nor may the two removed sections.
  expect(text).not.toContain('What you actually get');
  expect(text).not.toContain('Credentials that matter on moving day');
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

// About's sub-headings (the pillars, then the network partners) were
// plain <h3> elements while every h2 on the page animated, so the page
// went flat below each section title. They now run the same
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

  // Driven off where the headings actually are rather than a fixed
  // scroll distance. The old version wheeled a magic 3200px, which
  // happened to land on an h3 band until two sections were removed from
  // the page and it silently stopped pointing at anything.
  const firstBand = await page.evaluate(() => {
    const el = document.querySelector('h3 [data-char]');
    if (!el) return -1;
    return el.getBoundingClientRect().top + window.scrollY;
  });
  expect(firstBand).toBeGreaterThan(0);

  const clicks = Math.max(1, Math.round((firstBand - 400) / 400));
  await wheel(clicks, 400);
  await page.waitForTimeout(150);
  expect(await midFlip()).toBe(true);

  await page.waitForTimeout(1500);
  await wheel(5, -400);
  await page.waitForTimeout(600);
  await wheel(5, 400);
  await page.waitForTimeout(120);
  expect(await midFlip()).toBe(true);
});
