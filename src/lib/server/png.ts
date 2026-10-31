// A tiny raster canvas and PNG encoder for the share-card image: flat
// rectangles, a triangle and a 5×7 pixel font, written as an 8-bit palette
// PNG. No dependencies; deflate comes from the runtime's CompressionStream.

export type Rgb = readonly [number, number, number];

/** 5×7 glyphs, one string per row ('#' = on). */
const FONT: Record<string, string[]> = {
	A: [' ### ', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
	B: ['#### ', '#   #', '#   #', '#### ', '#   #', '#   #', '#### '],
	C: [' ### ', '#   #', '#    ', '#    ', '#    ', '#   #', ' ### '],
	D: ['#### ', '#   #', '#   #', '#   #', '#   #', '#   #', '#### '],
	E: ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#####'],
	F: ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#    '],
	G: [' ### ', '#   #', '#    ', '# ###', '#   #', '#   #', ' ####'],
	H: ['#   #', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
	I: ['#####', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '#####'],
	J: ['  ###', '   # ', '   # ', '   # ', '   # ', '#  # ', ' ##  '],
	K: ['#   #', '#  # ', '# #  ', '##   ', '# #  ', '#  # ', '#   #'],
	L: ['#    ', '#    ', '#    ', '#    ', '#    ', '#    ', '#####'],
	M: ['#   #', '## ##', '# # #', '# # #', '#   #', '#   #', '#   #'],
	N: ['#   #', '##  #', '# # #', '#  ##', '#   #', '#   #', '#   #'],
	O: [' ### ', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
	P: ['#### ', '#   #', '#   #', '#### ', '#    ', '#    ', '#    '],
	Q: [' ### ', '#   #', '#   #', '#   #', '# # #', '#  # ', ' ## #'],
	R: ['#### ', '#   #', '#   #', '#### ', '# #  ', '#  # ', '#   #'],
	S: [' ####', '#    ', '#    ', ' ### ', '    #', '    #', '#### '],
	T: ['#####', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '  #  '],
	U: ['#   #', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
	V: ['#   #', '#   #', '#   #', '#   #', '#   #', ' # # ', '  #  '],
	W: ['#   #', '#   #', '#   #', '# # #', '# # #', '## ##', '#   #'],
	X: ['#   #', '#   #', ' # # ', '  #  ', ' # # ', '#   #', '#   #'],
	Y: ['#   #', '#   #', ' # # ', '  #  ', '  #  ', '  #  ', '  #  '],
	Z: ['#####', '    #', '   # ', '  #  ', ' #   ', '#    ', '#####'],
	'0': [' ### ', '#   #', '#  ##', '# # #', '##  #', '#   #', ' ### '],
	'1': ['  #  ', ' ##  ', '  #  ', '  #  ', '  #  ', '  #  ', ' ### '],
	'2': [' ### ', '#   #', '    #', '   # ', '  #  ', ' #   ', '#####'],
	'3': ['#####', '   # ', '  #  ', '   # ', '    #', '#   #', ' ### '],
	'4': ['   # ', '  ## ', ' # # ', '#  # ', '#####', '   # ', '   # '],
	'5': ['#####', '#    ', '#### ', '    #', '    #', '#   #', ' ### '],
	'6': ['  ## ', ' #   ', '#    ', '#### ', '#   #', '#   #', ' ### '],
	'7': ['#####', '    #', '   # ', '  #  ', ' #   ', ' #   ', ' #   '],
	'8': [' ### ', '#   #', '#   #', ' ### ', '#   #', '#   #', ' ### '],
	'9': [' ### ', '#   #', '#   #', ' ####', '    #', '   # ', ' ##  '],
	'#': [' # # ', ' # # ', '#####', ' # # ', '#####', ' # # ', ' # # '],
	'·': ['     ', '     ', '     ', '  #  ', '     ', '     ', '     '],
	'-': ['     ', '     ', '     ', '#####', '     ', '     ', '     '],
	' ': ['     ', '     ', '     ', '     ', '     ', '     ', '     ']
};

export const GLYPH_W = 5;
export const GLYPH_H = 7;

export class Canvas {
	readonly pixels: Uint8Array;
	readonly #palette: Rgb[] = [];

	constructor(
		readonly width: number,
		readonly height: number,
		background: Rgb
	) {
		this.pixels = new Uint8Array(width * height);
		this.pixels.fill(this.#color(background));
	}

	#color(rgb: Rgb): number {
		let i = this.#palette.findIndex((c) => c[0] === rgb[0] && c[1] === rgb[1] && c[2] === rgb[2]);
		if (i === -1) {
			if (this.#palette.length === 256) throw new Error('Palette full');
			i = this.#palette.push(rgb) - 1;
		}
		return i;
	}

	rect(x: number, y: number, w: number, h: number, rgb: Rgb): void {
		const c = this.#color(rgb);
		const x0 = Math.max(0, Math.round(x));
		const x1 = Math.min(this.width, Math.round(x + w));
		for (let row = Math.max(0, Math.round(y)); row < Math.min(this.height, y + h); row++) {
			this.pixels.fill(c, row * this.width + x0, row * this.width + x1);
		}
	}

	/** A triangle pointing right: vertical edge at `x` from `y` to `y + h`, tip at `x + w`. */
	pennant(x: number, y: number, w: number, h: number, rgb: Rgb): void {
		for (let row = 0; row < h; row++) {
			const reach = w * (1 - Math.abs(row - h / 2) / (h / 2));
			this.rect(x, y + row, reach, 1, rgb);
		}
	}

	/** Pixel-font text at `scale` px per font pixel; returns the width drawn. */
	text(s: string, x: number, y: number, scale: number, rgb: Rgb): number {
		let at = x;
		for (const ch of s.toUpperCase()) {
			const glyph = FONT[ch] ?? FONT[' '];
			glyph.forEach((line, row) => {
				for (let col = 0; col < GLYPH_W; col++) {
					if (line[col] === '#') this.rect(at + col * scale, y + row * scale, scale, scale, rgb);
				}
			});
			at += (GLYPH_W + 1) * scale;
		}
		return at - x - scale;
	}

	async png(): Promise<Uint8Array> {
		const ihdr = new Uint8Array(13);
		const view = new DataView(ihdr.buffer);
		view.setUint32(0, this.width);
		view.setUint32(4, this.height);
		ihdr.set([8, 3, 0, 0, 0], 8); // 8-bit, indexed color

		// Each scanline starts with filter type 0 (none).
		const raw = new Uint8Array((this.width + 1) * this.height);
		for (let y = 0; y < this.height; y++) {
			raw.set(this.pixels.subarray(y * this.width, (y + 1) * this.width), y * (this.width + 1) + 1);
		}
		const plte = new Uint8Array(this.#palette.flat());
		return concat([
			new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
			chunk('IHDR', ihdr),
			chunk('PLTE', plte),
			chunk('IDAT', await deflate(raw)),
			chunk('IEND', new Uint8Array())
		]);
	}
}

/** zlib-wrapped deflate, as PNG's IDAT expects. */
async function deflate(data: Uint8Array): Promise<Uint8Array> {
	const stream = new Blob([data as BlobPart])
		.stream()
		.pipeThrough(new CompressionStream('deflate'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

function chunk(type: string, data: Uint8Array): Uint8Array {
	const out = new Uint8Array(12 + data.length);
	const view = new DataView(out.buffer);
	view.setUint32(0, data.length);
	for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
	out.set(data, 8);
	view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
	return out;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});

export function crc32(bytes: Uint8Array): number {
	let c = 0xffffffff;
	for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let at = 0;
	for (const p of parts) {
		out.set(p, at);
		at += p.length;
	}
	return out;
}
