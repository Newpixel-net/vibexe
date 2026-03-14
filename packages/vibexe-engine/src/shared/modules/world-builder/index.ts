/**
 * World Builder Module — Manifest
 *
 * PWB-style object placement system with 12 tools:
 * Pin, Brush, Gravity, Line, Shape, Floor, Wall, Eraser, Replacer, Select, Extrude, Mirror.
 *
 * Runtime code is loaded via separate bridge script (world-builder-bridge.ts),
 * not embedded in the manifest like terrain-painter. The manifest only registers
 * the module for the settings/modules UI.
 */

import type { ModuleManifest } from "../module-types";

// Population system (heatmap-driven Poisson sampling)
export * from "./population";

export const WORLD_BUILDER_MANIFEST: ModuleManifest = {
	id: "world-builder",
	name: "World Builder",
	version: "1.0.0",
	category: "level-design",
	description:
		"Place, scatter, and arrange 3D objects with 12 placement tools — Pin, Brush, Line, Shape, Grid, Eraser & more",
	icon: "Layers",
	assets: [],
	runtimeCode: `
// World Builder runtime is loaded via /api/app-builder/world-builder-bridge
// This module manifest only registers WB in the module system.
// No inline runtime code needed.
console.log("[WorldBuilder] Module registered (bridge loaded separately)");
`,
	bridgeHandlers: {},
	defaultSettings: {},
};
