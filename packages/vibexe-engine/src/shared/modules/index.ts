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

// World Builder module
export { WORLD_BUILDER_MANIFEST } from "./world-builder";

// Sky & Weather Advanced module (Tenkoku conversion)
export { SKY_WEATHER_ADVANCED_MANIFEST } from "./sky-weather-advanced";

// Stylized Water 2 module (Staggart Creations conversion)
export { STYLIZED_WATER_MANIFEST } from "./stylized-water";

/** All available module manifests */
import { TERRAIN_PAINTER_MANIFEST } from "./terrain-painter";
import { SKY_WEATHER_MANIFEST } from "./sky-weather";
import { CHARACTER_SYSTEM_MANIFEST } from "./character-system";
import { WORLD_BUILDER_MANIFEST } from "./world-builder";
import { SKY_WEATHER_ADVANCED_MANIFEST } from "./sky-weather-advanced";
import { STYLIZED_WATER_MANIFEST } from "./stylized-water";
import { registerModule } from "./module-registry";

export const ALL_MODULE_MANIFESTS = [TERRAIN_PAINTER_MANIFEST, SKY_WEATHER_MANIFEST, CHARACTER_SYSTEM_MANIFEST, WORLD_BUILDER_MANIFEST, SKY_WEATHER_ADVANCED_MANIFEST, STYLIZED_WATER_MANIFEST];

// Auto-register all manifests so getAllModules()/getModule() actually return data
for (const manifest of ALL_MODULE_MANIFESTS) {
	registerModule(manifest);
}
