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

test('installable: manifest, icons, and a service worker that caches the shell', async ({
	page,
	request
}) => {
	await page.goto('/');
	const href = await page.locator('link[rel="manifest"]').getAttribute('href');
	const manifest = await (await request.get(href!)).json();
	expect(manifest).toMatchObject({ name: 'Ball Knower', display: 'standalone', start_url: '/' });
	for (const icon of manifest.icons as { src: string }[]) {
		expect((await request.get(icon.src)).ok()).toBe(true);
	}

	const cached = await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
		const cache = await caches.open((await caches.keys())[0]);
		return (await cache.keys()).map((r) => new URL(r.url).pathname);
	});
	expect(cached).toEqual(
		expect.arrayContaining(['/', '/play', '/fonts/graduate-latin-400-normal.woff2'])
	);
	// The API is never cached by the worker.
	expect(cached.some((p) => p.startsWith('/api/'))).toBe(false);
});
