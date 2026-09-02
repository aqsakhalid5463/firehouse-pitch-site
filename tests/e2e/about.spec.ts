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
