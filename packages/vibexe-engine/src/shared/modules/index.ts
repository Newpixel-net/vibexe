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

// Sky & Weather module
export { SKY_WEATHER_MANIFEST } from "./sky-weather";

// Character System module
export { CHARACTER_SYSTEM_MANIFEST } from "./character-system";

/** All available module manifests */
import { TERRAIN_PAINTER_MANIFEST } from "./terrain-painter";
import { SKY_WEATHER_MANIFEST } from "./sky-weather";
import { CHARACTER_SYSTEM_MANIFEST } from "./character-system";
export const ALL_MODULE_MANIFESTS = [TERRAIN_PAINTER_MANIFEST, SKY_WEATHER_MANIFEST, CHARACTER_SYSTEM_MANIFEST];
