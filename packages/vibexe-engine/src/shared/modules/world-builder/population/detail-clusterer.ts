/**
 * DetailClusterer — Concentric cluster generation around seed points
 * Ported from SuperiorWorlds WorldBuilder (DetailClusterer.cs)
 *
 * For "detail" objects (grass, small rocks, flowers), you often want
 * clusters of many instances around each Poisson-sampled seed point.
 * This module generates concentric ring patterns for natural clustering.
 */

import type { Vector2 } from "./fast-poisson-disk-sampling";

/**
 * Generate concentric cluster positions around a center point.
 *
 * Creates points in concentric rings, with the number of points
 * per ring increasing with ring index. This produces natural-looking
 * clusters that are denser near the center.
 *
 * @param center — The seed position (from Poisson sampling)
 * @param clusterRadius — Maximum radius of the cluster
 * @param clusterAmount — Target number of objects per cluster
 * @returns Array of positions forming a concentric cluster pattern
 */
export function calculateConcentricClusterPositions(
	center: Vector2,
	clusterRadius: number,
	clusterAmount: number,
): Vector2[] {
	if (clusterAmount <= 0 || clusterRadius <= 0) {
		return [center];
	}

	const positions: Vector2[] = [];

	// Always include the center point
	positions.push({ ...center });

	if (clusterAmount <= 1) return positions;

	// Calculate number of rings needed
	// Each ring i has (i * 4) points (approximation)
	// Total points = sum(i * 4) for i = 1..n = 2n(n+1)
	let remaining = clusterAmount - 1; // minus center
	let ringIndex = 1;

	while (remaining > 0) {
		const ringRadius = (clusterRadius * ringIndex) / Math.ceil(Math.sqrt(clusterAmount));
		const pointsInRing = Math.min(remaining, Math.max(3, ringIndex * 4));
		const angleStep = (Math.PI * 2) / pointsInRing;

		// Offset alternate rings for more natural distribution
		const angleOffset = ringIndex % 2 === 0 ? 0 : angleStep * 0.5;

		for (let i = 0; i < pointsInRing && remaining > 0; i++) {
			const angle = i * angleStep + angleOffset;

			// Add small random jitter (up to 20% of ring radius)
			const jitterR = ringRadius * 0.2 * (Math.random() - 0.5);
			const jitterA = angleStep * 0.3 * (Math.random() - 0.5);

			positions.push({
				x: center.x + Math.cos(angle + jitterA) * (ringRadius + jitterR),
				y: center.y + Math.sin(angle + jitterA) * (ringRadius + jitterR),
			});

			remaining--;
		}

		ringIndex++;
	}

	return positions;
}

/**
 * Seeded version of concentric cluster positions for deterministic results.
 */
export function calculateConcentricClusterPositionsSeeded(
	center: Vector2,
	clusterRadius: number,
	clusterAmount: number,
	seed: number,
): Vector2[] {
	if (clusterAmount <= 0 || clusterRadius <= 0) {
		return [center];
	}

	// mulberry32 PRNG
	let s = seed | 0;
	function rand(): number {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	const positions: Vector2[] = [];
	positions.push({ ...center });

	if (clusterAmount <= 1) return positions;

	let remaining = clusterAmount - 1;
	let ringIndex = 1;

	while (remaining > 0) {
		const ringRadius = (clusterRadius * ringIndex) / Math.ceil(Math.sqrt(clusterAmount));
		const pointsInRing = Math.min(remaining, Math.max(3, ringIndex * 4));
		const angleStep = (Math.PI * 2) / pointsInRing;
		const angleOffset = ringIndex % 2 === 0 ? 0 : angleStep * 0.5;

		for (let i = 0; i < pointsInRing && remaining > 0; i++) {
			const angle = i * angleStep + angleOffset;
			const jitterR = ringRadius * 0.2 * (rand() - 0.5);
			const jitterA = angleStep * 0.3 * (rand() - 0.5);

			positions.push({
				x: center.x + Math.cos(angle + jitterA) * (ringRadius + jitterR),
				y: center.y + Math.sin(angle + jitterA) * (ringRadius + jitterR),
			});

			remaining--;
		}

		ringIndex++;
	}

	return positions;
}

/**
 * Expand detail seed positions into clustered positions.
 * Takes Poisson-sampled seed points and generates clusters around each.
 *
 * @param seedPoints — Points from filterPoints() (Poisson-sampled, heatmap-filtered)
 * @param clusterRadius — How far cluster members spread from seed
 * @param clusterAmount — How many objects per cluster
 * @param seed — Optional seed for deterministic results
 * @returns Expanded array of positions (seedPoints.length * ~clusterAmount)
 */
export function expandClusters(
	seedPoints: Vector2[],
	clusterRadius: number,
	clusterAmount: number,
	seed?: number,
): Vector2[] {
	if (clusterAmount <= 1 || clusterRadius <= 0) {
		return [...seedPoints];
	}

	const expanded: Vector2[] = [];

	for (let i = 0; i < seedPoints.length; i++) {
		const pointSeed = seed !== undefined ? (seed + i * 7919) | 0 : undefined;

		const cluster =
			pointSeed !== undefined
				? calculateConcentricClusterPositionsSeeded(
						seedPoints[i],
						clusterRadius,
						clusterAmount,
						pointSeed,
					)
				: calculateConcentricClusterPositions(
						seedPoints[i],
						clusterRadius,
						clusterAmount,
					);

		for (const p of cluster) {
			expanded.push(p);
		}
	}

	return expanded;
}
