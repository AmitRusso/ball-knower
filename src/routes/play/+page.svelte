<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { onMount, tick } from 'svelte';
	import FairwayTracker, { type TrackedShot } from '#lib/components/FairwayTracker.svelte';
	import ShotClock from '#lib/components/ShotClock.svelte';
	import PromptPanel from '#lib/components/PromptPanel.svelte';
	import ShotPips from '#lib/components/ShotPips.svelte';
	import ShotReveal from '#lib/components/ShotReveal.svelte';
	import { Game } from '#lib/game.svelte.ts';
	import { shotStarts } from '#lib/play.ts';
	import { TEE_UP_SECONDS } from '#lib/reveal.ts';

	const game = new Game();
	let ready = $state(false);
	let settled = $state(false);
	let teeUp = $state(0);
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

	async function swing() {
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
			<div class="board">
				<div class="stage">
					<FairwayTracker shots={tracked} mode="prompt" />
				</div>
				<div class="panel">
					<PromptPanel
						prompt={game.prompt}
						{teeingUp}
						{teeUp}
						draft={game.play.draft}
						suggestion={game.suggestion}
						swinging={game.swinging}
						ondraft={(text) => game.setDraft(text)}
						onswing={swing}
					/>
				</div>
			</div>
		{:else if lastShot}
			{#key game.index}
				<ShotReveal
					shot={lastShot}
					start={tracked.at(-1)?.start ?? 0}
					past={tracked.slice(0, -1)}
					promptText={game.prompt.text}
					{onsettled}
				>
					{#snippet actions()}
						{#if settled}
							<button bind:this={nextButton} class="btn-primary rise" type="button" onclick={next}>
								{isLast ? 'SEE THE CARD' : 'NEXT SHOT'}
							</button>
						{/if}
					{/snippet}
				</ShotReveal>
			{/key}
		{/if}
	</main>
{:else}
	<main class="screen">
		<p class="loading mono-label" role="status">TEEING UP THE HOLE…</p>
	</main>
{/if}

<style>
	.loading {
		margin: auto;
	}

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

	/* Mobile: one column. Desktop: fairway stage left, prompt + answer panel right. */
	.board {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.stage {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	@media (min-width: 960px) {
		.board {
			display: grid;
			grid-template-columns: minmax(0, 1fr) var(--bk-panel-width);
			column-gap: 40px;
			align-items: start;
			align-content: center;
		}
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
