<script lang="ts">
	import { secondsLeft } from '#lib/play.ts';

	interface Props {
		startedAt: number;
		seconds: number;
		onexpire: () => void;
	}

	let { startedAt, seconds, onexpire }: Props = $props();

	const WARN_AT = 10;

	let now = $state(Date.now());
	const left = $derived(secondsLeft(startedAt, now, seconds));
	const display = $derived(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);

	$effect(() => {
		const timer = setInterval(() => (now = Date.now()), 250);
		return () => clearInterval(timer);
	});

	$effect(() => {
		if (left === 0) onexpire();
	});
</script>

<span class="clock" role="timer" aria-label="{left} seconds left">{display}</span>
<span class="sr-only" aria-live="assertive">
	{#if left <= WARN_AT && left > 0}{WARN_AT} seconds left{/if}
</span>

<style>
	.clock {
		min-width: 64px;
		padding: 5px 12px;
		border-radius: var(--bk-radius-pill);
		background: var(--bk-red);
		color: var(--bk-cream);
		font-family: var(--bk-font-mono);
		font-size: 14px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-align: center;
	}
</style>
