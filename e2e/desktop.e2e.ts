import { expect, test, type Locator, type Page } from '@playwright/test';

const SHOTS = process.env.BK_SHOTS_DIR;

async function snap(page: Page, name: string) {
	if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function box(locator: Locator) {
	const b = await locator.boundingBox();
	if (!b) throw new Error('not visible');
	return b;
}

test.use({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });

test('desktop splits each screen into a stage and a side panel', async ({ page }) => {
	test.setTimeout(60_000);
	await page.goto('/');
	const logo = await box(page.getByRole('heading', { level: 1 }));
	const teeOff = await box(page.getByRole('link', { name: 'TEE OFF' }));
	expect(teeOff.x).toBeGreaterThan(logo.x + logo.width);
	await snap(page, 'd1-home');

	await page.getByRole('link', { name: 'TEE OFF' }).click();
	const fairway = await box(page.getByRole('img', { name: /Fairway: ball at 0/ }));
	const prompt = await box(page.locator('#prompt-text'));
	expect(prompt.x).toBeGreaterThan(fairway.x + fairway.width);
	expect(fairway.width).toBeGreaterThan(500);

	await page.getByLabel('YOUR ANSWER').fill('mark mosely');
	await expect(page.locator('#autocorrect')).toContainText('Mark Moseley');
	await snap(page, 'd2-prompt');
	await page.getByRole('button', { name: 'SWING' }).click();

	const next = page.getByRole('button', { name: 'NEXT SHOT' });
	await expect(next).toBeVisible();
	const flight = await box(page.getByRole('img', { name: /The ball flies/ }));
	const nextBox = await box(next);
	expect(nextBox.x).toBeGreaterThan(flight.x + flight.width);
	await snap(page, 'd3-result');

	await page.goto('/how-to-play');
	const steps = await box(page.getByRole('heading', { name: 'Five prompts, one hole' }));
	const ladder = await box(page.getByRole('table'));
	expect(ladder.x).toBeGreaterThan(steps.x);
	await snap(page, 'd4-how-to-play');
});

test('phones keep the single column', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/play');
	await page.getByLabel('YOUR ANSWER').waitFor();
	const fairway = await box(page.getByRole('img', { name: /Fairway/ }));
	const prompt = await box(page.locator('#prompt-text'));
	expect(prompt.y).toBeGreaterThan(fairway.y + fairway.height);
});

test('the card puts the hole map beside the scorecard', async ({ page }) => {
	const shot = (index: number, answer: string, entityId: string, tier: string, yards: number) => ({
		index,
		rawText: answer,
		entityId,
		answer,
		tier,
		yards,
		timedOut: false
	});
	const play = {
		holeNo: 214,
		promptStartedAt: null,
		showingResult: false,
		draft: '',
		shots: [
			shot(0, 'Mark Moseley', 'nfl-mark-moseley', 'BALL_KNOWER', 100),
			shot(1, 'Russell Westbrook', 'nba-russell-westbrook', 'BENCH_WARMER', 40),
			shot(2, 'San Antonio Spurs', 'nba-san-antonio-spurs', 'ALL_STAR', 85),
			shot(3, 'Argentina', 'ctry-argentina', 'OUT_OF_BOUNDS', 0),
			shot(4, 'Mickey Welch', 'mlb-mickey-welch', 'BALL_KNOWER', 100)
		]
	};
	await page.addInitScript((p) => localStorage.setItem('bk:play:214', JSON.stringify(p)), play);
	await page.goto('/card');
	const map = await box(page.getByRole('img', { name: /Hole map/ }));
	const card = await box(page.getByText('SHOT · TAP TO SEE ALL ANSWERS'));
	expect(card.x).toBeGreaterThan(map.x + map.width);
	await page.locator('details').nth(2).locator('summary').click();
	await snap(page, 'd5-card');
});
