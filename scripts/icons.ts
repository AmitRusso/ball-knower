// Rasterize design/icon.svg into the PWA and home-screen icons in static/icons/.
// The glyph sits inside the maskable safe zone (a circle of 40% radius), so the
// full-bleed square works as a maskable icon; the "any" icons get rounded corners.
//
//   node scripts/icons.ts
//
// Uses Playwright's Chromium (already a dev dependency) as the rasterizer.

import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const svg = readFileSync('design/icon.svg', 'utf8');
const ICONS = [
	{ file: 'icon-192.png', size: 192, rounded: true },
	{ file: 'icon-512.png', size: 512, rounded: true },
	{ file: 'icon-maskable-512.png', size: 512, rounded: false },
	// iOS rounds home-screen icons itself.
	{ file: 'apple-touch-icon.png', size: 180, rounded: false }
];

const browser = await chromium.launch();
for (const { file, size, rounded } of ICONS) {
	const page = await browser.newPage({ viewport: { width: size, height: size } });
	const radius = rounded ? size * 0.1875 : 0;
	await page.setContent(
		`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px;border-radius:${radius}px}</style>${svg}`
	);
	await page.screenshot({ path: `static/icons/${file}`, omitBackground: true });
	await page.close();
}
await browser.close();
console.log(`Wrote ${ICONS.length} icons to static/icons/.`);
