import { expect, test } from '@playwright/test';
import type { Hole, RangePrompt, RangeSwingResult } from '../src/lib/types';

// The seed puts the sample prompts on today's hole and again on yesterday's,
// so the range has past prompts to serve.

test('the range serves only past prompts and never counts a swing', async ({ request }) => {
	const hole = (await (await request.get('/api/hole/today')).json()) as Hole;
	const prompt = (await (await request.get('/api/range/prompt')).json()) as RangePrompt;
	expect(prompt.holeNo).toBe(hole.holeNo - 1);
	expect(JSON.stringify(prompt)).not.toMatch(/answers|prior/i);

	// Today's prompts (seeded as holeNo * 10 + position) are not on the range.
	const today = await request.post('/api/range/swing', {
		data: { promptId: hole.holeNo * 10 + 3, entityId: 'ctry-finland', rawText: 'finland' }
	});
	expect(today.status()).toBe(404);

	// The countries prompt: two swings in a row get the same tier, since neither counts.
	const promptId = (hole.holeNo - 1) * 10 + 3;
	const results: RangeSwingResult[] = [];
	for (let i = 0; i < 2; i++) {
		const res = await request.post('/api/range/swing', {
			data: { promptId, entityId: null, rawText: 'finnland' }
		});
		results.push(await res.json());
	}
	expect(results[0]).toMatchObject({
		correct: true,
		canonicalName: 'Finland',
		tier: 'BALL_KNOWER'
	});
	expect(results[1].tier).toBe(results[0].tier);
	expect(results[0].answers.map((a) => a.name)).toContain('Finland');

	// Asking to skip every prompt but one serves that one.
	const skip = [0, 1, 2, 4].map((p) => (hole.holeNo - 1) * 10 + p);
	const only = (await (
		await request.get(`/api/range/prompt?seen=${skip.join(',')}`)
	).json()) as RangePrompt;
	expect(only.promptId).toBe(promptId);
});

test.use({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });

test('hits a ball on the range and shows the answers', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('link', { name: 'DRIVING RANGE' }).click();
	await expect(page).toHaveURL(/\/range$/);
	await expect(page.getByText(/FROM HOLE \d+/)).toBeVisible();
	await expect(page.getByRole('timer')).toBeVisible({ timeout: 5000 });

	await page.getByLabel('YOUR ANSWER').fill('zzzz');
	await page.getByRole('button', { name: 'SWING' }).click();
	await expect(page.getByTestId('stamp')).toContainText('OUT OF BOUNDS');
	await expect(page.getByText(/1 BALL · 0 YDS/)).toBeVisible();

	const answers = page.locator('details.answers');
	await answers.locator('summary').click();
	await expect(answers.getByRole('listitem').first()).toBeVisible();

	await page.getByRole('button', { name: 'NEXT BALL' }).click();
	await expect(page.getByText('TEEING UP · THE CLOCK STARTS IN')).toBeVisible();
});
