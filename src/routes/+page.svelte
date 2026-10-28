<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { getHole } from '#lib/api.ts';
	import { holeDate } from '#lib/format.ts';
	import {
		currentStreak,
		EMPTY_STATS,
		newPlay,
		utcDate,
		type Play,
		type Stats
	} from '#lib/play.ts';
	import { playKey, readJSON, STATS_KEY } from '#lib/storage.ts';
	import { SECONDS_PER_PROMPT } from '#lib/scoring.ts';
	import type { Hole } from '#lib/types.ts';

	// The page is prerendered; today's hole number arrives from the API (no answers in it).
	let hole = $state<Hole | null>(null);
	let play = $state<Play | null>(null);
	let stats = $state<Stats>(EMPTY_STATS);

	onMount(() => {
		stats = readJSON(STATS_KEY, EMPTY_STATS);
		getHole()
			.then((h) => {
				hole = h;
				play = readJSON(playKey(h.holeNo), newPlay(h.holeNo));
			})
			.catch(() => {
				// Offline or no hole yet: TEE OFF still leads to /play, which retries.
			});
	});

	const PROMPTS = $derived(hole?.prompts.length ?? 5);
	const done = $derived(play !== null && play.shots.length >= PROMPTS);
	const started = $derived(
		play !== null && (play.shots.length > 0 || play.promptStartedAt !== null)
	);
	const streak = $derived(currentStreak(stats, utcDate(Date.now())));
	const statsLine = $derived(
		`STREAK ${streak} ${streak === 1 ? 'DAY' : 'DAYS'} · BEST CARD ${stats.bestCard} YDS`
	);
</script>

<svelte:head>
	<title>Ball Knower — The Daily Drive</title>
	<meta
		name="description"
		content="A daily sports trivia game. The rarer your right answer, the farther your ball flies."
	/>
</svelte:head>

<main class="screen home">
	<div class="topline mono-label">
		<span class="gold bold">HOLE NO. {hole?.holeNo ?? '—'}</span>
		<span>{hole ? holeDate(hole.date) : ''}</span>
	</div>

	<div class="hero-col">
		<div class="masthead">
			<p class="kicker">★ THE DAILY DRIVE ★</p>
			<h1>BALL<br />KNOWER</h1>
			<div class="rule" aria-hidden="true"></div>
			<p class="tagline">
				Five sports prompts. One hole.<br />The rarer your right answer, the farther it flies.
			</p>
		</div>

		<svg viewBox="0 0 342 100" width="100%" aria-hidden="true" class="hero">
			<rect class="fw" x="0" y="64" width="342" height="20" rx="10" />
			<rect class="cream" x="14" y="68" width="4" height="12" />
			<path class="trail" d="M16 66 Q171 -6 326 70" />
			<circle class="ball" cx="171" cy="31" r="6" />
			<line class="pole" x1="326" y1="30" x2="326" y2="74" />
			<polygon class="flag" points="326,30 340,36 326,42" />
			<ellipse class="cup" cx="326" cy="74" rx="6" ry="2.5" />
			<text x="326" y="98" text-anchor="middle">500</text>
		</svg>
	</div>

	<div class="actions">
		<div class="stub">
			<div><strong>{PROMPTS}</strong><span>PROMPTS</span></div>
			<div>
				<strong>{hole?.secondsPerPrompt ?? SECONDS_PER_PROMPT}s</strong><span>PER SWING</span>
			</div>
			<div><strong>500</strong><span>YDS TO PIN</span></div>
		</div>

		<div class="spacer"></div>

		<a class="btn-primary" href={resolve(done ? '/card' : '/play')}>
			{done ? 'SEE YOUR CARD' : started ? 'BACK TO THE TEE' : 'TEE OFF'}
		</a>

		<div class="secondary">
			<a class="btn-secondary" href={resolve('/how-to-play')}>HOW TO PLAY</a>
			<button class="btn-secondary" type="button" disabled>DRIVING RANGE · SOON</button>
		</div>

		{#if stats.played > 0}
			<p class="stats mono-label">{statsLine}</p>
		{/if}
	</div>
</main>

<style>
	.home {
		gap: 22px;
		padding-top: 28px;
		padding-bottom: 32px;
	}

	/* Mobile: one column. Desktop: masthead + hero on the left, today's card and
	   the buttons in a panel on the right. */
	.hero-col,
	.actions {
		display: contents;
	}

	.topline {
		display: flex;
		justify-content: space-between;
	}

	.gold {
		color: var(--bk-gold);
	}

	.bold {
		font-weight: 700;
	}

	.masthead {
		margin-top: 18px;
		text-align: center;
	}

	.kicker {
		margin: 0;
		font-family: var(--bk-font-mono);
		font-size: 12px;
		letter-spacing: 0.3em;
		color: var(--bk-gold);
	}

	h1 {
		margin: 14px 0 0;
		font-family: var(--bk-font-display);
		font-weight: 400;
		font-size: 66px;
		line-height: 0.95;
		text-shadow: 4px 4px 0 var(--bk-green-900);
	}

	.rule {
		width: 120px;
		height: 6px;
		margin: 18px auto 0;
		background: var(--bk-gold);
	}

	.tagline {
		margin: 16px 0 0;
		font-size: 16px;
		font-weight: 600;
	}

	.hero .fw {
		fill: var(--bk-green-500);
	}
	.hero .cream,
	.hero .pole {
		fill: var(--bk-cream);
		stroke: var(--bk-cream);
		stroke-width: 2;
	}
	.hero .trail {
		fill: none;
		stroke: var(--bk-gold);
		stroke-width: 2;
		stroke-dasharray: 5 6;
	}
	.hero .ball {
		fill: var(--bk-cream);
		stroke: var(--bk-green-900);
		stroke-width: 2;
	}
	.hero .flag {
		fill: var(--bk-gold);
	}
	.hero .cup {
		fill: var(--bk-green-900);
	}
	.hero text {
		font-family: var(--bk-font-mono);
		font-size: 11px;
		fill: var(--bk-cream);
	}

	.stub {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		padding: 14px 8px;
		background: var(--bk-cream);
		color: var(--bk-ink);
		border-radius: 4px;
		text-align: center;
	}

	.stub > div + div {
		border-left: 2px dashed #b9b29e;
	}

	.stub strong {
		display: block;
		font-family: var(--bk-font-display);
		font-weight: 400;
		font-size: 28px;
		color: var(--bk-green-700);
	}

	.stub span {
		font-family: var(--bk-font-mono);
		font-size: 11px;
		letter-spacing: 0.08em;
		color: var(--bk-ink-muted);
	}

	.secondary {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}

	.stats {
		margin: 0;
		text-align: center;
	}
	@media (min-width: 960px) {
		.home {
			display: grid;
			grid-template-columns: minmax(0, 1fr) var(--bk-panel-width);
			grid-template-rows: auto 1fr;
			column-gap: 64px;
		}

		.topline {
			grid-column: 1 / -1;
		}

		.hero-col,
		.actions {
			display: flex;
			flex-direction: column;
			justify-content: center;
			gap: 22px;
		}

		.masthead {
			margin-top: 0;
		}

		.masthead h1 {
			font-size: 112px;
		}

		.tagline {
			font-size: 20px;
		}

		.actions .spacer {
			display: none;
		}
	}
</style>
