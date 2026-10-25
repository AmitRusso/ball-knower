<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { onMount, tick } from 'svelte';
	import AutoCorrectCard from '#lib/components/AutoCorrectCard.svelte';
	import FairwayTracker, { type TrackedShot } from '#lib/components/FairwayTracker.svelte';
	import ShotClock from '#lib/components/ShotClock.svelte';
	import { Game } from '#lib/game.svelte.ts';
	import { shotStarts } from '#lib/play.ts';
	import { HOLE_LENGTH_YDS, TIER_CLASS, tierInfo } from '#lib/scoring.ts';

	const game = new Game();
	let ready = $state(false);
	let landed = $state(false);
	let input = $state<HTMLInputElement>();

	onMount(async () => {
		await game.load();
		if (game.phase === 'done') {
			await goto(resolve('/card'), { replaceState: true });
			return;
		}
		ready = true;
	});

	// Serve each prompt once it's on screen; the clock keeps running across reloads.
	$effect(() => {
		if (ready && game.phase === 'prompt') {
			game.servePrompt();
			tick().then(() => input?.focus());
		}
	});

	const tracked = $derived.by((): TrackedShot[] => {
		const starts = shotStarts(game.play.shots);
		return game.play.shots.map((s, i) => ({ start: starts[i], yards: s.yards, tier: s.tier }));
	});
	const past = $derived(game.phase === 'result' ? tracked.slice(0, -1) : tracked);
	const flight = $derived(game.phase === 'result' ? tracked.at(-1) : undefined);
	const lastShot = $derived(game.play.shots.at(-1));
	const promptCount = $derived(game.hole?.prompts.length ?? 0);
	const isLast = $derived(game.index === promptCount - 1);

	async function swing(event: SubmitEvent) {
		event.preventDefault();
		landed = false;
		await game.swing();
	}

	async function expire() {
		landed = false;
		await game.swing(true);
	}

	async function next() {
		const finished = isLast;
		landed = false;
		await game.next();
		if (finished) await goto(resolve('/card'));
	}
</script>

<svelte:head>
	<title>Hole {game.hole?.holeNo ?? ''} — Ball Knower</title>
</svelte:head>

{#if ready && game.hole && game.prompt}
	<main class="screen">
		<div class="topbar mono-label">
			<span>HOLE {game.hole.holeNo}</span>
			<span class="gold">SHOT {game.index + 1} OF {promptCount}</span>
			{#if game.phase === 'prompt' && game.play.promptStartedAt !== null}
				{#key game.index}
					<ShotClock
						startedAt={game.play.promptStartedAt}
						seconds={game.hole.secondsPerPrompt}
						onexpire={expire}
					/>
				{/key}
			{/if}
		</div>

		{#if game.phase === 'prompt'}
			<FairwayTracker shots={tracked} mode="prompt" />

			<section class="prompt-card" aria-labelledby="prompt-text">
				<span class="league">{game.prompt.league}</span>
				<h1 id="prompt-text">{game.prompt.text}</h1>
				<p>{game.prompt.note} Spelling is forgiving.</p>
			</section>

			<form class="answer" onsubmit={swing}>
				<label for="answer" class="mono-label">YOUR ANSWER</label>
				<input
					bind:this={input}
					id="answer"
					type="text"
					autocomplete="off"
					autocapitalize="words"
					spellcheck="false"
					enterkeyhint="go"
					aria-describedby="autocorrect answer-help"
					value={game.play.draft}
					oninput={(e) => game.setDraft(e.currentTarget.value)}
				/>
				<AutoCorrectCard id="autocorrect" entity={game.suggestion} />
				<p id="answer-help">Swing submits the corrected name. Keep typing to change it.</p>
				<div class="spacer"></div>
				<button class="btn-primary" type="submit" disabled={game.swinging}>SWING</button>
			</form>
		{:else if lastShot}
			{@const tier = tierInfo(lastShot.tier)}
			<div class="trading-card">
				<div class="frame tier-border-{TIER_CLASS[lastShot.tier]}">
					<p class="mono-label your">YOUR ANSWER</p>
					<h1 class:struck={lastShot.tier === 'OUT_OF_BOUNDS' && lastShot.answer}>
						{lastShot.answer || (lastShot.timedOut ? 'Time ran out' : 'No answer')}
					</h1>
					<p class="reminder">{game.prompt.text}</p>
					<div class="banner tier-bg-{TIER_CLASS[lastShot.tier]}" class:show={landed}>
						<div class="tier-name">{tier.label.toUpperCase()}</div>
						<div class="yds">+{tier.yards} YDS</div>
					</div>
				</div>
			</div>

			<FairwayTracker
				shots={past}
				mode="result"
				{flight}
				onlanded={() => (landed = true)}
				label="The ball flies {lastShot.yards} yards, to {game.total} of {HOLE_LENGTH_YDS}"
			/>

			<p class="sr-only" aria-live="polite">
				{#if landed}{tier.label}. Plus {tier.yards} yards. {game.total} of {HOLE_LENGTH_YDS}.{/if}
			</p>

			<div class="spacer"></div>
			<button class="btn-primary" type="button" onclick={next}>
				{isLast ? 'SEE THE CARD' : 'NEXT SHOT'}
			</button>
		{/if}
	</main>
{/if}

<style>
	.topbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		min-height: 30px;
	}

	.gold {
		color: var(--bk-gold);
		font-weight: 700;
	}

	.prompt-card {
		padding: 18px 18px 16px;
		background: var(--bk-cream);
		color: var(--bk-ink);
		border-radius: var(--bk-radius-card);
		box-shadow: 0 5px 0 var(--bk-green-900);
	}

	.league {
		display: inline-block;
		padding: 4px 8px;
		background: var(--bk-ink);
		color: var(--bk-gold);
		border-radius: var(--bk-radius-chip);
		font-family: var(--bk-font-mono);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: var(--bk-tracking-label);
	}

	.prompt-card h1 {
		margin: 12px 0 0;
		font-size: 25px;
		font-weight: 800;
		line-height: 1.18;
	}

	.prompt-card p {
		margin: 10px 0 0;
		font-size: 13px;
		color: var(--bk-ink-muted);
	}

	.answer {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.answer label {
		font-weight: 700;
	}

	input {
		width: 100%;
		height: 52px;
		padding: 0 14px;
		font: 600 18px var(--bk-font-body);
		background: var(--bk-cream);
		color: var(--bk-ink);
		border: 3px solid var(--bk-gold);
		border-radius: var(--bk-radius-card);
	}

	.answer p {
		margin: 0;
		font-size: 13px;
		opacity: 0.85;
	}

	.trading-card {
		margin-top: 10px;
		padding: 6px;
		background: var(--bk-cream);
		border-radius: 8px;
		box-shadow: 0 5px 0 var(--bk-green-900);
	}

	.frame {
		overflow: hidden;
		padding: 18px 16px 0;
		border: 3px solid;
		border-radius: 5px;
		color: var(--bk-ink);
		text-align: center;
	}

	.tier-border-knower {
		border-color: var(--bk-tier-knower-bg);
	}
	.tier-border-allstar {
		border-color: var(--bk-tier-allstar-bg);
	}
	.tier-border-starter {
		border-color: var(--bk-tier-starter-bg);
	}
	.tier-border-role {
		border-color: var(--bk-tier-role-bg);
	}
	.tier-border-bench {
		border-color: var(--bk-tier-bench-bg);
	}
	.tier-border-ob {
		border-color: var(--bk-tier-ob-bg);
	}

	.your {
		margin: 0;
		font-size: 11px;
		font-weight: 700;
		color: var(--bk-ink-muted);
	}

	.frame h1 {
		margin: 8px 0 0;
		font-size: 30px;
		font-weight: 800;
		overflow-wrap: anywhere;
	}

	.struck {
		text-decoration: line-through;
	}

	.reminder {
		margin: 6px 0 0;
		font-size: 13px;
		color: var(--bk-ink-muted);
	}

	.banner {
		margin: 18px -16px 0;
		padding: 14px 0 16px;
		visibility: hidden;
	}

	.banner.show {
		visibility: visible;
		animation: pop 150ms ease-out;
	}

	@keyframes pop {
		from {
			transform: scale(0.9);
		}
		to {
			transform: scale(1);
		}
	}

	.tier-name {
		font-family: var(--bk-font-display);
		font-size: 40px;
		line-height: 1;
	}

	.yds {
		margin-top: 8px;
		font-family: var(--bk-font-display);
		font-size: 22px;
	}

	.tier-bg-allstar .yds {
		color: var(--bk-gold);
	}
</style>
