/**
 * TerrainAnalyzer — Bridge between Terrain Painter and Population Engine
 *
 * Reads the Terrain Painter's runtime data (heightmap, splatmaps, normals)
 * and converts it into the format needed by PopulationEngine.
 *
 * This is the "smart bridge" that makes two separate modules work together:
 * - Terrain Painter owns the terrain mesh + GPU modifier pipeline
 * - Population Engine needs heightmap + slope + curvature + splatmap data
 *
 * TerrainAnalyzer extracts that data without coupling the modules directly.
 */

import type { TerrainInfo } from "./population-engine";

/**
 * Extract terrain data from a Terrain Painter runtime instance.
 *
 * Expected runtime shape (from window.__vibexe_terrainPainter__):
 * {
 *   terrain: TerrainMesh {
 *     mesh, config, heightmapTexture, normalMapTexture
 *     heightData (private but accessible via getTerrainData)
 *   },
 *   layers: LayerSettings[],
 *   modifierStack: ModifierStack { splatmaps: WebGLRenderTarget[] }
 * }
 */
export function extractTerrainInfo(painter: any): TerrainInfo | null {
	if (!painter || !painter.terrain) return null;

	const terrainMesh = painter.terrain;
	const config = terrainMesh.config;
	const pos = terrainMesh.mesh?.position || { x: 0, y: 0, z: 0 };

	// Get heightmap data
	const heightmapTex = terrainMesh.heightmapTexture;
	if (!heightmapTex || !heightmapTex.image || !heightmapTex.image.data) {
		return null;
	}

	const heightData = heightmapTex.image.data as Float32Array;
	const resolution = config.segments + 1;

	const hw = config.width / 2;
	const hd = config.depth / 2;

	const info: TerrainInfo = {
		heightData,
		resolution,
		bounds: {
			minX: pos.x - hw,
			maxX: pos.x + hw,
			minZ: pos.z - hd,
			maxZ: pos.z + hd,
			minY: 0,
			maxY: config.heightScale,
		},
	};

	// Try to extract splatmap data for splatmap-based rules
	try {
		const splatmapLayers = extractSplatmapLayers(painter, resolution);
		if (splatmapLayers.length > 0) {
			info.splatmapLayers = splatmapLayers;
		}
	} catch {
		// Splatmap extraction is optional — population works without it
	}

	return info;
}

/**
 * Extract per-layer splatmap data from the modifier stack's GPU render targets.
 *
 * This does a GPU readback: reads pixels from WebGLRenderTarget to CPU.
 * Each splatmap target has RGBA channels = 4 layers.
 *
 * Returns: Float32Array[] where index = layer index, values = 0-1 coverage
 */
function extractSplatmapLayers(painter: any, terrainRes: number): Float32Array[] {
	const renderer = painter.renderer || (painter as any)._renderer;
	const modStack = (painter as any).modifierStack;

	if (!renderer || !modStack) return [];

	const splatmaps: any[] = modStack.splatmaps || [];
	if (splatmaps.length === 0) return [];

	const layers: Float32Array[] = [];

	for (const splatmapRT of splatmaps) {
		if (!splatmapRT) continue;

		const width = splatmapRT.width;
		const height = splatmapRT.height;
		if (!width || !height) continue;
		const pixels = new Uint8Array(width * height * 4);

		// GPU readback
		renderer.readRenderTargetPixels(splatmapRT, 0, 0, width, height, pixels);

		// Extract each RGBA channel as a separate layer
		for (let c = 0; c < 4; c++) {
			const layerData = new Float32Array(width * height);
			for (let i = 0; i < width * height; i++) {
				layerData[i] = pixels[i * 4 + c] / 255;
			}

			// Resample to terrain resolution if needed
			if (width !== terrainRes) {
				layers.push(resample(layerData, width, height, terrainRes, terrainRes));
			} else {
				layers.push(layerData);
			}
		}
	}

	return layers;
}

/**
 * Extract heightmap data from the terrain mesh when the painter object
 * structure is unknown (fallback method).
 *
 * Reads vertex Y positions directly from the PlaneGeometry.
 */
export function extractHeightFromGeometry(mesh: any): {
	heightData: Float32Array;
	resolution: number;
	bounds: TerrainInfo["bounds"];
} | null {
	if (!mesh || !mesh.geometry) return null;

	const positions = mesh.geometry.attributes?.position?.array;
	if (!positions) return null;

	const vertexCount = positions.length / 3;
	const resolution = Math.floor(Math.sqrt(vertexCount));
	if (resolution * resolution !== vertexCount) return null;

	const heightData = new Float32Array(vertexCount);
	let minY = Infinity;
	let maxY = -Infinity;
	let minX = Infinity;
	let maxX = -Infinity;
	let minZ = Infinity;
	let maxZ = -Infinity;

	for (let i = 0; i < vertexCount; i++) {
		const x = positions[i * 3];
		const y = positions[i * 3 + 1];
		const z = positions[i * 3 + 2];

		minX = Math.min(minX, x);
		maxX = Math.max(maxX, x);
		minY = Math.min(minY, y);
		maxY = Math.max(maxY, y);
		minZ = Math.min(minZ, z);
		maxZ = Math.max(maxZ, z);
	}

	// Normalize heights to 0-1
	const heightRange = maxY - minY || 1;
	for (let i = 0; i < vertexCount; i++) {
		heightData[i] = (positions[i * 3 + 1] - minY) / heightRange;
	}

	// Apply mesh world position offset
	const worldPos = mesh.position || { x: 0, y: 0, z: 0 };

	return {
		heightData,
		resolution,
		bounds: {
			minX: minX + worldPos.x,
			maxX: maxX + worldPos.x,
			minZ: minZ + worldPos.z,
			maxZ: maxZ + worldPos.z,
			minY: minY + worldPos.y,
			maxY: maxY + worldPos.y,
		},
	};
}

/** Bilinear resample a 2D float array to new dimensions */
function resample(
	src: Float32Array,
	srcW: number,
	srcH: number,
	dstW: number,
	dstH: number,
): Float32Array {
	const dst = new Float32Array(dstW * dstH);

	for (let y = 0; y < dstH; y++) {
		for (let x = 0; x < dstW; x++) {
			const srcX = dstW <= 1 ? 0 : (x / (dstW - 1)) * (srcW - 1);
			const srcY = dstH <= 1 ? 0 : (y / (dstH - 1)) * (srcH - 1);

			const x0 = Math.floor(srcX);
			const y0 = Math.floor(srcY);
			const x1 = Math.min(x0 + 1, srcW - 1);
			const y1 = Math.min(y0 + 1, srcH - 1);
			const dx = srcX - x0;
			const dy = srcY - y0;

			const v00 = src[y0 * srcW + x0];
			const v10 = src[y0 * srcW + x1];
			const v01 = src[y1 * srcW + x0];
			const v11 = src[y1 * srcW + x1];

			dst[y * dstW + x] =
				v00 * (1 - dx) * (1 - dy) +
				v10 * dx * (1 - dy) +
				v01 * (1 - dx) * dy +
				v11 * dx * dy;
		}
	}

	return dst;
}
