<script lang="ts">
	import { resolve } from '$app/paths';
	import TierChip from '#lib/components/TierChip.svelte';
	import { HOLE_LENGTH_YDS, OUT_OF_BOUNDS, TIERS } from '#lib/scoring.ts';

	const pct = (share: number) => `${Math.round(share * 100)}`;

	// Ladder from most to least common, ranges derived from the thresholds.
	const ladder = TIERS.map((t, i) => {
		const lo = i === 0 ? 0 : TIERS[i - 1].maxShare;
		const range =
			i === 0
				? `under ${pct(t.maxShare)}%`
				: t.maxShare >= 1
					? `${pct(lo)}%+`
					: `${pct(lo)}–${pct(t.maxShare)}%`;
		return { id: t.id, range, yards: t.yards };
	}).reverse();
</script>

<svelte:head>
	<title>How to Play — Ball Knower</title>
	<meta
		name="description"
		content="Five sports prompts a day. Any right answer counts; the rarer it is, the farther your ball flies."
	/>
</svelte:head>

<div class="paper">
	<header class="fairway-bg">
		<a class="back" href={resolve('/')}>‹ BACK</a>
		<h1>HOW TO PLAY</h1>
	</header>

	<main>
		<ol class="steps">
			<li>
				<span class="num" aria-hidden="true">1</span>
				<div>
					<h2>Five prompts, one hole</h2>
					<p>
						Everyone gets the same five sports prompts each day. The hole is {HOLE_LENGTH_YDS} yards long.
					</p>
				</div>
			</li>
			<li>
				<span class="num" aria-hidden="true">2</span>
				<div>
					<h2>Any right answer counts</h2>
					<p>
						Each prompt has lots of correct answers. Type one and swing before the 45-second clock
						runs out.
					</p>
				</div>
			</li>
			<li>
				<span class="num" aria-hidden="true">3</span>
				<div>
					<h2>Rarer flies farther</h2>
					<p>
						Your drive is scored by how many players gave the same answer. The fewer, the longer.
					</p>
				</div>
			</li>
		</ol>

		<table class="ladder">
			<thead>
				<tr><th scope="col">THE LADDER</th><th scope="col" colspan="2">PICKED BY · YDS</th></tr>
			</thead>
			<tbody>
				{#each ladder as row (row.id)}
					<tr class:top={row.id === 'BALL_KNOWER'}>
						<td><TierChip tier={row.id} /></td>
						<td class="range">{row.range}</td>
						<td class="yds">{row.yards}</td>
					</tr>
				{/each}
				<tr>
					<td><TierChip tier={OUT_OF_BOUNDS.id} /></td>
					<td class="range">wrong / blank</td>
					<td class="yds">{OUT_OF_BOUNDS.yards}</td>
				</tr>
			</tbody>
		</table>

		<ol class="steps" start="4">
			<li>
				<span class="num gold" aria-hidden="true">4</span>
				<div>
					<h2>Sink it</h2>
					<p>Five Ball Knower answers add up to {HOLE_LENGTH_YDS} yards: ball in the cup.</p>
				</div>
			</li>
		</ol>

		<div class="spacer"></div>
		<p class="foot mono-label">NEW HOLE EVERY DAY AT MIDNIGHT UTC</p>
		<a class="btn-primary" href={resolve('/play')}>TEE OFF</a>
	</main>
</div>

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
		padding: 22px var(--bk-gutter) 20px;
		color: var(--bk-cream);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.back {
		align-self: flex-start;
		padding: 6px 0;
		font-family: var(--bk-font-mono);
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}

	h1 {
		margin: 0;
		font-family: var(--bk-font-display);
		font-weight: 400;
		font-size: 34px;
		text-shadow: 3px 3px 0 var(--bk-green-900);
	}

	main {
		flex: 1;
		padding: 22px var(--bk-gutter) 28px;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.steps {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.steps li {
		display: flex;
		gap: 14px;
	}

	.num {
		flex: none;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--bk-green-700);
		color: var(--bk-gold);
		font-family: var(--bk-font-display);
		font-size: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.num.gold {
		background: var(--bk-gold);
		color: var(--bk-ink);
	}

	h2 {
		margin: 0;
		font-size: 17px;
		font-weight: 800;
	}

	p {
		margin: 4px 0 0;
		font-size: 14px;
		line-height: 1.45;
		color: #3a4038;
	}

	.ladder {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		border: 2px solid var(--bk-ink);
		border-radius: var(--bk-radius-card);
		overflow: hidden;
	}

	th {
		background: var(--bk-ink);
		color: var(--bk-cream);
		padding: 8px 14px;
		font-family: var(--bk-font-mono);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-align: left;
	}

	th + th {
		text-align: right;
	}

	td {
		padding: 8px 14px;
		border-bottom: 1px solid var(--bk-rule);
	}

	tr:last-child td {
		border-bottom: none;
	}

	tr.top td {
		background: #fbf4da;
	}

	.range {
		font-family: var(--bk-font-mono);
		font-size: 12px;
		text-align: right;
		white-space: nowrap;
	}

	.yds {
		width: 52px;
		font-family: var(--bk-font-display);
		font-size: 18px;
		text-align: right;
	}

	.foot {
		margin: 0;
		text-align: center;
		color: var(--bk-ink-muted);
	}

	/* Desktop: rules on the left, the ladder beside them. */
	@media (min-width: 960px) {
		.paper {
			max-width: 960px;
		}

		header {
			padding: 32px var(--bk-gutter-wide) 28px;
		}

		h1 {
			font-size: 44px;
		}

		main {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			grid-template-areas:
				'steps ladder'
				'sink ladder'
				'foot foot'
				'cta cta';
			column-gap: 48px;
			align-content: start;
			padding: 32px var(--bk-gutter-wide) 40px;
		}

		.steps:first-of-type {
			grid-area: steps;
		}

		.ladder {
			grid-area: ladder;
			align-self: start;
		}

		.steps[start] {
			grid-area: sink;
		}

		.spacer {
			display: none;
		}

		.foot {
			grid-area: foot;
			margin-top: 16px;
		}

		.btn-primary {
			grid-area: cta;
			justify-self: center;
			max-width: var(--bk-panel-width);
		}
	}
</style>
