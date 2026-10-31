import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Automated WCAG 2.1 AA checks (contrast, names, labels, landmarks) on every
// screen. Swings here are blank or wrong, so no pick counts change.

async function audit(page: Page, screen: string) {
	const { violations } = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
		.analyze();
	const summary = violations.map(
		(v) => `${screen}: ${v.id} — ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`
	);
	expect(summary).toEqual([]);
}

test.use({ reducedMotion: 'reduce' });

for (const viewport of [
	{ width: 390, height: 844 },
	{ width: 1280, height: 800 }
]) {
	test(`every screen passes axe at ${viewport.width}px`, async ({ page }) => {
		test.setTimeout(90_000);
		await page.setViewportSize(viewport);

		await page.goto('/');
		await expect(page.getByRole('link', { name: 'TEE OFF' })).toBeVisible();
		await audit(page, 'home');

		await page.goto('/how-to-play');
		await audit(page, 'how-to-play');

		await page.goto('/play');
		await expect(page.getByText('TEEING UP · THE CLOCK STARTS IN')).toBeVisible();
		await audit(page, 'tee-up');
		await page.getByLabel('YOUR ANSWER').fill('mark mos');
		await expect(page.locator('#autocorrect')).toContainText('Mark Moseley');
		await audit(page, 'prompt');

		for (let shot = 0; shot < 5; shot++) {
			await page.getByLabel('YOUR ANSWER').fill('');
			await page.getByRole('button', { name: 'SWING' }).click();
			const next = page.getByRole('button', { name: shot < 4 ? 'NEXT SHOT' : 'SEE THE CARD' });
			await expect(next).toBeFocused();
			if (shot === 0) await audit(page, 'result');
			await next.click();
		}

		await expect(page).toHaveURL(/\/card$/);
		await page.locator('details summary').first().click();
		await audit(page, 'card');

		await page.goto('/range');
		await expect(page.getByLabel('YOUR ANSWER')).toBeVisible({ timeout: 5000 });
		await audit(page, 'range');

		await page.goto('/c/214/KBAOK');
		await audit(page, 'shared card');
	});
}

test('the round can be played from the keyboard alone', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');
	// Tab to TEE OFF (no mouse), then Enter.
	for (let i = 0; i < 10; i++) {
		await page.keyboard.press('Tab');
		if (
			await page
				.getByRole('link', { name: /TEE OFF|BACK TO THE TEE/ })
				.evaluate((el) => el === document.activeElement)
		)
			break;
	}
	await page.keyboard.press('Enter');
	await expect(page.getByLabel('YOUR ANSWER')).toBeFocused({ timeout: 5000 });
	await page.keyboard.type('zzzz');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('button', { name: 'NEXT SHOT' })).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page.getByLabel('YOUR ANSWER')).toBeFocused({ timeout: 5000 });
});
