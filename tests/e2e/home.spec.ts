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
