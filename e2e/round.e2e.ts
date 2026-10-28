import { expect, test, type Page } from '@playwright/test';

const SHOTS = process.env.BK_SHOTS_DIR;

async function snap(page: Page, name: string) {
	if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function swing(page: Page, text: string, suggestion: string | null) {
	await page.getByLabel('YOUR ANSWER').fill(text);
	if (suggestion) await expect(page.locator('#autocorrect')).toContainText(suggestion);
	await page.getByRole('button', { name: 'SWING' }).click();
}

test.use({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });

test('plays a full hole and shows the card', async ({ page }) => {
	test.setTimeout(60_000); // five 3-second tee-ups
	await page.goto('/');
	await snap(page, '01-home');
	await page.getByRole('link', { name: 'TEE OFF' }).click();

	await expect(page.getByText('SHOT 1 OF 5')).toBeVisible();
	await expect(page.getByText('TEEING UP · THE CLOCK STARTS IN')).toBeVisible();
	await expect(page.getByLabel('YOUR ANSWER')).toHaveCount(0);
	await expect(page.getByRole('timer')).toBeVisible({ timeout: 5000 });
	await page.getByLabel('YOUR ANSWER').fill('mark mosely');
	await expect(page.locator('#autocorrect')).toContainText('Mark Moseley');
	await snap(page, '02-prompt');
	await page.getByRole('button', { name: 'SWING' }).click();

	await expect(page.getByRole('heading', { name: 'Mark Moseley' })).toBeVisible();
	await expect(page.getByTestId('stamp')).toContainText('BALL KNOWER');
	await expect(page.getByText('+100 YDS')).toBeVisible();
	await expect(page.getByText('Almost nobody went there.')).toBeVisible();
	await expect(page.getByRole('img', { name: /So far: Ball Knower/ })).toBeVisible();
	await snap(page, '03-result');
	await page.getByRole('button', { name: 'NEXT SHOT' }).click();

	await swing(page, 'westbrook', 'Russell Westbrook');
	await expect(page.getByText('+40 YDS')).toBeVisible();
	await page.getByRole('button', { name: 'NEXT SHOT' }).click();

	await swing(page, 'san antonio spur', 'San Antonio Spurs');
	await expect(page.getByTestId('stamp')).toContainText('ALL-STAR');
	await page.getByRole('button', { name: 'NEXT SHOT' }).click();

	// A wrong answer from the pool still gets an auto-correct suggestion.
	await swing(page, 'argentina', 'Argentina');
	await expect(page.getByTestId('stamp')).toContainText('OUT OF BOUNDS');
	await expect(page.getByText('Not on the list.')).toBeVisible();
	await expect(page.getByText('+0 YDS')).toBeVisible();
	await snap(page, '04-ob');
	await page.getByRole('button', { name: 'NEXT SHOT' }).click();

	await swing(page, 'mickey welch', 'Mickey Welch');
	await page.getByRole('button', { name: 'SEE THE CARD' }).click();

	await expect(page).toHaveURL(/\/card$/);
	await expect(page.locator('.total')).toHaveText('325');
	await expect(page.getByText('175 yards short of the pin.')).toBeVisible();
	await expect(page.getByText('BALL KNOWER #214 · 325 YDS')).toBeVisible();

	const first = page.locator('details').first();
	await first.locator('summary').click();
	await expect(first.getByText('ALL 19 CORRECT ANSWERS')).toBeVisible();
	await expect(first.locator('li.mine')).toHaveText('Mark Moseley');
	await snap(page, '05-card');

	// One round per day: the tee sends you back to your card.
	await page.goto('/play');
	await expect(page).toHaveURL(/\/card$/);
	await page.goto('/');
	await expect(page.getByRole('link', { name: 'SEE YOUR CARD' })).toBeVisible();
	await expect(page.getByText(/STREAK 1 DAY · BEST CARD 325 YDS/)).toBeVisible();
});

test('resumes mid-round after a reload', async ({ page }) => {
	await page.goto('/play');
	await swing(page, 'barry sanders', 'Barry Sanders');
	await expect(page.getByRole('heading', { name: 'Barry Sanders' })).toBeVisible();

	await page.reload();
	await expect(page.getByRole('heading', { name: 'Barry Sanders' })).toBeVisible();
	await page.getByRole('button', { name: 'NEXT SHOT' }).click();
	await expect(page.getByText('SHOT 2 OF 5')).toBeVisible();

	await page.getByLabel('YOUR ANSWER').fill('jokic');
	await page.reload();
	await expect(page.getByLabel('YOUR ANSWER')).toHaveValue('jokic');
});

test('the clock swings for you when it runs out', async ({ page }) => {
	await page.clock.install();
	await page.goto('/play');
	await page.clock.fastForward('00:03'); // tee-up
	await page.getByLabel('YOUR ANSWER').fill('oj simpson');
	await expect(page.locator('#autocorrect')).toContainText('O.J. Simpson');
	await page.clock.fastForward('00:46');
	await expect(page.getByRole('heading', { name: 'O.J. Simpson' })).toBeVisible();

	await page.getByRole('button', { name: 'NEXT SHOT' }).click();
	await page.clock.fastForward('00:03');
	await expect(page.getByRole('timer')).toBeVisible();
	await page.clock.fastForward('00:46');
	await expect(page.getByRole('heading', { name: 'Time ran out' })).toBeVisible();
	await expect(page.getByTestId('stamp')).toContainText('OUT OF BOUNDS');
	await expect(page.getByText('The clock ran out.')).toBeVisible();
});

test.describe('with motion', () => {
	test.use({ reducedMotion: 'no-preference' });

	test('the ball carries past the gates before the stamp lands', async ({ page }) => {
		await page.goto('/play');
		await swing(page, 'mark mosely', 'Mark Moseley');
		const next = page.getByRole('button', { name: 'NEXT SHOT' });
		await expect(next).toHaveCount(0);
		await expect(page.getByRole('img', { name: 'Shot 1 of 5' })).toBeVisible();
		await expect(page.getByTestId('stamp')).toContainText('BENCH WARMER');
		await snap(page, '07-mid-flight');
		await expect(next).toBeVisible({ timeout: 5000 });
		await expect(page.getByTestId('stamp')).toContainText('BALL KNOWER');
		await expect(next).toBeFocused();
		await expect(page.getByRole('img', { name: /So far: Ball Knower/ })).toBeVisible();
		await snap(page, '08-landed');
	});
});

test('the ladder on How to Play comes from the scoring constants', async ({ page }) => {
	await page.goto('/how-to-play');
	await expect(page.getByRole('row', { name: /BENCH WARMER 25%\+ 40/ })).toBeVisible();
	await expect(page.getByRole('row', { name: /BALL KNOWER under 1% 100/ })).toBeVisible();
	await snap(page, '06-how-to-play');
});
