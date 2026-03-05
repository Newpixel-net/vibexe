/**
 * Texture Library Data — Tileable texture catalog for the Scene Editor.
 *
 * Provides TextureLibraryItems organized by category.
 * Textures are 512x512 JPEGs served from /api/app-builder/media-stock-3d/textures/.
 */

// ===== Types =====

export type TextureCategory = "ground" | "stone" | "brick" | "misc";

export interface TextureLibraryItem {
	id: string;
	displayName: string;
	category: TextureCategory;
	filename: string;
	defaultTileX: number;
	defaultTileY: number;
}

// ===== URL builder =====

export function textureUrl(filename: string): string {
	return `/api/app-builder/media-stock-3d/textures/${encodeURIComponent(filename)}`;
}

// ===== Catalog =====

export const TEXTURE_CATEGORIES: { id: TextureCategory; label: string }[] = [
	{ id: "ground", label: "Ground" },
	{ id: "stone", label: "Stone" },
	{ id: "brick", label: "Brick" },
	{ id: "misc", label: "Misc" },
];

export const TEXTURE_CATALOG: TextureLibraryItem[] = [
	// Ground
	{ id: "grass_mossy", displayName: "Mossy Grass", category: "ground", filename: "grass_mossy.jpg", defaultTileX: 2, defaultTileY: 2 },
	{ id: "dirt_dry", displayName: "Dry Dirt", category: "ground", filename: "dirt_dry.jpg", defaultTileX: 2, defaultTileY: 2 },
	{ id: "moss", displayName: "Moss", category: "ground", filename: "moss.jpg", defaultTileX: 2, defaultTileY: 2 },
	{ id: "rockgrass", displayName: "Rock Grass", category: "ground", filename: "rockgrass.jpg", defaultTileX: 2, defaultTileY: 2 },
	// Stone
	{ id: "cobblestone", displayName: "Cobblestone", category: "stone", filename: "cobblestone.jpg", defaultTileX: 2, defaultTileY: 2 },
	{ id: "stone_pebbles", displayName: "Stone Pebbles", category: "stone", filename: "stone_pebbles.jpg", defaultTileX: 2, defaultTileY: 2 },
	// Brick
	{ id: "bricks", displayName: "Bricks", category: "brick", filename: "bricks.jpg", defaultTileX: 2, defaultTileY: 2 },
	// Misc
	{ id: "blockout_grid", displayName: "Blockout Grid", category: "misc", filename: "blockout_grid.jpg", defaultTileX: 1, defaultTileY: 1 },
	{ id: "water", displayName: "Water", category: "misc", filename: "water.jpg", defaultTileX: 2, defaultTileY: 2 },
];

export function getTexturesByCategory(category: TextureCategory): TextureLibraryItem[] {
	return TEXTURE_CATALOG.filter((t) => t.category === category);
}

export function getTextureById(id: string): TextureLibraryItem | undefined {
	return TEXTURE_CATALOG.find((t) => t.id === id);
}
