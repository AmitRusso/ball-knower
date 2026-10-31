// Caches the app shell (built JS/CSS, the prerendered pages, fonts and icons)
// so repeat visits start instantly and the shell opens offline. The API is
// never cached here: the hole, swings and answers always go to the network,
// and pools already carry immutable HTTP caching (`?v=`).

import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { self } from '$app/service-worker';

const CACHE = `bk-shell-${version}`;
// Manifest paths are relative to the base path, which is the site root here.
const SHELL = [...immutable, ...assets, ...prerendered].map(({ path }) =>
	path.startsWith('/') ? path : `/${path}`
);
const SHELL_SET = new Set(SHELL);

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(SHELL))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

	// Built assets, fonts, icons: cache first (they're versioned with this worker).
	if (SHELL_SET.has(url.pathname) && request.mode !== 'navigate') {
		event.respondWith(caches.match(url.pathname).then((hit) => hit ?? fetch(request)));
		return;
	}

	// Pages: network first, so a new deploy shows up at once; the cached shell when offline.
	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request).catch(async () => {
				const cache = await caches.open(CACHE);
				return (
					(await cache.match(url.pathname)) ??
					(await cache.match('/')) ??
					new Response('Offline', { status: 503 })
				);
			})
		);
	}
});
