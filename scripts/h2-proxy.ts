// HTTP/2 (TLS) front for `pnpm preview`, so Lighthouse CI measures over
// HTTP/2 like Cloudflare serves production. Over wrangler's local HTTP/1.1,
// Lighthouse's slow-4G model queues the page's ~20 requests on six
// connections and overstates LCP (docs/06-decisions.md, D17).
//
//   node scripts/h2-proxy.ts <key.pem> <cert.pem>     https://localhost:4443 -> http://localhost:4173

import { readFileSync } from 'node:fs';
import { request } from 'node:http';
import { createSecureServer } from 'node:http2';

const [key, cert] = process.argv.slice(2);
if (!key || !cert) throw new Error('Usage: node scripts/h2-proxy.ts <key.pem> <cert.pem>');

const UPSTREAM = { host: 'localhost', port: 4173 };
const PORT = 4443;
// Connection-specific headers are not allowed in HTTP/2 responses.
const HOP = new Set([
	'connection',
	'keep-alive',
	'transfer-encoding',
	'upgrade',
	'proxy-connection'
]);

createSecureServer({ key: readFileSync(key), cert: readFileSync(cert) }, (req, res) => {
	const headers = Object.fromEntries(
		Object.entries(req.headers).filter(([name]) => !name.startsWith(':') && !HOP.has(name))
	);
	const upstream = request(
		{
			...UPSTREAM,
			method: req.method,
			path: req.url,
			headers: { ...headers, host: 'localhost:4173' }
		},
		(up) => {
			for (const [name, value] of Object.entries(up.headers)) {
				if (!HOP.has(name) && value !== undefined) res.setHeader(name, value);
			}
			res.writeHead(up.statusCode ?? 502);
			up.pipe(res);
		}
	);
	upstream.on('error', () => {
		res.writeHead(502);
		res.end();
	});
	req.pipe(upstream);
}).listen(PORT, () => console.log(`HTTP/2 proxy on https://localhost:${PORT}`));
