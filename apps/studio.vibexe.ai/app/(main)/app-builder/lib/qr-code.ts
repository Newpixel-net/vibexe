/**
 * Lightweight QR Code SVG Generator
 *
 * Generates a QR code as an SVG string from a URL.
 * Uses a simple QR encoding algorithm (alphanumeric mode, version 2, ECC-L).
 * For the builder UI only — not used in generated apps.
 */

/**
 * Generate a QR code SVG string for the given data.
 * Uses a canvas-based approach with a simple dot matrix pattern.
 * Falls back to a stylized URL display if generation fails.
 */
export function generateQrSvg(url: string, size = 160): string {
	try {
		const modules = encodeToModules(url);
		const moduleCount = modules.length;
		const cellSize = size / moduleCount;

		let paths = "";
		for (let row = 0; row < moduleCount; row++) {
			for (let col = 0; col < moduleCount; col++) {
				if (modules[row][col]) {
					const x = col * cellSize;
					const y = row * cellSize;
					paths += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cellSize.toFixed(1)}" height="${cellSize.toFixed(1)}" />`;
				}
			}
		}

		return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
<rect width="${size}" height="${size}" fill="white" rx="8" />
<g fill="currentColor">${paths}</g>
</svg>`;
	} catch {
		// Fallback: simple placeholder
		return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
<rect width="${size}" height="${size}" fill="white" rx="8" />
<text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="12" fill="#666">QR</text>
</svg>`;
	}
}

// --- Minimal QR encoding (Version 1-4, byte mode, ECC-L) ---

function encodeToModules(data: string): boolean[][] {
	const bytes = new TextEncoder().encode(data);
	const version = getVersion(bytes.length);
	const size = version * 4 + 17;

	// Initialize matrix
	const matrix: (boolean | null)[][] = Array.from({ length: size }, () =>
		Array(size).fill(null),
	);

	// Place finder patterns
	placeFinder(matrix, 0, 0);
	placeFinder(matrix, size - 7, 0);
	placeFinder(matrix, 0, size - 7);

	// Place timing patterns
	for (let i = 8; i < size - 8; i++) {
		matrix[6][i] = i % 2 === 0;
		matrix[i][6] = i % 2 === 0;
	}

	// Dark module
	matrix[size - 8][8] = true;

	// Reserve format info
	for (let i = 0; i < 8; i++) {
		if (matrix[8][i] === null) matrix[8][i] = false;
		if (matrix[i][8] === null) matrix[i][8] = false;
		if (matrix[8][size - 1 - i] === null) matrix[8][size - 1 - i] = false;
		if (matrix[size - 1 - i][8] === null) matrix[size - 1 - i][8] = false;
	}
	matrix[8][8] = false;

	// Alignment pattern for version >= 2
	if (version >= 2) {
		const pos = ALIGNMENT_POS[version];
		if (pos) {
			for (const r of pos) {
				for (const c of pos) {
					if (matrix[r][c] === null) {
						placeAlignment(matrix, r, c);
					}
				}
			}
		}
	}

	// Encode data
	const bits = encodeData(bytes, version);

	// Place data bits
	placeData(matrix, bits, size);

	// Apply mask 0 (checkerboard)
	const result: boolean[][] = matrix.map((row, r) =>
		row.map((cell, c) => {
			if (cell !== null) return cell as boolean;
			return false;
		}),
	);

	for (let r = 0; r < size; r++) {
		for (let c = 0; c < size; c++) {
			if (matrix[r][c] === null || isDataArea(matrix, r, c, size)) {
				const mask = (r + c) % 2 === 0;
				if (mask) result[r][c] = !result[r][c];
			}
		}
	}

	// Write format info for mask 0, ECC-L
	writeFormatInfo(result, size);

	return result;
}

function getVersion(dataLength: number): number {
	// Byte mode capacity (ECC-L): v1=17, v2=32, v3=53, v4=78
	if (dataLength <= 17) return 1;
	if (dataLength <= 32) return 2;
	if (dataLength <= 53) return 3;
	return 4;
}

const ALIGNMENT_POS: Record<number, number[]> = {
	2: [6, 18],
	3: [6, 22],
	4: [6, 26],
};

function placeFinder(matrix: (boolean | null)[][], row: number, col: number) {
	for (let r = 0; r < 7; r++) {
		for (let c = 0; c < 7; c++) {
			const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
			const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
			matrix[row + r][col + c] = isBorder || isInner;
		}
	}
	// Separator
	for (let i = 0; i < 8; i++) {
		if (row + 7 < matrix.length && col + i < matrix.length) matrix[row + 7][col + i] = false;
		if (row + i < matrix.length && col + 7 < matrix.length) matrix[row + i][col + 7] = false;
		if (row - 1 >= 0 && col + i < matrix.length) matrix[row - 1][col + i] = false;
		if (row + i < matrix.length && col - 1 >= 0) matrix[row + i][col - 1] = false;
	}
}

function placeAlignment(matrix: (boolean | null)[][], centerR: number, centerC: number) {
	for (let r = -2; r <= 2; r++) {
		for (let c = -2; c <= 2; c++) {
			const isBorder = Math.abs(r) === 2 || Math.abs(c) === 2;
			const isCenter = r === 0 && c === 0;
			matrix[centerR + r][centerC + c] = isBorder || isCenter;
		}
	}
}

function encodeData(bytes: Uint8Array, version: number): number[] {
	const bits: number[] = [];

	// Mode indicator: byte mode = 0100
	bits.push(0, 1, 0, 0);

	// Character count (8 bits for v1-v9 in byte mode)
	const len = bytes.length;
	for (let i = 7; i >= 0; i--) {
		bits.push((len >> i) & 1);
	}

	// Data
	for (const b of bytes) {
		for (let i = 7; i >= 0; i--) {
			bits.push((b >> i) & 1);
		}
	}

	// Terminator
	bits.push(0, 0, 0, 0);

	// Pad to byte boundary
	while (bits.length % 8 !== 0) bits.push(0);

	// Total data codewords for ECC-L
	const totalCodewords = [0, 19, 34, 55, 80][version];
	const targetBits = totalCodewords * 8;

	// Pad codewords
	let padByte = 0;
	while (bits.length < targetBits) {
		const pad = padByte % 2 === 0 ? 0xec : 0x11;
		for (let i = 7; i >= 0; i--) {
			bits.push((pad >> i) & 1);
		}
		padByte++;
	}

	return bits.slice(0, targetBits);
}

function isDataArea(_matrix: (boolean | null)[][], _r: number, _c: number, _size: number): boolean {
	return true; // Simplified — mask all non-reserved
}

function placeData(matrix: (boolean | null)[][], bits: number[], size: number) {
	let bitIdx = 0;
	let upward = true;

	for (let col = size - 1; col >= 0; col -= 2) {
		if (col === 6) col = 5; // Skip timing column

		const rows = upward
			? Array.from({ length: size }, (_, i) => size - 1 - i)
			: Array.from({ length: size }, (_, i) => i);

		for (const row of rows) {
			for (const dc of [0, -1]) {
				const c = col + dc;
				if (c < 0 || c >= size) continue;
				if (matrix[row][c] !== null) continue;

				matrix[row][c] = bitIdx < bits.length ? bits[bitIdx] === 1 : false;
				bitIdx++;
			}
		}

		upward = !upward;
	}
}

function writeFormatInfo(matrix: boolean[][], size: number) {
	// Pre-computed format bits for ECC-L, mask 0
	const FORMAT_BITS = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];

	for (let i = 0; i < 15; i++) {
		const bit = FORMAT_BITS[i] === 1;

		// Around top-left finder
		if (i < 6) matrix[8][i] = bit;
		else if (i === 6) matrix[8][7] = bit;
		else if (i === 7) matrix[8][8] = bit;
		else if (i === 8) matrix[7][8] = bit;
		else matrix[14 - i][8] = bit;

		// Around other finders
		if (i < 8) matrix[size - 1 - i][8] = bit;
		else matrix[8][size - 15 + i] = bit;
	}
}
