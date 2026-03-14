/**
 * PositionGenerator — Heatmap-filtered Poisson sampling
 * Ported from SuperiorWorlds WorldBuilder (PositionGenerator.cs)
 *
 * Generates candidate positions via Poisson Disk Sampling, then filters them
 * against a heatmap (grayscale density map). Only points where the heatmap
 * value falls within [minThreshold, maxThreshold] are kept.
 *
 * The heatmap can be:
 * - A custom painted texture (ImageData from canvas)
 * - Auto-generated from terrain analysis (Float32Array from GPU readback)
 */

import {
	poissonDiskSampling,
	poissonDiskSamplingSeeded,
	type Vector2,
} from "./fast-poisson-disk-sampling";

export type { Vector2 };

export interface HeatmapData {
	/** Grayscale values, 0-1 range, row-major (top-left origin) */
	data: Float32Array | Uint8Array;
	width: number;
	height: number;
}

export interface FilterOptions {
	/** Minimum heatmap value to accept (0-1, default 0.5) */
	minThreshold: number;
	/** Maximum heatmap value to accept (0-1, default 1.0) */
	maxThreshold: number;
	/** Flip X axis (used for coordinate system conversion) */
	flipX?: boolean;
	/** Flip Z axis */
	flipZ?: boolean;
	/** Rotation angle in degrees (applied after filtering) */
	rotationAngle?: number;
}

/**
 * Generate heatmap-filtered positions using Poisson Disk Sampling.
 *
 * @param heatmap — Grayscale density map (0 = no spawn, 1 = max density)
 * @param bottomLeft — Lower-left corner of world-space region
 * @param topRight — Upper-right corner of world-space region
 * @param minimumDistance — Minimum spacing between spawned objects
 * @param options — Threshold and transform options
 * @param seed — Optional seed for deterministic results
 * @returns Filtered world-space positions where heatmap passes threshold test
 */
export function filterPoints(
	heatmap: HeatmapData,
	bottomLeft: Vector2,
	topRight: Vector2,
	minimumDistance: number,
	options: FilterOptions,
	seed?: number,
): Vector2[] {
	const { minThreshold, maxThreshold, flipX, flipZ, rotationAngle } = options;

	// Step 1: Generate candidate positions via Poisson sampling
	const candidates =
		seed !== undefined
			? poissonDiskSamplingSeeded(bottomLeft, topRight, minimumDistance, seed)
			: poissonDiskSampling(bottomLeft, topRight, minimumDistance);

	const regionWidth = topRight.x - bottomLeft.x;
	const regionHeight = topRight.y - bottomLeft.y;

	// Step 2: Filter by heatmap threshold
	const filtered: Vector2[] = [];

	for (const point of candidates) {
		// Map world position to heatmap UV (0-1)
		let u = (point.x - bottomLeft.x) / regionWidth;
		let v = (point.y - bottomLeft.y) / regionHeight;

		// Clamp UV
		u = Math.max(0, Math.min(1, u));
		v = Math.max(0, Math.min(1, v));

		// Sample heatmap (nearest-neighbor)
		const px = Math.floor(u * (heatmap.width - 1));
		const py = Math.floor(v * (heatmap.height - 1));
		const idx = py * heatmap.width + px;

		// Get grayscale value (normalize Uint8Array to 0-1 if needed)
		let value: number;
		if (heatmap.data instanceof Uint8Array) {
			value = heatmap.data[idx] / 255;
		} else {
			value = heatmap.data[idx];
		}

		// Threshold test
		if (value >= minThreshold && value <= maxThreshold) {
			filtered.push(point);
		}
	}

	// Step 3: Apply transforms (flip, rotation)
	if (flipX || flipZ || (rotationAngle && rotationAngle !== 0)) {
		const cx = (bottomLeft.x + topRight.x) / 2;
		const cy = (bottomLeft.y + topRight.y) / 2;
		const radians = rotationAngle ? (rotationAngle * Math.PI) / 180 : 0;
		const cos = Math.cos(radians);
		const sin = Math.sin(radians);

		for (let i = 0; i < filtered.length; i++) {
			let { x, y } = filtered[i];

			// Flip
			if (flipX) x = cx * 2 - x;
			if (flipZ) y = cy * 2 - y;

			// Rotate around center
			if (radians !== 0) {
				const dx = x - cx;
				const dy = y - cy;
				x = cx + dx * cos - dy * sin;
				y = cy + dx * sin + dy * cos;
			}

			filtered[i] = { x, y };
		}
	}

	return filtered;
}

/**
 * Create a heatmap from ImageData (e.g., from canvas.getContext('2d').getImageData()).
 * Extracts the red channel as grayscale 0-1.
 */
export function heatmapFromImageData(imageData: ImageData): HeatmapData {
	const { width, height, data } = imageData;
	const grayscale = new Float32Array(width * height);

	for (let i = 0; i < width * height; i++) {
		// Use red channel (grayscale images have R=G=B)
		grayscale[i] = data[i * 4] / 255;
	}

	return { data: grayscale, width, height };
}

/**
 * Create a uniform heatmap (all white = spawn everywhere).
 * Useful as a starting point or when no heatmap is needed.
 */
export function uniformHeatmap(width: number, height: number, value = 1.0): HeatmapData {
	const data = new Float32Array(width * height).fill(value);
	return { data, width, height };
}

/**
 * Composite multiple heatmaps using blend modes.
 * Each rule contributes to the final composite heatmap.
 */
export function compositeHeatmaps(
	heatmaps: { data: HeatmapData; blendMode: BlendMode; invert: boolean }[],
	outputWidth: number,
	outputHeight: number,
): HeatmapData {
	const result = new Float32Array(outputWidth * outputHeight).fill(1.0);

	for (const { data: hm, blendMode, invert } of heatmaps) {
		for (let y = 0; y < outputHeight; y++) {
			for (let x = 0; x < outputWidth; x++) {
				const outIdx = y * outputWidth + x;

				// Sample source heatmap (bilinear if sizes differ)
				const srcX = (x / outputWidth) * (hm.width - 1);
				const srcY = (y / outputHeight) * (hm.height - 1);
				let srcVal = sampleBilinear(hm, srcX, srcY);

				if (invert) srcVal = 1.0 - srcVal;
				srcVal = Math.max(0, Math.min(1, srcVal));

				// Blend
				switch (blendMode) {
					case "multiply":
						result[outIdx] *= srcVal;
						break;
					case "add":
						result[outIdx] = Math.min(1, result[outIdx] + srcVal);
						break;
					case "min":
						result[outIdx] = Math.min(result[outIdx], srcVal);
						break;
					case "max":
						result[outIdx] = Math.max(result[outIdx], srcVal);
						break;
				}
			}
		}
	}

	return { data: result, width: outputWidth, height: outputHeight };
}

export type BlendMode = "multiply" | "add" | "min" | "max";

/** Bilinear sample from a heatmap at fractional coordinates */
function sampleBilinear(hm: HeatmapData, fx: number, fy: number): number {
	fx = Math.max(0, Math.min(fx, hm.width - 1));
	fy = Math.max(0, Math.min(fy, hm.height - 1));
	const x0 = Math.floor(fx);
	const y0 = Math.floor(fy);
	const x1 = Math.min(x0 + 1, hm.width - 1);
	const y1 = Math.min(y0 + 1, hm.height - 1);
	const dx = fx - x0;
	const dy = fy - y0;

	const getValue = (px: number, py: number): number => {
		const idx = py * hm.width + px;
		if (hm.data instanceof Uint8Array) {
			return hm.data[idx] / 255;
		}
		return hm.data[idx];
	};

	const v00 = getValue(x0, y0);
	const v10 = getValue(x1, y0);
	const v01 = getValue(x0, y1);
	const v11 = getValue(x1, y1);

	return v00 * (1 - dx) * (1 - dy) + v10 * dx * (1 - dy) + v01 * (1 - dx) * dy + v11 * dx * dy;
}
