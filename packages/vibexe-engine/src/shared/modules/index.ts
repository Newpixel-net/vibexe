/**
 * Vibexe Module System — Central exports
 */

// Module infrastructure
export type {
	ModuleManifest,
	ModuleCategory,
	ModuleInstance,
	ModuleRegistryEntry,
	ModuleMessage,
} from "./module-types";
export {
	registerModule,
	getModule,
	getAllModules,
	getModulesByCategory,
	getModuleManifests,
} from "./module-registry";

// Terrain Painter module
export { TERRAIN_PAINTER_MANIFEST } from "./terrain-painter";

/** All available module manifests */
import { TERRAIN_PAINTER_MANIFEST } from "./terrain-painter";
export const ALL_MODULE_MANIFESTS = [TERRAIN_PAINTER_MANIFEST];
