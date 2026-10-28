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

test('the card puts the hole map beside the scorecard', async ({ page, request }) => {
	// Play the hole through the API (the server must know it's finished before
	// it sends answers), then hand the round to the page. These picks avoid the
	// answers other tests assert tiers for.
	const playerId = crypto.randomUUID();
	const headers = { 'x-player-id': playerId };
	const picks = [
		['nfl-jim-taylor', 'Jim Taylor'],
		['nba-oscar-robertson', 'Oscar Robertson'],
		['nba-chicago-bulls', 'Chicago Bulls'],
		['ctry-argentina', 'Argentina'],
		['mlb-tim-keefe', 'Tim Keefe']
	];
	const shots = [];
	for (const [index, [entityId, rawText]] of picks.entries()) {
		await request.post(`/api/prompt/${index}/start`, { headers, data: { holeNo: 214 } });
		const res = await request.post('/api/swing', {
			headers,
			data: { holeNo: 214, index, entityId, rawText }
		});
		const r = await res.json();
		shots.push({
			index,
			rawText,
			entityId,
			answer: r.canonicalName,
			tier: r.tier,
			yards: r.yards,
			timedOut: false
		});
	}
	const play = { holeNo: 214, promptStartedAt: null, showingResult: false, draft: '', shots };
	await page.addInitScript(
		([id, p]) => {
			localStorage.setItem('bk:player', id);
			localStorage.setItem('bk:play:214', p);
		},
		[playerId, JSON.stringify(play)]
	);
	await page.goto('/card');
	await expect(page.getByText('ALL 19 CORRECT ANSWERS').first()).toBeAttached();
	const map = await box(page.getByRole('img', { name: /Hole map/ }));
	const card = await box(page.getByText('SHOT · TAP TO SEE ALL ANSWERS'));
	expect(card.x).toBeGreaterThan(map.x + map.width);
	await page.locator('details').nth(2).locator('summary').click();
	await snap(page, 'd5-card');
});
