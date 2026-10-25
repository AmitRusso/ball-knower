<!-- M0 placeholder: the real Home screen (design/mockups/01-home.html) lands in M1. -->
<svelte:head>
	<title>Ball Knower — The Daily Drive</title>
	<meta
		name="description"
		content="A daily sports trivia game. The rarer your right answer, the farther your ball flies."
	/>
</svelte:head>

<main>
	<p class="kicker">★ THE DAILY DRIVE ★</p>
	<h1>BALL<br />KNOWER</h1>
	<div class="rule" aria-hidden="true"></div>
	<p class="tagline">
		Five sports prompts. One hole.<br />The rarer your right answer, the farther it flies.
	</p>
	<p class="status">FIRST TEE TIME COMING SOON</p>
</main>

<style>
	main {
		min-height: 100vh;
		min-height: 100dvh;
		margin: 0 auto;
		padding: 64px var(--bk-gutter) 32px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		background: var(--bk-fairway);
	}

	.kicker,
	.status {
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
		color: var(--bk-cream);
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

	.status {
		margin-top: 40px;
		letter-spacing: var(--bk-tracking-label);
		color: var(--bk-cream);
	}
</style>
