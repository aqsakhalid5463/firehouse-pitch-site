import { test, expect } from '@playwright/test';

test('about page renders its story and credentials in server HTML', async ({
  request,
}) => {
  const html = await (await request.get('/about')).text();
  expect(html).toContain('We started this because we needed it ourselves');
  expect(html).toContain('Federally licensed');
  expect(html).toContain('(972) 992-1969');
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
