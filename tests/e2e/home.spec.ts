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
  // The swell is large enough to be worth the name. The bar sits below
  // the real 1.5x peak because the sampling is discrete — a wheel step
  // can straddle the moment a step is at its largest.
  expect(Math.max(...peaks)).toBeGreaterThan(1.4);
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

  // A named heading rather than a scroll distance. This test used to
  // wheel a fixed number of times and assume something would be in
  // frame; the pinned process section changed the page's scroll map and
  // those positions started landing on empty space, which is a property
  // of the test, not of the animation.
  const heading = page.locator('h2', { hasText: 'Everything a move needs' });

  const onScreen = () =>
    heading.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom > 40 && r.top < window.innerHeight - 40;
    });

  const wheelUntil = async (want: boolean, dy: number) => {
    for (let i = 0; i < 60; i++) {
      if ((await onScreen()) === want) return true;
      await page.mouse.wheel(0, dy);
      await page.waitForTimeout(30);
    }
    return false;
  };

  // True while any of this heading's characters is still mid-entrance.
  const midFlip = () =>
    heading.evaluate((el) =>
      [...el.querySelectorAll('[data-char]')].some(
        (c) => Number(getComputedStyle(c).opacity) < 0.99,
      ),
    );

  expect(await wheelUntil(true, 400)).toBe(true);
  await page.waitForTimeout(120);
  expect(await midFlip()).toBe(true);

  // Let it finish, scroll it out of view, then bring it back.
  await page.waitForTimeout(1600);
  expect(await midFlip()).toBe(false);

  expect(await wheelUntil(false, -400)).toBe(true);
  await page.waitForTimeout(400);
  expect(await wheelUntil(true, 400)).toBe(true);
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
test('the ribbon visits every card and keeps the truck on screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('.preloader').waitFor({ state: 'detached', timeout: 20000 });
  // The roads mount only after the ribbon has measured its zones,
  // checkpoints and obstacles, and re-measures once more when fonts and
  // images have settled.
  await page.locator('[data-ribbon-road="zigzag"] svg').waitFor({ timeout: 10000 });
  await page.waitForTimeout(1200);

  // Every checkpoint should have road passing close to its centre.
  const misses = await page.evaluate(() => {
    // The checkpoints all live in the zig-zag stretch, which is now one
    // of several separate roads rather than the single page-long path.
    const svg = document.querySelector('[data-ribbon-road="zigzag"] svg');
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
      '[data-ribbon-road="zigzag"] svg path',
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

  // And the truck stays on screen while the road is being driven.
  //
  // This used to assert it stayed near the middle, because it was
  // positioned by solving for the arc length level with the viewport
  // centre. That is what made its speed wrong — through a bend, a few
  // pixels of scroll are hundreds of pixels of road, so it bolted
  // through every turn. It is now driven by arc length proportional to
  // scroll, which is even by construction and drifts off centre instead;
  // on screen is the property that still matters.
  const truckY = () =>
    page.evaluate(() => {
      // Whichever stretch is currently being driven: only one truck can
      // be visible at a time, because the zones do not overlap.
      const g = [
        ...document.querySelectorAll<SVGGElement>('[data-ribbon-road] svg g[style]'),
      ].find((n) => n.style.opacity !== '0' && n.style.opacity !== '');
      if (!g) return null;
      const r = g.getBoundingClientRect();
      return r.y + r.height / 2;
    });

  // Into the zig-zag stretch first. The road no longer runs the whole
  // page — it exists only inside its zones — so sampling from the top
  // spends most of its scroll in sections that deliberately have none.
  await page.evaluate(() => {
    const z = document.querySelector('[data-ribbon-zone="zigzag"]')!;
    window.scrollTo(0, z.getBoundingClientRect().top + window.scrollY - 200);
  });
  await page.waitForTimeout(1500);

  // Scrolled at a reading pace and given time to settle: the truck is
  // deliberately speed-capped (it drives rather than teleports), so a
  // burst of fast wheel events legitimately leaves it behind for a
  // second or two while it catches up.
  const seen: number[] = [];
  // Short bursts: the whole stretch is 2800px, so the old 1500px-per-
  // batch pace drove straight out the far end of it after one sample.
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 150);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(2000);
    const y = await truckY();
    if (y !== null) seen.push(y);
  }
  expect(seen.length).toBeGreaterThan(1);
  for (const y of seen) {
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(900);
  }
});

// Headings are white with their last word in red, and hovering swaps
// the whole line for a colour-inverted copy of itself — one gesture on
// the block, not forty on the characters.
test('headings swap as one body on hover', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('.preloader').waitFor({ state: 'detached', timeout: 20000 });
  await page.waitForTimeout(2500);

  const FIRE = 'rgb(226, 61, 40)';
  const INK = 'rgb(240, 240, 238)';

  const state = () =>
    page.evaluate(() => {
      const h1 = document.querySelector('h1')!;
      const chars = [...h1.querySelectorAll('[data-char]')];
      const style = (sel: string) => {
        const el = h1.querySelector(sel);
        return el ? Number(getComputedStyle(el).opacity) : -1;
      };
      return {
        primary: style('[data-roll]'),
        ghost: style('[data-roll-ghost]'),
        accent: chars
          .filter((c) => (c as HTMLElement).dataset.accent === '1')
          .map((c) => getComputedStyle(c).color),
        plain: chars
          .filter((c) => (c as HTMLElement).dataset.accent !== '1')
          .map((c) => getComputedStyle(c).color),
        // Letters stay upright and in place: the per-character scatter
        // this replaced rotated them to arbitrary angles.
        maxRotation: chars.reduce((max, c) => {
          const m = new DOMMatrixReadOnly(getComputedStyle(c).transform);
          return Math.max(max, Math.abs((Math.atan2(m.b, m.a) * 180) / Math.PI));
        }, 0),
      };
    });

  const rest = await state();
  expect(rest.primary).toBe(1);
  expect(rest.ghost).toBe(0);

  // The two halves must occupy identical space, or the heading visibly
  // closes up as it swaps — the ghost set on tighter leading than the
  // copy it replaces, because it was missing the word masks' padding.
  // Layout box, not the rendered rect: at rest the ghost is parked a
  // little below its resting place, so its rendered top is offset by
  // design. `offsetTop`/`offsetHeight` ignore the transform and compare
  // where the two actually sit in the layout.
  const boxes = await page.evaluate(() => {
    const h1 = document.querySelector('h1')!;
    const b = (sel: string) => {
      const el = h1.querySelector(sel) as HTMLElement;
      return [el.offsetHeight, el.offsetTop];
    };
    return { primary: b('[data-roll]'), ghost: b('[data-roll-ghost]') };
  });
  expect(boxes.ghost).toEqual(boxes.primary);
  expect(new Set(rest.accent)).toEqual(new Set([FIRE]));
  expect(new Set(rest.plain)).toEqual(new Set([INK]));

  const box = (await page.locator('h1').first().boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.35, box.y + 40);
  await page.waitForTimeout(650);

  const hovered = await state();
  expect(hovered.ghost).toBeGreaterThan(0.9);
  expect(hovered.primary).toBeLessThan(0.1);
  // The characters themselves never move: the whole line does.
  expect(hovered.maxRotation).toBeLessThan(0.5);

  await page.mouse.move(5, 5);
  await page.waitForTimeout(900);
  const settled = await state();
  expect(settled.primary).toBe(1);
  expect(settled.ghost).toBe(0);
});

// The process section pins and runs its six steps sideways, with the
// route rail filling and the truck driving along it.
test('the process section travels horizontally as you scroll', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('.preloader').waitFor({ state: 'detached', timeout: 20000 });
  await page.waitForTimeout(2000);

  const start = await page.evaluate(
    () =>
      document.querySelector('#process')!.getBoundingClientRect().top +
      window.scrollY,
  );
  const read = () =>
    page.evaluate(() => {
      const track = document.querySelector('#process [data-step]')!
        .parentElement as HTMLElement;
      const fill = document.querySelector(
        '#process [style*="scaleX"]',
      ) as HTMLElement | null;
      const heading = [
        ...document.querySelectorAll('#process h2 [data-char]'),
      ].map((c) => Number(getComputedStyle(c).opacity));
      return {
        x: new DOMMatrixReadOnly(getComputedStyle(track).transform).e,
        fill: fill
          ? new DOMMatrixReadOnly(getComputedStyle(fill).transform).a
          : -1,
        headingMin: heading.length ? Math.min(...heading) : -1,
      };
    });

  // Scroll to the top of the section.
  while ((await page.evaluate(() => window.scrollY)) < start + 150) {
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(45);
  }
  await page.waitForTimeout(1000);

  const early = await read();
  // The heading lives inside the pinned container; its entrance is
  // driven by an observer rather than scroll position for exactly this
  // reason, and it used to sit invisible in full view.
  expect(early.headingMin).toBeGreaterThan(0.9);

  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(800);

  const later = await read();
  // The track has travelled left and the rail has filled behind it.
  expect(later.x).toBeLessThan(early.x - 100);
  expect(later.fill).toBeGreaterThan(early.fill);
});

// Process cards lift toward the reader and tilt to the cursor, with
// their contents sitting at different depths inside the card.
test('process cards come forward on hover', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('.preloader').waitFor({ state: 'detached', timeout: 20000 });
  await page.waitForTimeout(2000);

  const start = await page.evaluate(
    () =>
      document.querySelector('#process')!.getBoundingClientRect().top +
      window.scrollY,
  );
  while ((await page.evaluate(() => window.scrollY)) < start + 200) {
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(45);
  }
  await page.waitForTimeout(900);

  // Whichever card is under the cursor: the track has travelled by now,
  // so a card's index says nothing about where it is on screen.
  const hovered = () =>
    page.evaluate(() => {
      const card = [...document.querySelectorAll('#process [data-step]')].find(
        (c) => c.matches(':hover'),
      );
      if (!card) return null;
      const m = new DOMMatrixReadOnly(getComputedStyle(card).transform);
      const layer = card.querySelector('[data-depth="-0.6"]') as HTMLElement;
      return {
        // Translation in Z: the card is genuinely closer, not just bigger.
        z: m.m43,
        tilt: Math.abs(m.m13) + Math.abs(m.m23),
        layerMoved: layer.style.transform !== '',
      };
    });

  await page.mouse.move(700, 480);
  await page.waitForTimeout(150);
  await page.mouse.move(880, 420);
  await page.waitForTimeout(800);

  const on = await hovered();
  expect(on).not.toBeNull();
  expect(on!.z).toBeGreaterThan(40);
  expect(on!.tilt).toBeGreaterThan(0.02);
  expect(on!.layerMoved).toBe(true);

  // And it settles back flat when the pointer leaves.
  await page.mouse.move(700, 120);
  await page.waitForTimeout(900);
  const flat = await page.evaluate(() => {
    const card = document.querySelectorAll('#process [data-step]')[3];
    const m = new DOMMatrixReadOnly(getComputedStyle(card).transform);
    return { z: Math.abs(m.m43), tilt: Math.abs(m.m13) + Math.abs(m.m23) };
  });
  expect(flat.z).toBeLessThan(1);
  expect(flat.tilt).toBeLessThan(0.005);
});

// The promises are dealt as a 3D stack: one card at the front, the rest
// at other depths, moving through the stack as you scroll — and back
// again when you scroll up.
test('the promise cards move through a 3D stack in both directions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('.preloader').waitFor({ state: 'detached', timeout: 20000 });
  await page.waitForTimeout(2000);

  const start = await page.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find((x) =>
      x.textContent?.includes('promises'),
    )!;
    return h.getBoundingClientRect().top + window.scrollY;
  });

  // Which card is at the front, and how much depth the stack is using.
  const stack = () =>
    page.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-stack-card]')];
      const z = cards.map(
        (c) => new DOMMatrixReadOnly(getComputedStyle(c).transform).m43,
      );
      const opacity = cards.map((c) => Number(getComputedStyle(c).opacity));
      // The front card is the visible one closest to z = 0.
      let front = -1;
      let best = Infinity;
      cards.forEach((_, i) => {
        if (opacity[i] < 0.5) return;
        if (Math.abs(z[i]) < best) {
          best = Math.abs(z[i]);
          front = i;
        }
      });
      return { front, spread: Math.max(...z) - Math.min(...z) };
    });

  while ((await page.evaluate(() => window.scrollY)) < start + 200) {
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(900);

  const first = await stack();
  // The cards occupy genuinely different depths, not one plane.
  expect(first.spread).toBeGreaterThan(200);

  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 320);
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(900);
  const advanced = await stack();
  expect(advanced.front).toBeGreaterThan(first.front);

  // And back up: the stack is not one-way.
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, -320);
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(1000);
  const back = await stack();
  expect(back.front).toBeLessThan(advanced.front);
});

test('the cursor leaves a tyre track that fades away', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(4000);

  const canvas = page.locator('canvas.cursor-trail');
  await expect(canvas).toHaveCount(1);

  // Count pixels the trail has actually inked, straight off the canvas —
  // the marks are drawn, not DOM, so there is nothing else to assert on.
  const ink = () =>
    page.evaluate(() => {
      const el = document.querySelector<HTMLCanvasElement>('canvas.cursor-trail');
      const ctx = el?.getContext('2d');
      if (!el || !ctx) return -1;
      const d = ctx.getImageData(0, 0, el.width, el.height).data;
      let lit = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 6) lit += 1;
      return lit;
    });

  expect(await ink()).toBe(0);

  // Drive the pointer across the page in small steps, which is what a
  // real mouse produces and what the per-frame drawing needs.
  for (let i = 0; i <= 40; i += 1) {
    await page.mouse.move(200 + i * 15, 500 + Math.sin(i / 6) * 90);
    await page.waitForTimeout(16);
  }

  const laid = await ink();
  expect(laid).toBeGreaterThan(200);

  // The track is bounded in length, not in time: scribbling continuously
  // must not fill the page up with overlapping tread. This is the whole
  // reason the fade has a distance term — see the component.
  const canvasArea = await page.evaluate(() => {
    const el = document.querySelector<HTMLCanvasElement>('canvas.cursor-trail')!;
    return el.width * el.height;
  });
  for (let i = 0; i < 200; i += 1) {
    const t = i / 4;
    await page.mouse.move(500 + Math.sin(t) * 280, 400 + Math.cos(t * 0.7) * 240);
    await page.waitForTimeout(16);
  }
  expect(await ink()).toBeLessThan(canvasArea * 0.02);

  // Left alone, the track fades out completely and the loop stops.
  await page.waitForTimeout(4000);
  expect(await ink()).toBe(0);
});

test('the preloader shutter rolls up on a composited transform', async ({
  page,
}) => {
  await page.goto('/');

  const shutterY = () =>
    page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('[data-curtain]');
      if (!el) return null;
      const s = getComputedStyle(el);
      // A clip-path opening would leave the transform at rest; only a
      // real translate can be run by the compositor, which is the whole
      // reason the exit is shaped this way.
      if (s.clipPath && s.clipPath !== 'none') return NaN;
      return Math.round(new DOMMatrixReadOnly(s.transform).m42);
    });

  const samples: number[] = [];
  for (let i = 0; i < 80; i += 1) {
    const v = await shutterY();
    if (v === null) break;
    expect(Number.isNaN(v)).toBe(false);
    samples.push(v);
    await page.waitForTimeout(50);
  }

  // It sat still, then travelled a full viewport upward, and never
  // reversed on the way.
  const moved = samples.filter((v) => v < -10);
  expect(moved.length).toBeGreaterThan(2);
  expect(Math.min(...samples)).toBeLessThan(-300);
  for (let i = 1; i < samples.length; i += 1) {
    expect(samples[i]).toBeLessThanOrEqual(samples[i - 1] + 1);
  }

  await expect(page.locator('.preloader')).toHaveCount(0);
});

test('the road exists only in its zones and routes around copy', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('.preloader').waitFor({ state: 'detached', timeout: 20000 });
  await page.locator('[data-ribbon-road]').first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(1500);

  const zones = await page
    .locator('[data-ribbon-zone]')
    .evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLElement).dataset.ribbonZone),
    );
  // Three stretches of road, and the two pinned sections between them
  // deliberately have none — the truck leaves and turns up again later.
  expect(zones).toEqual(['zigzag', 'circles', 'drift']);
  await expect(page.locator('#process[data-ribbon-zone]')).toHaveCount(0);

  const road = await page.evaluate(() => {
    const scope = document.querySelector('main .relative.z-10')!;
    const hosts = [...scope.querySelectorAll('[data-ribbon-road]')];
    const boxes = [
      ...scope.querySelectorAll<HTMLElement>('h1,h2,h3,p,blockquote'),
    ]
      .filter(
        (n) =>
          !n.closest('[data-ribbon-checkpoint]') &&
          !n.closest('article:has([data-ribbon-checkpoint])'),
      )
      .map((n) => n.getBoundingClientRect())
      .filter((r) => r.width >= 80 && r.height >= 12);

    let total = 0;
    let hit = 0;

    for (const host of hosts) {
      const path = host.querySelector('svg path') as SVGPathElement;
      const hb = host.getBoundingClientRect();
      const len = path.getTotalLength();
      for (let i = 0; i <= 300; i += 1) {
        const p = path.getPointAtLength((i / 300) * len);
        const x = hb.left + p.x;
        const y = hb.top + p.y;
        // Each stretch clips to its own band, so path points outside it
        // are never painted and must not be counted as crossings.
        if (p.x < 0 || p.x > hb.width || p.y < 0 || p.y > hb.height) continue;
        total += 1;
        if (
          boxes.some(
            (r) => x > r.left && x < r.right && y > r.top && y < r.bottom,
          )
        )
          hit += 1;
      }
    }
    return { roads: hosts.length, total, hit };
  });

  expect(road.roads).toBe(3);
  // The road gives way to copy rather than crossing it. Not zero: it
  // passes through the service photographs by design, and their titles
  // sit directly beneath them; a headline spanning the full width also
  // leaves nowhere to go, and crossing one square-on is the intended
  // fallback — the closing headline is four lines wide and the corridor
  // above it is shorter than the walk's own step.
  //
  // Copy inside a service card is excluded above, because the road is
  // routed through those cards deliberately and their titles sit
  // directly beneath the photograph it visits; counting those measured
  // the design as a defect. On everything else: measured at 6.5%, and
  // zero across the whole run of service photographs. This guards the
  // mechanism, not the exact route, which is free to change with the
  // copy.
  expect(road.hit / road.total).toBeLessThan(0.075);
});

test('the truck drives at a consistent speed through bends and loops', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('.preloader').waitFor({ state: 'detached', timeout: 20000 });
  await page.locator('[data-ribbon-road="circles"]').waitFor({ timeout: 10000 });

  // The circling stretch, because it is the hard case: a loop covers
  // hundreds of pixels of road in almost no page height.
  const top = await page.evaluate(
    () =>
      document.querySelector('[data-ribbon-zone="circles"]')!.getBoundingClientRect()
        .top + window.scrollY,
  );

  // How far along the road the truck is, in path pixels, found by
  // matching its drawn position back to the path.
  const arc = () =>
    page.evaluate(() => {
      const host = document.querySelector('[data-ribbon-road="circles"]')!;
      const path = host.querySelector('svg path') as SVGPathElement;
      const g = host.querySelector('svg g[style]') as SVGGElement;
      const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(
        g.getAttribute('transform') || '',
      );
      if (!m) return null;
      const tx = +m[1];
      const ty = +m[2];
      const len = path.getTotalLength();
      let best = 0;
      let bd = Infinity;
      for (let i = 0; i <= 800; i += 1) {
        const p = path.getPointAtLength((i / 800) * len);
        const d = Math.hypot(p.x - tx, p.y - ty);
        if (d < bd) {
          bd = d;
          best = (i / 800) * len;
        }
      }
      return best;
    });

  const seen: number[] = [];
  for (let i = 0; i < 12; i += 1) {
    await page.evaluate((y) => window.scrollTo(0, y), top - 700 + i * 110);
    await page.waitForTimeout(900);
    const a = await arc();
    if (a !== null) seen.push(a);
  }

  // Road covered per equal step of scroll. Even steps mean even speed —
  // which is the whole point: this used to range from 4 to 1136 path
  // pixels for the same 110px of scroll, because the truck was pinned to
  // the viewport centre and the road's length per pixel of page varies
  // wildly through a bend.
  const steps = seen
    .slice(1)
    .map((v, i) => v - seen[i])
    .filter((d) => d > 5);
  expect(steps.length).toBeGreaterThan(5);
  // Drop the last, which is the tail where the road runs out.
  const even = steps.slice(0, -1);
  expect(Math.max(...even) / Math.min(...even)).toBeLessThan(1.3);
});
