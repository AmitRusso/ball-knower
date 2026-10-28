import { defineConfig } from '@playwright/test';

export default defineConfig({
	// A fresh local D1 every run: plays and pick counts start from zero.
	webServer: {
		command: 'pnpm db:migrate && pnpm db:seed && pnpm build && pnpm preview',
		port: 4173,
		timeout: 180_000
	},
	testMatch: '**/*.e2e.{ts,js}',
	// Tests share one database, and tiers depend on earlier picks: run them in order.
	workers: 1
});
