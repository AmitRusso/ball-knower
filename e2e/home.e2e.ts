import { expect, test } from '@playwright/test';

test('home page shows the styled logo', async ({ page }) => {
	await page.goto('/');
	const logo = page.getByRole('heading', { level: 1 });
	await expect(logo).toHaveText(/BALL\s*KNOWER/);
	await expect(logo).toHaveCSS('font-family', /Graduate/);
});

test('fonts are self-hosted', async ({ page }) => {
	const thirdParty: string[] = [];
	page.on('request', (req) => {
		if (new URL(req.url()).host !== 'localhost:4173') thirdParty.push(req.url());
	});
	await page.goto('/');
	await page.evaluate(() => document.fonts.ready);
	expect(thirdParty).toEqual([]);
});
