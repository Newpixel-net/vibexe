/**
 * Terrain Painter Module — Manifest & Registration
 *
 * First Vibexe module: GPU-accelerated procedural terrain texturing.
 * Converted from Unity Asset Store "Procedural Terrain Painter" by Staggart Creations.
 *
 * Features:
 * - Height-based texturing (snow on peaks, sand in valleys)
 * - Slope-based texturing (rock on cliffs, grass on flat areas)
 * - Curvature-based texturing (dirt in crevices, moss on ridges)
 * - Noise-based organic variation
 * - Direction-based texturing (sun-facing vs shadow)
 * - Texture mask overlays
 * - Up to 8 texture layers with modifier stacks
 * - GPU-accelerated via WebGLRenderTarget pipeline
 */

import type { ModuleManifest } from "../module-types";

export const TERRAIN_PAINTER_MANIFEST: ModuleManifest = {
	id: "terrain-painter",
	name: "Procedural Terrain Painter",
	version: "1.0.0",
	category: "terrain",
	description:
		"GPU-accelerated terrain texturing based on height, slope, curvature, noise & direction",
	icon: "Mountain",
	assets: [
		"textures/terrain/grass.jpg",
		"textures/terrain/rock.jpg",
		"textures/terrain/sand.jpg",
		"textures/terrain/snow.jpg",
		"textures/terrain/dirt.jpg",
	],
	runtimeCode: "", // Will be populated by the build system
	bridgeHandlers: {
		"terrain-painter-repaint": "handleRepaint",
		"terrain-painter-add-layer": "handleAddLayer",
		"terrain-painter-remove-layer": "handleRemoveLayer",
		"terrain-painter-add-modifier": "handleAddModifier",
		"terrain-painter-remove-modifier": "handleRemoveModifier",
		"terrain-painter-update-modifier": "handleUpdateModifier",
		"terrain-painter-update-layer": "handleUpdateLayer",
		"terrain-painter-set-resolution": "handleSetResolution",
		"terrain-painter-generate-terrain": "handleGenerateTerrain",
		"terrain-painter-load-heightmap": "handleLoadHeightmap",
	},
	defaultSettings: {
		splatmapResolution: 256,
		terrain: {
			width: 100,
			depth: 100,
			heightScale: 30,
			segments: 128,
		},
		layers: [],
	},
};

// Re-export runtime classes for direct import
export { TerrainPainter } from "./runtime/terrain-painter";
export { TerrainMesh } from "./runtime/terrain-mesh";
export { ModifierStack } from "./runtime/modifier-stack";
export { Modifier, BlendMode, FilterPass } from "./runtime/modifier";
export { LayerSettings } from "./runtime/layer-settings";
export {
	HeightModifier,
	SlopeModifier,
	CurvatureModifier,
	CurvatureSolver,
	NoiseModifier,
	NoiseType,
	DirectionModifier,
	TextureMaskModifier,
} from "./runtime/modifiers";
