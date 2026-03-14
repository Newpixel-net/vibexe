/**
 * FastPoissonDiskSampling — Bridson's algorithm for generating well-distributed points
 * Ported from SuperiorWorlds WorldBuilder (FastPoissonDiskSampling.cs)
 *
 * Reference: Robert Bridson, "Fast Poisson Disk Sampling in Arbitrary Dimensions"
 * ACM SIGGRAPH 2007 Sketches
 *
 * Key property: ALL points maintain a minimum distance from each other,
 * producing natural-looking distributions without clumping or regular patterns.
 */

export interface Vector2 {
	x: number;
	y: number;
}

const INVERT_ROOT_TWO = 0.70710678118;
const DEFAULT_ITERATIONS_PER_POINT = 3;

/**
 * Generate a set of points distributed via Poisson Disk Sampling.
 *
 * @param bottomLeft — lower-left corner of the sampling region
 * @param topRight  — upper-right corner of the sampling region
 * @param minimumDistance — minimum separation between any two points
 * @param iterationsPerPoint — candidate attempts per active point (default 3)
 * @returns Array of well-distributed points within the rectangle
 */
export function poissonDiskSampling(
	bottomLeft: Vector2,
	topRight: Vector2,
	minimumDistance: number,
	iterationsPerPoint: number = DEFAULT_ITERATIONS_PER_POINT,
): Vector2[] {
	const width = topRight.x - bottomLeft.x;
	const height = topRight.y - bottomLeft.y;

	// Cell size is minimumDistance / sqrt(2) so each cell can contain at most one sample
	const cellSize = minimumDistance * INVERT_ROOT_TWO;

	// Grid dimensions
	const gridWidth = Math.ceil(width / cellSize) + 1;
	const gridHeight = Math.ceil(height / cellSize) + 1;

	// Grid stores index into points array (-1 = empty)
	const grid: Int32Array = new Int32Array(gridWidth * gridHeight).fill(-1);

	const points: Vector2[] = [];
	const activeList: number[] = []; // indices into points[]

	const minDistSq = minimumDistance * minimumDistance;

	// Helper: grid index from world position
	function worldToGrid(p: Vector2): { gx: number; gy: number } {
		return {
			gx: Math.floor((p.x - bottomLeft.x) / cellSize),
			gy: Math.floor((p.y - bottomLeft.y) / cellSize),
		};
	}

	// Helper: check if a candidate point is valid
	function isValid(candidate: Vector2): boolean {
		// Bounds check
		if (
			candidate.x < bottomLeft.x ||
			candidate.x > topRight.x ||
			candidate.y < bottomLeft.y ||
			candidate.y > topRight.y
		) {
			return false;
		}

		const { gx, gy } = worldToGrid(candidate);

		// Check 5x5 neighborhood in grid
		const minGx = Math.max(0, gx - 2);
		const maxGx = Math.min(gridWidth - 1, gx + 2);
		const minGy = Math.max(0, gy - 2);
		const maxGy = Math.min(gridHeight - 1, gy + 2);

		for (let y = minGy; y <= maxGy; y++) {
			for (let x = minGx; x <= maxGx; x++) {
				const idx = grid[y * gridWidth + x];
				if (idx !== -1) {
					const dx = points[idx].x - candidate.x;
					const dy = points[idx].y - candidate.y;
					if (dx * dx + dy * dy < minDistSq) {
						return false;
					}
				}
			}
		}

		return true;
	}

	// Helper: add a valid point
	function addPoint(p: Vector2): void {
		const index = points.length;
		points.push(p);
		activeList.push(index);

		const { gx, gy } = worldToGrid(p);
		grid[gy * gridWidth + gx] = index;
	}

	// Seed: first point at center of region
	addPoint({
		x: bottomLeft.x + width * 0.5,
		y: bottomLeft.y + height * 0.5,
	});

	// Main loop: process active list
	while (activeList.length > 0) {
		// Pick a random active point
		const activeIdx = Math.floor(Math.random() * activeList.length);
		const origin = points[activeList[activeIdx]];

		let found = false;

		for (let i = 0; i < iterationsPerPoint; i++) {
			// Generate random candidate in annulus [minimumDistance, 2*minimumDistance]
			const angle = Math.random() * Math.PI * 2;
			const dist = minimumDistance + Math.random() * minimumDistance;

			const candidate: Vector2 = {
				x: origin.x + Math.cos(angle) * dist,
				y: origin.y + Math.sin(angle) * dist,
			};

			if (isValid(candidate)) {
				addPoint(candidate);
				found = true;
				break;
			}
		}

		if (!found) {
			// Remove from active list (swap with last for O(1) removal)
			activeList[activeIdx] = activeList[activeList.length - 1];
			activeList.pop();
		}
	}

	return points;
}

/**
 * Seeded version of Poisson Disk Sampling for deterministic results.
 * Uses a mulberry32 PRNG instead of Math.random().
 */
export function poissonDiskSamplingSeeded(
	bottomLeft: Vector2,
	topRight: Vector2,
	minimumDistance: number,
	seed: number,
	iterationsPerPoint: number = DEFAULT_ITERATIONS_PER_POINT,
): Vector2[] {
	// mulberry32 PRNG
	let s = seed | 0;
	function rand(): number {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	const width = topRight.x - bottomLeft.x;
	const height = topRight.y - bottomLeft.y;
	const cellSize = minimumDistance * INVERT_ROOT_TWO;

	const gridWidth = Math.ceil(width / cellSize) + 1;
	const gridHeight = Math.ceil(height / cellSize) + 1;
	const grid: Int32Array = new Int32Array(gridWidth * gridHeight).fill(-1);

	const points: Vector2[] = [];
	const activeList: number[] = [];
	const minDistSq = minimumDistance * minimumDistance;

	function worldToGrid(p: Vector2): { gx: number; gy: number } {
		return {
			gx: Math.floor((p.x - bottomLeft.x) / cellSize),
			gy: Math.floor((p.y - bottomLeft.y) / cellSize),
		};
	}

	function isValid(candidate: Vector2): boolean {
		if (
			candidate.x < bottomLeft.x ||
			candidate.x > topRight.x ||
			candidate.y < bottomLeft.y ||
			candidate.y > topRight.y
		) {
			return false;
		}
		const { gx, gy } = worldToGrid(candidate);
		const minGx = Math.max(0, gx - 2);
		const maxGx = Math.min(gridWidth - 1, gx + 2);
		const minGy = Math.max(0, gy - 2);
		const maxGy = Math.min(gridHeight - 1, gy + 2);

		for (let y = minGy; y <= maxGy; y++) {
			for (let x = minGx; x <= maxGx; x++) {
				const idx = grid[y * gridWidth + x];
				if (idx !== -1) {
					const dx = points[idx].x - candidate.x;
					const dy = points[idx].y - candidate.y;
					if (dx * dx + dy * dy < minDistSq) return false;
				}
			}
		}
		return true;
	}

	function addPoint(p: Vector2): void {
		const index = points.length;
		points.push(p);
		activeList.push(index);
		const { gx, gy } = worldToGrid(p);
		grid[gy * gridWidth + gx] = index;
	}

	addPoint({
		x: bottomLeft.x + width * 0.5,
		y: bottomLeft.y + height * 0.5,
	});

	while (activeList.length > 0) {
		const activeIdx = Math.floor(rand() * activeList.length);
		const origin = points[activeList[activeIdx]];
		let found = false;

		for (let i = 0; i < iterationsPerPoint; i++) {
			const angle = rand() * Math.PI * 2;
			const dist = minimumDistance + rand() * minimumDistance;
			const candidate: Vector2 = {
				x: origin.x + Math.cos(angle) * dist,
				y: origin.y + Math.sin(angle) * dist,
			};

			if (isValid(candidate)) {
				addPoint(candidate);
				found = true;
				break;
			}
		}

		if (!found) {
			activeList[activeIdx] = activeList[activeList.length - 1];
			activeList.pop();
		}
	}

	return points;
}
