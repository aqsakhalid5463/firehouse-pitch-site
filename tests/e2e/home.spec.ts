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
  // not doing anything. Sampled repeatedly rather than once: a single
  // snapshot can land on a stretch of page with no heading in the
  // viewport at all (which is how this read -Infinity when the Manifesto
  // section moved to About), which says nothing about the effect.
  const during = await Promise.all([
    (async () => {
      for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 900);
    })(),
    (async () => {
      const seen: number[] = [];
      for (let i = 0; i < 8; i++) {
        await page.waitForTimeout(80);
        seen.push(...(await skews()));
      }
      return seen;
    })(),
  ]).then((r) => r[1]);
  expect(during.length).toBeGreaterThan(0);
  expect(Math.max(...during.map(Math.abs))).toBeGreaterThan(0.5);
  // ...but never past the clamp, which is what keeps it readable.
  expect(Math.max(...during.map(Math.abs))).toBeLessThanOrEqual(5.01);

  // The spring targets zero, so a heading is never left crooked. This is
  // the whole reason the lean is safe at a visible amplitude.
  await page.waitForTimeout(2500);
  for (const s of await skews()) expect(Math.abs(s)).toBeLessThan(0.01);
});

// The three process steps hand a spotlight along as the truck works:
// each swells while it is the live beat and settles back as the next one
// takes over. Asserting the *ordering* of the peaks rather than exact
// values keeps this robust to retuning the windows.
test('the process steps hand the spotlight along in order', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('.preloader').waitFor({ state: 'detached', timeout: 20000 });

  const scales = () =>
    page.evaluate(() =>
      // Scoped to the pinned set-piece: `data-step` is also used by the
      // standalone Process section further down the page.
      [...document.querySelectorAll('[data-opening-steps] [data-step]')].map((el) => {
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        return m.a;
      }),
    );

  // Peak scale reached by each step across the whole pinned set-piece.
  const peaks = [0, 0, 0];
  const leaders: number[] = [];
  for (let i = 0; i < 90; i++) {
    await page.mouse.wheel(0, 220);
    await page.waitForTimeout(30);
    const s = await scales();
    if (s.length !== 3) continue;
    s.forEach((v, j) => (peaks[j] = Math.max(peaks[j], v)));
    const lead = s.indexOf(Math.max(...s));
    // A swelled step must never grow into its neighbour's column.
    const boxes = await page.evaluate(() =>
      [...document.querySelectorAll('[data-opening-steps] [data-step]')].map((el) => {
        const r = el.getBoundingClientRect();
        return [r.left, r.right];
      }),
    );
    for (let k = 0; k < boxes.length - 1; k++) {
      expect(boxes[k][1]).toBeLessThanOrEqual(boxes[k + 1][0]);
    }
    // Only record a leader once something is actually enlarged, so the
    // flat stretch before the steps arrive doesn't count as step 0.
    if (Math.max(...s) > 1.02 && leaders.at(-1) !== lead) leaders.push(lead);
  }

  // Every step gets its turn at being enlarged.
  for (const p of peaks) expect(p).toBeGreaterThan(1.05);
  // The swell is large enough to be worth the name.
  expect(Math.max(...peaks)).toBeGreaterThan(1.25);
  // And they take those turns in order, never skipping or going back.
  expect(leaders).toEqual([...leaders].sort((a, b) => a - b));
  expect(leaders[0]).toBe(0);
  expect(leaders.at(-1)).toBe(2);

  // Once the set-piece is over, every step is back at rest — including
  // the last one, which has no successor to hand the spotlight to and so
  // is released by a trailing window instead.
  for (let i = 0; i < 30; i++) {
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(20);
  }
  await page.waitForTimeout(400);
  for (const v of await scales()) expect(v).toBeLessThan(1.01);
});

// The heading entrance replays every time a heading comes back into
// view. It used to be a one-shot: scrolling up and back down showed
// nothing, and a heading passed quickly was missed for the rest of the
// session.
test('heading entrances replay on a second visit', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('.preloader').waitFor({ state: 'detached', timeout: 20000 });

  // True while any on-screen character is still mid-flip (i.e. carrying
  // a transform that is not the identity it settles on).
  const midFlip = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-char]')].some((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return false;
        // Opacity, not transform: a settled character keeps an inline
        // 3D transform matrix that is visually identity but does not
        // compare equal to one, so transform would report every
        // finished heading as still animating.
        return Number(getComputedStyle(el).opacity) < 0.99;
      }),
    );

  const down = async (n: number, dy = 400) => {
    for (let i = 0; i < n; i++) {
      await page.mouse.wheel(0, dy);
      await page.waitForTimeout(20);
    }
  };

  await down(22);
  await page.waitForTimeout(200);
  expect(await midFlip()).toBe(true);

  // Let everything settle, then leave and come back.
  await page.waitForTimeout(1500);
  await down(12, -400);
  await page.waitForTimeout(600);
  await down(12);
  await page.waitForTimeout(120);
  expect(await midFlip()).toBe(true);
});

// Service cards tilt toward the cursor, lift, and push the photograph
// the opposite way inside the frame. The pair matters: tilt alone reads
// as a rotating rectangle, the counter-push is what sells it as depth.
test('service cards tilt toward the cursor and settle back flat', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('.preloader').waitFor({ state: 'detached', timeout: 20000 });

  const card = page.locator('article.group').first();
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  const frame = card.locator('div').first();
  const image = card.locator('img');

  // A 3D rotation shows up as the off-diagonal terms of the matrix; at
  // rest they are zero.
  const tilt = async () =>
    frame.evaluate((el) => {
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      return Math.abs(m.m13) + Math.abs(m.m23);
    });

  expect(await tilt()).toBeLessThan(0.005);

  const b = (await frame.boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.85, b.y + b.height * 0.2);
  await page.waitForTimeout(500);
  expect(await tilt()).toBeGreaterThan(0.03);
  // The photograph moves against the tilt rather than with it.
  const pushed = await image.evaluate((el) => (el as HTMLElement).style.transform);
  expect(pushed).toMatch(/translate3d\(-\d/);

  // And it returns to flat when the pointer leaves, so a card is never
  // left stuck at an angle.
  await page.mouse.move(5, 5);
  await page.waitForTimeout(1200);
  expect(await tilt()).toBeLessThan(0.01);
});

// Hovering a service card rolls each title word up and replaces it with
// a red copy of itself, staggered along the line.
test('service card titles roll over to red on hover', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('.preloader').waitFor({ state: 'detached', timeout: 20000 });

  const card = page.locator('article.group').first();
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  // How far each word's roller has travelled, as a fraction of a line.
  const rolled = () =>
    card.evaluate((el) =>
      // Tailwind v4's translate utilities set the standalone `translate`
      // property, not `transform` — reading `transform` here reports
      // "none" on a fully rolled word.
      [...el.querySelectorAll('h3 [data-card-word] > span')].map((s) => {
        const t = getComputedStyle(s).translate;
        const y = t === 'none' ? 0 : parseFloat(t.split(' ')[1] ?? '0');
        return Math.abs(y) / (s as HTMLElement).offsetHeight;
      }),
    );

  for (const r of await rolled()) expect(r).toBeLessThan(0.02);

  const b = (await card.locator('div').first().boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(900);
  // Fully swapped: every word has travelled a whole line.
  for (const r of await rolled()) expect(r).toBeGreaterThan(0.9);

  await page.mouse.move(5, 5);
  await page.waitForTimeout(900);
  for (const r of await rolled()) expect(r).toBeLessThan(0.02);
});

// The ribbon's road is routed through the centre of every service
// photograph, and the truck stays pinned to the middle of the screen
// however sideways the road is running locally.
test('the ribbon visits every card and keeps the truck centred', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('.preloader').waitFor({ state: 'detached', timeout: 20000 });
  await page.waitForTimeout(1200);

  // Every checkpoint should have road passing close to its centre.
  const misses = await page.evaluate(() => {
    const svg = document.querySelector('div[aria-hidden="true"] > svg');
    const path = svg?.querySelector('path');
    if (!path) return [-1];
    const box = svg!.getBoundingClientRect();
    const len = path.getTotalLength();
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 900; i++) pts.push(path.getPointAtLength((i / 900) * len));
    return [...document.querySelectorAll('[data-ribbon-checkpoint]')].map((el) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2 - box.left;
      const cy = r.top + r.height / 2 - box.top;
      return Math.min(...pts.map((p) => Math.hypot(p.x - cx, p.y - cy)));
    });
  });
  expect(misses.length).toBeGreaterThan(1);
  // One card per row, not both: threading through both centres of a
  // side-by-side pair is geometrically a hairpin (see Ribbon.tsx), so
  // the route visits one and swings past the other. Every row must be
  // visited, and the visited card must be genuinely through its centre.
  const rows: number[][] = [];
  misses.forEach((m, i) => {
    if (i % 2 === 0) rows.push([m]);
    else rows[rows.length - 1].push(m);
  });
  for (const row of rows) expect(Math.min(...row)).toBeLessThan(40);

  // No hairpins: the sharpest turn anywhere on the road, measured over
  // 8px of arc. A corner sharp enough to see reads as a kink in a road
  // a truck is supposed to be driving — the first loop version peaked at
  // ~55 degrees here, which is a 4px turning radius.
  const worstTurn = await page.evaluate(() => {
    const path = document.querySelector(
      'div[aria-hidden="true"] > svg path',
    ) as SVGPathElement | null;
    if (!path) return 999;
    const len = path.getTotalLength();
    const n = Math.floor(len / 8);
    const pts = Array.from({ length: n + 1 }, (_, i) =>
      path.getPointAtLength((i / n) * len),
    );
    let worst = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const a1 = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
      const a2 = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
      const d =
        (Math.abs(((a2 - a1 + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * 180) /
        Math.PI;
      worst = Math.max(worst, d);
    }
    return worst;
  });
  expect(worstTurn).toBeLessThan(20);

  // And the truck tracks the middle of the screen while the road is
  // being driven, rather than racing ahead on the sideways stretches.
  const truckY = () =>
    page.evaluate(() => {
      const g = document.querySelector(
        'div[aria-hidden="true"] > svg g[style]',
      ) as SVGGElement | null;
      if (!g || g.style.opacity === '0') return null;
      const r = g.getBoundingClientRect();
      return r.y + r.height / 2;
    });

  // Scrolled at a reading pace and given time to settle: the truck is
  // deliberately speed-capped (it drives rather than teleports), so a
  // burst of fast wheel events legitimately leaves it behind for a
  // second or two while it catches up.
  const seen: number[] = [];
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(2000);
    const y = await truckY();
    if (y !== null) seen.push(y);
  }
  expect(seen.length).toBeGreaterThan(1);
  // Generous, because the truck deliberately chases its target rather
  // than snapping to it — but nothing like the thousands of pixels a
  // stale path mapping produced.
  for (const y of seen) expect(Math.abs(y - 450)).toBeLessThan(320);
});
