<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import FairwayTracker from '#lib/components/FairwayTracker.svelte';
	import PromptPanel from '#lib/components/PromptPanel.svelte';
	import ShotClock from '#lib/components/ShotClock.svelte';
	import ShotReveal from '#lib/components/ShotReveal.svelte';
	import { Range } from '#lib/range.svelte.ts';
	import { TEE_UP_SECONDS } from '#lib/reveal.ts';
	import { SECONDS_PER_PROMPT } from '#lib/scoring.ts';

	// Unlimited balls from past holes. Scored against each hole's picks, never
	// counted, and kept apart from the daily play, streaks and stats.
	const range = new Range();
	let status = $state<'loading' | 'ready' | 'closed' | 'offline'>('loading');
	let settled = $state(false);
	let teeUp = $state(0);
	let nextButton = $state<HTMLButtonElement>();

	async function load() {
		status = 'loading';
		settled = false;
		try {
			await range.next();
			status = 'ready';
		} catch (err) {
			status = (err as { status?: number }).status === 404 ? 'closed' : 'offline';
		}
	}

	onMount(load);

	const tally = $derived(
		`${range.saved.balls} ${range.saved.balls === 1 ? 'BALL' : 'BALLS'} · ${range.saved.yards} YDS`
	);
	const teeingUp = $derived(status === 'ready' && !range.shot && range.startedAt === null);

	$effect(() => {
		if (!teeingUp) return;
		teeUp = TEE_UP_SECONDS;
		const timer = setInterval(() => {
			teeUp -= 1;
			if (teeUp > 0) return;
			clearInterval(timer);
			range.startClock();
		}, 1000);
		return () => clearInterval(timer);
	});

	async function onsettled() {
		settled = true;
		await tick();
		nextButton?.focus();
	}
</script>

<svelte:head>
	<title>Driving Range — Ball Knower</title>
</svelte:head>

<main class="screen">
	<div class="topbar mono-label">
		<a href={resolve('/')}>‹ HOME</a>
		<span class="title">DRIVING RANGE</span>
		<span class="clock-slot">
			{#if status === 'ready' && !range.shot && range.startedAt !== null}
				{#key range.prompt?.promptId}
					<ShotClock
						startedAt={range.startedAt}
						seconds={SECONDS_PER_PROMPT}
						onexpire={() => range.swing(true)}
					/>
				{/key}
			{/if}
		</span>
	</div>
	<p class="tally mono-label">{tally} · NOTHING HERE COUNTS</p>

	{#if status === 'loading'}
		<p class="loading mono-label" role="status">TEEING UP A BALL…</p>
	{:else if status === 'closed' || status === 'offline'}
		<div class="empty">
			<p>
				{status === 'closed'
					? 'The range opens once the first hole is in the books.'
					: 'Could not reach the range. Check your connection.'}
			</p>
			{#if status === 'offline'}
				<button class="btn-secondary" type="button" onclick={load}>TRY AGAIN</button>
			{/if}
		</div>
	{:else if status === 'ready' && range.prompt && !range.shot}
		<div class="board">
			<div class="stage">
				<FairwayTracker shots={[]} mode="prompt" />
			</div>
			<div class="panel">
				<p class="from mono-label">FROM HOLE {range.prompt.holeNo}</p>
				<PromptPanel
					prompt={range.prompt}
					{teeingUp}
					{teeUp}
					draft={range.draft}
					suggestion={range.suggestion}
					swinging={range.swinging}
					ondraft={(text) => (range.draft = text)}
					onswing={() => {
						settled = false;
						range.swing();
					}}
				/>
			</div>
		</div>
	{:else if range.prompt && range.shot}
		{#key range.prompt.promptId}
			<ShotReveal shot={range.shot} start={0} past={[]} promptText={range.prompt.text} {onsettled}>
				{#snippet actions()}
					{#if settled}
						<div class="after rise">
							<details class="answers">
								<summary class="mono-label">ALL {range.answers.length} CORRECT ANSWERS</summary>
								<ul>
									{#each range.answers as a (a.entityId)}
										<li class:mine={a.entityId === range.shot?.entityId}>{a.name}</li>
									{/each}
								</ul>
							</details>
							<button bind:this={nextButton} class="btn-primary" type="button" onclick={load}>
								NEXT BALL
							</button>
						</div>
					{/if}
				{/snippet}
			</ShotReveal>
		{/key}
	{/if}
</main>

<style>
	.topbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		min-height: 30px;
	}

	.topbar a {
		flex: 1 1 0;
		padding: 4px 0;
		font-weight: 700;
		text-decoration: none;
	}

	.title {
		color: var(--bk-gold);
		font-weight: 700;
	}

	.clock-slot {
		flex: 1 1 0;
		display: flex;
		justify-content: flex-end;
	}

	.tally {
		margin: -8px 0 0;
		text-align: center;
	}

	.loading {
		margin: auto;
	}

	.from {
		margin: 0;
	}

	.empty {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 16px;
		text-align: center;
	}

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

	.after {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.answers {
		padding: 10px 12px;
		background: var(--bk-cream);
		color: var(--bk-ink);
		border-radius: var(--bk-radius-card);
	}

	.answers summary {
		font-weight: 700;
		cursor: pointer;
	}

	ul {
		margin: 10px 0 2px;
		padding: 0;
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	li {
		padding: 3px 8px;
		background: var(--bk-cream-50);
		border-radius: var(--bk-radius-chip);
		font-size: 13px;
	}

	li.mine {
		background: var(--bk-gold);
		outline: 1.5px solid var(--bk-ink);
		font-weight: 800;
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
