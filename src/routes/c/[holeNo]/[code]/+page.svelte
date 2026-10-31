<script lang="ts">
	import { resolve } from '$app/paths';
	import { TIER_CLASS } from '#lib/scoring.ts';
	import { shareHeadline, tiersLabel } from '#lib/share.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const title = $derived(shareHeadline(data.holeNo, data.total));
	const description =
		'Five sports prompts. One hole. The rarer your right answer, the farther it flies.';
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Ball Knower" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={data.url} />
	<meta property="og:image" content={data.image} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="{title}. {tiersLabel(data.tiers)}." />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<main class="screen shared">
	<p class="kicker mono-label">SOMEONE SHARED A CARD</p>
	<h1>{title}</h1>
	<div class="squares" role="img" aria-label={tiersLabel(data.tiers)}>
		{#each data.tiers as t, i (i)}<span class="tier-bg-{TIER_CLASS[t]}"></span>{/each}
	</div>
	<p>Five sports prompts. One hole.<br />The rarer your right answer, the farther it flies.</p>
	<div class="spacer"></div>
	<a class="btn-primary" href={resolve('/')}>PLAY TODAY’S HOLE</a>
</main>

<style>
	.shared {
		gap: 20px;
		text-align: center;
	}

	.kicker {
		margin: 24px 0 0;
		color: var(--bk-gold);
		font-weight: 700;
	}

	h1 {
		margin: 0;
		font-family: var(--bk-font-display);
		font-weight: 400;
		font-size: 34px;
		line-height: 1.15;
		color: var(--bk-gold);
	}

	.squares {
		display: flex;
		justify-content: center;
		gap: 10px;
	}

	.squares span {
		width: 44px;
		height: 44px;
		border-radius: var(--bk-radius-chip);
		box-shadow: 0 4px 0 var(--bk-green-900);
	}
</style>
