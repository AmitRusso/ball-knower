<script lang="ts">
	// The prompt card, the tee-up countdown and the answer form. Shared by the
	// daily hole (/play) and the Driving Range (/range).
	import { tick } from 'svelte';
	import AutoCorrectCard from '#lib/components/AutoCorrectCard.svelte';
	import type { Entity } from '#lib/types.ts';

	interface Props {
		prompt: { league: string; text: string; note: string };
		/** True during the tee-up countdown, before the clock runs and the input shows. */
		teeingUp: boolean;
		/** Seconds left in the tee-up countdown. */
		teeUp: number;
		draft: string;
		suggestion: Entity | null;
		swinging: boolean;
		ondraft: (text: string) => void;
		onswing: () => void;
	}

	let { prompt, teeingUp, teeUp, draft, suggestion, swinging, ondraft, onswing }: Props = $props();

	let input = $state<HTMLInputElement>();

	$effect(() => {
		if (!teeingUp) tick().then(() => input?.focus());
	});

	function submit(event: SubmitEvent) {
		event.preventDefault();
		onswing();
	}
</script>

<section class="prompt-card" class:teeing={teeingUp} aria-labelledby="prompt-text">
	<span class="league">{prompt.league}</span>
	<h1 id="prompt-text">{prompt.text}</h1>
	<p>{prompt.note} Spelling is forgiving.</p>
</section>

{#if teeingUp}
	<div class="tee-up" role="status">
		<span class="mono-label">TEEING UP · THE CLOCK STARTS IN</span>
		{#key teeUp}<span class="count">{teeUp}</span>{/key}
	</div>
{:else}
	<form class="answer" onsubmit={submit}>
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
			value={draft}
			oninput={(e) => ondraft(e.currentTarget.value)}
		/>
		<AutoCorrectCard id="autocorrect" entity={suggestion} />
		<p id="answer-help">Swing submits the corrected name. Keep typing to change it.</p>
		<div class="spacer"></div>
		<button class="btn-primary" type="submit" disabled={swinging}>SWING</button>
	</form>
{/if}

<style>
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

	@media (min-width: 960px) {
		/* SWING sits right under the answer, not at the bottom of the window. */
		.answer .spacer {
			display: none;
		}

		.answer .btn-primary {
			margin-top: 8px;
		}

		.prompt-card h1 {
			font-size: 28px;
		}
	}
</style>
