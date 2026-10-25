<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import * as api from '#lib/api.ts';
	import FairwayTracker, { type TrackedShot } from '#lib/components/FairwayTracker.svelte';
	import TierChip from '#lib/components/TierChip.svelte';
	import { holeDate, untilNextHole } from '#lib/format.ts';
	import { Game } from '#lib/game.svelte.ts';
	import { isComplete, shotStarts } from '#lib/play.ts';
	import { HOLE_LENGTH_YDS, TIER_CLASS } from '#lib/scoring.ts';
	import { shareHeadline, shareText, tiersLabel } from '#lib/share.ts';
	import type { PromptAnswers } from '#lib/types.ts';

	const game = new Game();
	let answers = $state<PromptAnswers[]>([]);
	let ready = $state(false);
	let now = $state(Date.now());
	let shareStatus = $state('');

	onMount(() => {
		const timer = setInterval(() => (now = Date.now()), 1000);
		(async () => {
			await game.load();
			if (!game.hole || !isComplete(game.play, game.hole.prompts.length)) {
				await goto(resolve('/play'), { replaceState: true });
				return;
			}
			// Answer lists only once the play is complete (hard rule 1).
			answers = await api.getAnswers(game.play.holeNo);
			ready = true;
		})();
		return () => clearInterval(timer);
	});

	const shots = $derived(game.play.shots);
	const tracked = $derived.by((): TrackedShot[] => {
		const starts = shotStarts(shots);
		return shots.map((s, i) => ({ start: starts[i], yards: s.yards, tier: s.tier }));
	});
	const short = $derived(HOLE_LENGTH_YDS - game.total);
	const tiers = $derived(shots.map((s) => s.tier));
	const obCount = $derived(tiers.filter((t) => t === 'OUT_OF_BOUNDS').length);

	async function share() {
		if (!game.hole) return;
		const text = shareText(game.hole.holeNo, game.total, tiers, location.origin);
		try {
			if (navigator.share) {
				await navigator.share({ text });
				shareStatus = '';
				return;
			}
			await navigator.clipboard.writeText(text);
			shareStatus = 'COPIED TO CLIPBOARD';
		} catch (err) {
			if ((err as DOMException).name === 'AbortError') return;
			shareStatus = 'COULD NOT SHARE — TRY A SCREENSHOT';
		}
	}
</script>

<svelte:head>
	<title>The Card — Ball Knower</title>
</svelte:head>

{#if ready && game.hole}
	<div class="paper">
		<header class="fairway-bg">
			<div class="topline mono-label">
				<a href={resolve('/')}>‹ HOME</a>
				<span>HOLE {game.hole.holeNo} · {holeDate(game.hole.date, false)}</span>
			</div>
			<p class="kicker">THE CARD</p>
			<h1><span class="total">{game.total}</span> <span class="unit">YDS</span></h1>
			<p class="summary">
				{short === 0 ? 'In the cup. A perfect card.' : `${short} yards short of the pin.`}
			</p>
			<FairwayTracker
				shots={tracked}
				mode="card"
				label="Hole map: {shots.length} shots{obCount
					? `, ${obCount} out of bounds`
					: ''}, ball resting at {game.total} of {HOLE_LENGTH_YDS} yards"
			/>
		</header>

		<main>
			<div class="scorecard">
				<div class="head mono-label">
					<span>SHOT · TAP TO SEE ALL ANSWERS</span><span>YDS</span>
				</div>
				{#each shots as shot, i (i)}
					{@const prompt = game.hole.prompts[shot.index]}
					{@const list = answers.find((a) => a.index === shot.index)?.answers ?? []}
					<details>
						<summary>
							<span class="n">{i + 1}</span>
							<span class="what">
								<span class="q">{prompt.text}</span>
								<span class="a" class:struck={shot.tier === 'OUT_OF_BOUNDS' && shot.answer}>
									{shot.answer || (shot.timedOut ? 'Time ran out' : 'No answer')}
								</span>
							</span>
							<TierChip tier={shot.tier} />
							<span class="yds">{shot.yards}</span>
							<svg class="chev" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
								<path d="M6 9l6 6 6-6" />
							</svg>
						</summary>
						<div class="all">
							<p class="mono-label">ALL {list.length} CORRECT ANSWERS</p>
							<ul>
								{#each list as a (a.entityId)}
									<li class:mine={a.entityId === shot.entityId}>{a.name}</li>
								{/each}
							</ul>
						</div>
					</details>
				{/each}
				<div class="foot">
					<span class="mono-label">TOTAL</span>
					<span class="yds">{game.total}</span>
				</div>
			</div>

			<div class="share-block">
				<span class="headline">{shareHeadline(game.hole.holeNo, game.total)}</span>
				<div class="squares" role="img" aria-label={tiersLabel(tiers)}>
					{#each tiers as t, i (i)}<span class="tier-bg-{TIER_CLASS[t]}"></span>{/each}
				</div>
			</div>

			<div class="actions">
				<button class="btn-primary share" type="button" onclick={share}>SHARE CARD</button>
				<button class="btn-secondary" type="button" disabled>DRIVING RANGE · SOON</button>
			</div>
			<p class="status mono-label" role="status">{shareStatus}</p>

			<div class="spacer"></div>
			<p class="next mono-label">NEXT HOLE IN {untilNextHole(now)}</p>
		</main>
	</div>
{/if}

<style>
	.paper {
		max-width: var(--bk-column-max);
		min-height: 100vh;
		min-height: 100dvh;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		background: var(--bk-cream);
		color: var(--bk-ink);
	}

	header {
		padding: 22px var(--bk-gutter) 18px;
		color: var(--bk-cream);
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.topline {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.topline a {
		padding: 4px 0;
		font-weight: 700;
		text-decoration: none;
	}

	.kicker {
		margin: 8px 0 0;
		font-family: var(--bk-font-mono);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.2em;
		color: var(--bk-gold);
	}

	h1 {
		margin: 0;
		font-family: var(--bk-font-display);
		font-weight: 400;
	}

	.total {
		font-size: 76px;
		line-height: 1;
		color: var(--bk-gold);
		text-shadow: 4px 4px 0 var(--bk-green-900);
	}

	.unit {
		font-size: 28px;
	}

	.summary {
		margin: 0 0 6px;
		font-size: 15px;
	}

	main {
		flex: 1;
		padding: 20px var(--bk-gutter) 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.scorecard {
		border: 2px solid var(--bk-ink);
		border-radius: var(--bk-radius-card);
		overflow: hidden;
	}

	.head {
		display: flex;
		justify-content: space-between;
		padding: 7px 10px;
		background: var(--bk-ink);
		color: var(--bk-cream);
		font-size: 11px;
	}

	details {
		border-bottom: 1px solid var(--bk-rule);
	}

	summary {
		display: grid;
		grid-template-columns: 16px minmax(0, 1fr) auto 32px 14px;
		align-items: center;
		gap: 8px;
		padding: 10px;
		cursor: pointer;
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary:hover {
		background: #ece5d2;
	}

	.n {
		font-family: var(--bk-font-mono);
		font-size: 12px;
	}

	.what {
		min-width: 0;
	}

	.q {
		display: block;
		font-size: 12px;
		color: var(--bk-ink-muted);
	}

	.a {
		display: block;
		font-size: 15px;
		font-weight: 800;
		overflow-wrap: anywhere;
	}

	.struck {
		text-decoration: line-through;
	}

	.yds {
		font-family: var(--bk-font-display);
		font-size: 18px;
		text-align: right;
	}

	.chev {
		fill: none;
		stroke: var(--bk-ink);
		stroke-width: 2.5;
		stroke-linecap: round;
		stroke-linejoin: round;
		transition: transform 0.2s;
	}

	details[open] .chev {
		transform: rotate(180deg);
	}

	.all {
		padding: 2px 12px 14px 34px;
		background: var(--bk-cream-50);
	}

	.all p {
		margin: 8px 0;
		font-size: 11px;
		font-weight: 700;
		color: var(--bk-ink-muted);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	li {
		padding: 4px 8px;
		border-radius: var(--bk-radius-chip);
		background: var(--bk-cream-200);
		font-size: 13px;
	}

	li.mine {
		background: var(--bk-gold);
		outline: 1.5px solid var(--bk-ink);
		font-weight: 800;
	}

	.foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px;
	}

	.foot .mono-label {
		font-weight: 700;
	}

	.foot .yds {
		padding-right: 22px;
		font-size: 22px;
		color: var(--bk-green-700);
	}

	.share-block {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px 14px;
		background: var(--bk-cream-200);
		border-radius: var(--bk-radius-card);
	}

	.headline {
		font-family: var(--bk-font-mono);
		font-size: 13px;
		font-weight: 700;
	}

	.squares {
		display: flex;
		gap: 6px;
	}

	.squares span {
		width: 22px;
		height: 22px;
		border-radius: var(--bk-radius-chip);
		border: 1.5px solid var(--bk-ink);
	}

	.actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}

	.share {
		min-height: 52px;
		padding: 8px;
		border-color: var(--bk-ink);
		box-shadow: var(--bk-shadow-hard-sm);
		font-size: 18px;
	}

	.actions .btn-secondary {
		color: var(--bk-ink);
	}

	.status {
		min-height: 1em;
		margin: 0;
		text-align: center;
	}

	.next {
		margin: 0;
		text-align: center;
		color: var(--bk-ink-muted);
	}
</style>
