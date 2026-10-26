<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { onMount, tick } from 'svelte';
	import AutoCorrectCard from '#lib/components/AutoCorrectCard.svelte';
	import FairwayTracker, { type TrackedShot } from '#lib/components/FairwayTracker.svelte';
	import ShotClock from '#lib/components/ShotClock.svelte';
	import ShotPips from '#lib/components/ShotPips.svelte';
	import ShotReveal from '#lib/components/ShotReveal.svelte';
	import { Game } from '#lib/game.svelte.ts';
	import { shotStarts } from '#lib/play.ts';
	import { TEE_UP_SECONDS } from '#lib/reveal.ts';

	const game = new Game();
	let ready = $state(false);
	let settled = $state(false);
	let teeUp = $state(0);
	let input = $state<HTMLInputElement>();
	let nextButton = $state<HTMLButtonElement>();

	onMount(async () => {
		await game.load();
		if (game.phase === 'done') {
			await goto(resolve('/card'), { replaceState: true });
			return;
		}
		ready = true;
	});

	const teeingUp = $derived(game.phase === 'prompt' && game.play.promptStartedAt === null);

	// Krillion-style tee-up: show the prompt, count down, then start the clock.
	// A prompt already served (reload mid-shot) skips straight to the input.
	$effect(() => {
		if (!ready || !teeingUp) return;
		teeUp = TEE_UP_SECONDS;
		const timer = setInterval(() => {
			teeUp -= 1;
			if (teeUp > 0) return;
			clearInterval(timer);
			game.servePrompt();
		}, 1000);
		return () => clearInterval(timer);
	});

	$effect(() => {
		if (ready && game.phase === 'prompt' && !teeingUp) tick().then(() => input?.focus());
	});

	const tracked = $derived.by((): TrackedShot[] => {
		const starts = shotStarts(game.play.shots);
		return game.play.shots.map((s, i) => ({ start: starts[i], yards: s.yards, tier: s.tier }));
	});
	// The shot being revealed only gets its color once the stamp lands.
	const tiers = $derived(
		game.play.shots
			.map((s) => s.tier)
			.slice(0, game.phase === 'result' && !settled ? -1 : undefined)
	);
	const lastShot = $derived(game.play.shots.at(-1));
	const promptCount = $derived(game.hole?.prompts.length ?? 0);
	const isLast = $derived(game.index === promptCount - 1);

	async function swing(event: SubmitEvent) {
		event.preventDefault();
		settled = false;
		await game.swing();
	}

	async function expire() {
		settled = false;
		await game.swing(true);
	}

	async function onsettled() {
		settled = true;
		await tick();
		nextButton?.focus();
	}

	async function next() {
		const finished = isLast;
		settled = false;
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
			<span class="hole">HOLE {game.hole.holeNo}</span>
			<ShotPips {tiers} count={promptCount} current={game.index} />
			<span class="clock-slot">
				{#if game.phase === 'prompt' && game.play.promptStartedAt !== null}
					{#key game.index}
						<ShotClock
							startedAt={game.play.promptStartedAt}
							seconds={game.hole.secondsPerPrompt}
							onexpire={expire}
						/>
					{/key}
				{/if}
			</span>
		</div>

		{#if game.phase === 'prompt'}
			<FairwayTracker shots={tracked} mode="prompt" />

			<section class="prompt-card" class:teeing={teeingUp} aria-labelledby="prompt-text">
				<span class="league">{game.prompt.league}</span>
				<h1 id="prompt-text">{game.prompt.text}</h1>
				<p>{game.prompt.note} Spelling is forgiving.</p>
			</section>

			{#if teeingUp}
				<div class="tee-up" role="status">
					<span class="mono-label">TEEING UP · THE CLOCK STARTS IN</span>
					{#key teeUp}<span class="count">{teeUp}</span>{/key}
				</div>
			{:else}
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
			{/if}
		{:else if lastShot}
			{#key game.index}
				<ShotReveal
					shot={lastShot}
					start={tracked.at(-1)?.start ?? 0}
					past={tracked.slice(0, -1)}
					promptText={game.prompt.text}
					{onsettled}
				/>
			{/key}

			<div class="spacer"></div>
			<div class="next-slot">
				{#if settled}
					<button bind:this={nextButton} class="btn-primary rise" type="button" onclick={next}>
						{isLast ? 'SEE THE CARD' : 'NEXT SHOT'}
					</button>
				{/if}
			</div>
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

	.hole,
	.clock-slot {
		flex: 1 1 0;
	}

	.clock-slot {
		display: flex;
		justify-content: flex-end;
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

	.tee-up {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		margin-top: 18px;
		text-align: center;
	}

	.count {
		font-family: var(--bk-font-display);
		font-size: 64px;
		line-height: 1;
		color: var(--bk-gold);
		text-shadow: 4px 4px 0 var(--bk-green-900);
		animation: count-in 300ms ease-out;
	}

	@keyframes count-in {
		from {
			transform: scale(1.6);
			opacity: 0;
		}
	}

	.prompt-card.teeing {
		animation: deal 350ms ease-out;
	}

	@keyframes deal {
		from {
			transform: translateY(24px);
			opacity: 0;
		}
	}

	.next-slot {
		min-height: 66px;
	}

	.rise {
		animation: rise 200ms ease-out;
	}

	@keyframes rise {
		from {
			transform: translateY(12px);
			opacity: 0;
		}
	}
</style>
