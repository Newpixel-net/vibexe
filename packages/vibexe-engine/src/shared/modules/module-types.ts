/**
 * Vibexe Module System — Types & Interfaces
 *
 * Modules are self-contained feature packages that can be loaded on-demand
 * into the game builder. They provide runtime code (Three.js), shaders (GLSL),
 * UI panels (React), and assets (textures, models).
 *
 * Modules are NOT bundled with the main app — they're lazy-loaded when
 * the user selects them from the Modules menu.
 */

/** Module manifest — describes a loadable module */
export interface ModuleManifest {
	/** Unique module identifier (kebab-case) */
	id: string;
	/** Human-readable display name */
	name: string;
	/** Semantic version */
	version: string;
	/** Module category for menu organization */
	category: ModuleCategory;
	/** Short description shown in module picker */
	description: string;
	/** Icon name from lucide-react */
	icon: string;
	/** List of asset paths required by this module (fetched on activation) */
	assets: string[];
	/** Runtime code that gets injected into the sandpack iframe */
	runtimeCode: string;
	/** Bridge code that runs in the parent frame for editor integration */
	bridgeHandlers: Record<string, string>;
	/** Default settings for the module */
	defaultSettings: Record<string, unknown>;
}

export type ModuleCategory =
	| "terrain"
	| "lighting"
	| "particles"
	| "physics"
	| "audio"
	| "ai"
	| "networking"
	| "ui"
	| "tools"
	| "level-design";

/** Runtime module instance — created when module is activated */
export interface ModuleInstance {
	id: string;
	manifest: ModuleManifest;
	settings: Record<string, unknown>;
	active: boolean;
}

/** Module registry entry — combines manifest with loading state */
export interface ModuleRegistryEntry {
	manifest: ModuleManifest;
	loaded: boolean;
	instance: ModuleInstance | null;
}

/** Message types for module ↔ editor communication */
export interface ModuleMessage {
	type: string;
	moduleId: string;
	payload: Record<string, unknown>;
}
