import { test, expect } from '@playwright/test';

test('hero copy, CTA, and phone number are in the server HTML', async ({
  request,
}) => {
  const res = await request.get('/');
  const html = await res.text();
  expect(html).toContain('The moving service we needed');
  expect(html).toContain('(972) 992-1969');
  expect(html).toContain('tel:+19729921969');
  expect(html).toContain('Get a Quote');
});

test('home page renders with no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});

test('footer carries the real contact details', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toContain('2535-B Texas 121 E, State #140, Lewisville, TX 75056');
  expect(html).toContain('support@firehousemovers.com');
  expect(html).toContain('Firehouse Movers Inc.');
});

test('all six service names are in the server HTML', async ({ request }) => {
  const html = await (await request.get('/')).text();
  for (const name of [
    'Local Moving',
    'Long-Distance',
    'Residential',
    'Commercial',
    'Packing',
    'Storage',
  ]) {
    expect(html).toContain(name);
  }
});

test('the preloader lifts and hands the page back', async ({ page }) => {
  await page.goto('/');
  const preloader = page.locator('.preloader');

  // It must be in the server HTML, or the page flashes before the
  // curtain arrives.
  const html = await (await page.request.get('/')).text();
  expect(html).toContain('class="preloader');

  await expect(preloader).toHaveCount(0, { timeout: 15000 });
  // The lock is released by an effect keyed on completion, not by an
  // unmount cleanup — the component stays mounted and renders null.
  await expect(page.locator('html')).not.toHaveClass(/is-loading/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

// The nav is a fixed 94px-tall scrim. On a short window the hero copy is
// taller than its grid row, and ordinary centring split that overflow
// evenly — sliding the top line up behind the scrim's gradient and
// backdrop-blur, where it read as "hidden". The eyebrow that used to be
// that top line was removed in round 21, so the headline is now what has
// to clear the nav. Guard every band that regressed, not just the one
// that was reported.
for (const [w, h] of [
  [1512, 700],
  [1280, 800],
  [1440, 900],
  [1600, 950],
] as const) {
  test(`hero copy clears the nav at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    await page.locator('.preloader').waitFor({ state: 'detached', timeout: 20000 });

    const box = async (loc: import('@playwright/test').Locator) => {
      const b = await loc.boundingBox();
      if (!b) throw new Error('no box');
      return b;
    };
    const nav = await box(page.locator('header').first());
    const headline = await box(page.getByRole('heading', { level: 1 }));
    const cta = await box(page.getByRole('link', { name: 'Get a Quote' }));

    expect(headline.y).toBeGreaterThan(nav.y + nav.height);
    expect(cta.y + cta.height).toBeLessThan(h);

    // The section marker is dropped on short windows rather than being
    // allowed to collide with the overflowing copy.
    const marker = page.locator('p', { hasText: /^Move as One$/ });
    if (await marker.isVisible()) {
      const m = await box(marker);
      expect(m.y).toBeGreaterThan(cta.y + cta.height);
    }
  });
}

test('headings lean into a scroll and settle back straight', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('.preloader').waitFor({ state: 'detached', timeout: 20000 });
  await page.waitForTimeout(400);

  const skews = () =>
    page.evaluate(() => {
      const out: number[] = [];
      for (const h of document.querySelectorAll('h1,h2')) {
        const r = h.getBoundingClientRect();
        if (r.bottom < -100 || r.top > window.innerHeight + 100) continue;
        const m = new DOMMatrixReadOnly(getComputedStyle(h).transform);
        out.push((Math.atan2(m.b, m.a) * 180) / Math.PI);
      }
      return out;
    });

  for (let i = 0; i < 14; i++) {
    await page.mouse.wheel(0, 260);
    await page.waitForTimeout(60);
  }

  // Mid-flick the heading should actually be leaning, or the effect is
  // not doing anything.
  const during = await Promise.all([
    (async () => {
      for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 900);
    })(),
    (async () => {
      await page.waitForTimeout(120);
      return skews();
    })(),
  ]).then((r) => r[1]);
  expect(Math.max(...during.map(Math.abs))).toBeGreaterThan(0.5);
  // ...but never past the clamp, which is what keeps it readable.
  expect(Math.max(...during.map(Math.abs))).toBeLessThanOrEqual(5.01);

  // The spring targets zero, so a heading is never left crooked. This is
  // the whole reason the lean is safe at a visible amplitude.
  await page.waitForTimeout(2500);
  for (const s of await skews()) expect(Math.abs(s)).toBeLessThan(0.01);
});
