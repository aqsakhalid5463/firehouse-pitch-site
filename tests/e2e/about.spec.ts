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
  // Nor may any of the removed sections.
  expect(text).not.toContain('What you actually get');
  expect(text).not.toContain('Credentials that matter on moving day');
  expect(text).not.toContain('Who stands behind the move');
  // The partner claims are the ones that most need to stay gone: they
  // assert a relationship with a named third party.
  expect(text).not.toContain('Ford Pro');
  expect(text).not.toContain('4 Alarm Restoration');
});

test('about carries no ribbon road', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/about');
  await page.locator('.preloader').waitFor({ state: 'detached', timeout: 20000 });
  // Given time to mount: the roads are built in an effect after the
  // zones are measured, so an immediate check would pass even if the
  // ribbon were still there.
  await page.waitForTimeout(1500);
  expect(await page.locator('[data-ribbon-road]').count()).toBe(0);
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

// About's sub-headings (the pillars) were plain <h3> elements while
// every h2 on the page animated, so the page went flat below each
// section title. They now run the same
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

  // Polled rather than sampled once.
  //
  // A single reading 150ms after the scroll passed alone and failed in
  // the full run, which is the signature of a race and not of a broken
  // animation: the entrance lasts well under a second, so one
  // instantaneous look can land before it starts or after it finishes
  // depending on how loaded the machine is. Polling asks the only
  // question that matters — was this heading ever seen mid-flight —
  // and cannot be lost between two samples.
  const catchAnimation = async () =>
    expect
      .poll(midFlip, { timeout: 3000, intervals: [30] })
      .toBe(true);

  const clicks = Math.max(1, Math.round((firstBand - 400) / 400));
  await wheel(clicks, 400);
  await catchAnimation();

  // And it replays: away, back, and animating again.
  await page.waitForTimeout(1200);
  await wheel(5, -400);
  await page.waitForTimeout(600);
  await wheel(5, 400);
  await catchAnimation();
});

test('the copy rides the route: it moves sideways as you scroll', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/about');
  await page.locator('.preloader').waitFor({ state: 'detached', timeout: 20000 });
  await page.waitForTimeout(800);

  await expect(page.locator('[data-route-spine]')).toHaveCount(1);

  // Follow one block down the page and record where it sits.
  const rider = page.locator('[data-route-rider]').nth(2);
  // Sampled every 200px of scroll. The first version sampled every
  // 800px, which is far too coarse to say anything about smoothness:
  // at that spacing a single interval legitimately covers most of a
  // bend, and the test failed a glide for looking like a jump.
  const xs: number[] = [];
  for (let step = 0; step < 18; step += 1) {
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(90);
    const box = await rider.boundingBox();
    if (box) xs.push(box.x);
  }

  expect(xs.length).toBeGreaterThan(12);
  const travel = Math.max(...xs) - Math.min(...xs);
  // It genuinely travels sideways, and by an amount you would notice —
  // a static curved layout would give zero here, which is the failure
  // mode this is guarding against.
  expect(travel).toBeGreaterThan(30);

  // And it is a glide, not a jump: no single scroll step may throw the
  // block across the page.
  const steps = xs.slice(1).map((x, i) => Math.abs(x - xs[i]));
  expect(Math.max(...steps)).toBeLessThan(travel * 0.5);
});

test('the route runs in the margin and never crosses the copy', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/about');
  await page.locator('.preloader').waitFor({ state: 'detached', timeout: 20000 });
  await page.waitForTimeout(800);

  const clearance = await page.evaluate(() => {
    const svg = document.querySelector('[data-route-spine] svg');
    const path = svg?.querySelector('path') as SVGPathElement | null;
    if (!path) return null;
    const len = path.getTotalLength();
    let widest = 0;
    for (let i = 0; i <= 400; i += 1) {
      widest = Math.max(widest, path.getPointAtLength((i / 400) * len).x);
    }
    // Left edge of the narrowest content column on the page.
    const column = document.querySelector('[data-route-rider]');
    const left = column ? column.getBoundingClientRect().left : 0;
    return { widest, left };
  });

  expect(clearance).not.toBeNull();
  // The whole reason the road moved to the margin: the copy rides it
  // rather than being crossed by it. The road's furthest reach right
  // must still clear the content column.
  expect(clearance!.widest).toBeLessThan(clearance!.left);
});
