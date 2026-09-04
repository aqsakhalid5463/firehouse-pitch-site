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
  // The partners come back as the integrations band, but only as
  // names in a band — not as the paragraphs of claims the removed
  // section made about them.
  expect(text).toContain('Ford Pro');
  expect(text).not.toContain("Every truck in the fleet runs on Ford Pro");
  expect(text).not.toContain('Our sister company handles what comes after');
});

test('the integrations band names the partners and keeps moving', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/about');
  await page.locator('.preloader').waitFor({ state: 'detached', timeout: 20000 });

  const band = page.locator('[data-integrations]');
  await band.scrollIntoViewIfNeeded();
  await expect(band).toBeVisible();

  // The names reach the server HTML, once each for a reader — the
  // duplicate pass that makes the loop seamless is hidden from
  // assistive tech rather than read out twice.
  const spoken = await band
    .locator('[data-integrations-track]:not([aria-hidden="true"])')
    .innerText();
  for (const name of ['FIREHOUSE MOVERS', 'FORD PRO', '4 ALARM RESTORATION']) {
    expect(spoken).toContain(name);
  }
  expect(
    await band.locator('[data-integrations-track][aria-hidden="true"]').count(),
  ).toBe(1);

  // It is a band that moves; a static row of logos is the failure.
  // Measured in pixels per second rather than as movement at all,
  // because the first version crawled at about 22px/s and read as
  // stuck.
  const speed = await page.evaluate(async () => {
    const t = document.querySelector('[data-integrations-track]') as HTMLElement;
    const from = t.getBoundingClientRect().x;
    await new Promise((r) => setTimeout(r, 1000));
    return Math.abs(t.getBoundingClientRect().x - from);
  });
  expect(speed).toBeGreaterThan(40);
  expect(speed).toBeLessThan(110);

  // One pass must be wider than the screen, or the band runs out
  // before the next pass arrives and leaves a bare stretch at the
  // right-hand edge — which is exactly what three partners did on a
  // desktop.
  const widths = await page.evaluate(() => ({
    pass: Math.round(
      document
        .querySelector('[data-integrations-track]')!
        .getBoundingClientRect().width,
    ),
    viewport: window.innerWidth,
  }));
  expect(widths.pass).toBeGreaterThan(widths.viewport);

  // And nothing is ever missing from the right-hand edge as it loops.
  const bare = await page.evaluate(async () => {
    const band = document.querySelector('[data-integrations]')!;
    let empty = 0;
    for (let i = 0; i < 25; i += 1) {
      const box = band.getBoundingClientRect();
      const items = [
        ...band.querySelectorAll('[data-integrations-track] > span'),
      ];
      const covered = items.some((el) => {
        const r = el.getBoundingClientRect();
        return r.left < box.right && r.right > box.right - 240;
      });
      if (!covered) empty += 1;
      await new Promise((r) => setTimeout(r, 100));
    }
    return empty;
  });
  expect(bare).toBe(0);

  // Opaque, or the 3D road behind it draws through the logos.
  const bg = await band.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).not.toContain('rgba(0, 0, 0, 0)');
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

test('content travels away down the road as it scrolls out of view', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/about');
  await page.locator('.preloader').waitFor({ state: 'detached', timeout: 20000 });
  await page.waitForTimeout(1000);

  // Everything that rides the road, with where it is and what has been
  // done to it. Scale is read off the computed matrix rather than the
  // inline string, so this tests what the browser actually applied.
  const sample = () =>
    page.evaluate(() => {
      const vh = window.innerHeight;
      return [...document.querySelectorAll<HTMLElement>('[data-route-rider]')]
        .map((el) => {
          const r = el.getBoundingClientRect();
          const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
          return {
            centre: r.top + r.height / 2,
            scale: m.a,
            dx: m.e,
            dy: m.f,
            opacity: Number(getComputedStyle(el).opacity),
            vh,
          };
        })
        .filter((r) => r.centre > -400 && r.centre < vh + 400);
    });

  let receding: Awaited<ReturnType<typeof sample>>[number] | undefined;
  let settled: Awaited<ReturnType<typeof sample>>[number] | undefined;

  for (let step = 0; step < 14 && !(receding && settled); step += 1) {
    for (const r of await sample()) {
      // Well up the screen: should be smaller, dimmer, and pulled away.
      if (r.centre < r.vh * 0.35 && r.centre > 0 && !receding) receding = r;
      // Down in the reading band: must be untouched, or the copy would
      // be distorted exactly where someone is trying to read it.
      if (r.centre > r.vh * 0.75 && !settled) settled = r;
    }
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(120);
  }

  expect(settled).toBeDefined();
  expect(settled!.scale).toBeCloseTo(1, 2);
  expect(settled!.opacity).toBeCloseTo(1, 2);

  expect(receding).toBeDefined();
  // Smaller and dimmer, and displaced — a block that only shrank in
  // place would read as a zoom, not as distance.
  expect(receding!.scale).toBeLessThan(0.95);
  expect(receding!.opacity).toBeLessThan(0.85);
  expect(Math.abs(receding!.dx) + Math.abs(receding!.dy)).toBeGreaterThan(8);
  // Still legible on its way out rather than blanked at the horizon,
  // which left whole viewports with nothing on them.
  expect(receding!.opacity).toBeGreaterThan(0.02);
});

test('the road reports a horizon for the page to aim at', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/about');
  await page.locator('.preloader').waitFor({ state: 'detached', timeout: 20000 });
  await page.waitForTimeout(1200);

  // The recession aims at the 3D road's actual vanishing point, which
  // moves as the About camera travels its spline. If the scene stopped
  // publishing it the effect would silently fall back to a constant, so
  // this checks the displacement really does point at a horizon that is
  // on screen and above the copy.
  const aim = await page.evaluate(() => {
    const els = [...document.querySelectorAll<HTMLElement>('[data-route-rider]')];
    const moved = els
      .map((el) => {
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        const r = el.getBoundingClientRect();
        return { m, r };
      })
      .filter((e) => e.m.a < 0.99 && Math.abs(e.m.f) > 1);
    if (!moved.length) return null;
    // Solve back for the point the block is being pulled toward.
    const { m, r } = moved[0];
    const cy = r.top + r.height / 2;
    return { horizonY: cy + m.f / (1 - m.a), viewport: window.innerHeight };
  });

  if (aim) {
    expect(aim.horizonY).toBeGreaterThan(0);
    expect(aim.horizonY).toBeLessThan(aim.viewport * 0.75);
  }
});
