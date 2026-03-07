/**
 * Module Registry — Central catalog of available modules
 *
 * Modules register their manifests here. The game editor UI reads this
 * registry to show available modules in the Modules menu.
 */

import type { ModuleManifest, ModuleRegistryEntry } from "./module-types";

const registry = new Map<string, ModuleRegistryEntry>();

export function registerModule(manifest: ModuleManifest): void {
	registry.set(manifest.id, {
		manifest,
		loaded: false,
		instance: null,
	});
}

export function getModule(id: string): ModuleRegistryEntry | undefined {
	return registry.get(id);
}

export function getAllModules(): ModuleRegistryEntry[] {
	return Array.from(registry.values());
}

export function getModulesByCategory(
	category: string,
): ModuleRegistryEntry[] {
	return getAllModules().filter((m) => m.manifest.category === category);
}

export function getModuleManifests(): ModuleManifest[] {
	return getAllModules().map((m) => m.manifest);
}
