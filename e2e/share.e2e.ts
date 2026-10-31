import { expect, test } from '@playwright/test';

test('a shared card link previews as the card', async ({ page, request }) => {
	await page.goto('/c/214/KBAOK');
	await expect(page.getByRole('heading', { name: 'BALL KNOWER #214 · 325 YDS' })).toBeVisible();
	const image = await page.locator('meta[property="og:image"]').getAttribute('content');
	expect(image).toMatch(/\/og\/214\/KBAOK\.png$/);

	const png = await request.get(new URL(image!).pathname);
	expect(png.headers()['content-type']).toBe('image/png');
	expect((await png.body()).subarray(1, 4).toString()).toBe('PNG');

	expect((await request.get('/c/214/KXZ')).status()).toBe(404);
	expect((await request.get('/og/214/KXZ.png')).status()).toBe(404);
});
