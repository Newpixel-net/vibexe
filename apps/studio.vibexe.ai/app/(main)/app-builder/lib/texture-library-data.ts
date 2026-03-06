/**
 * Texture Library Data — Tileable texture catalog for the Scene Editor.
 *
 * Provides TextureLibraryItems organized by category.
 * Textures are 512x512 JPEGs served from /api/app-builder/media-stock-3d/textures/.
 * 100+ textures sourced from ambientCG.com (CC0 license).
 */

// ===== Types =====

export type TextureCategory =
	| "ground" | "stone" | "brick" | "wood"
	| "metal" | "concrete" | "tiles" | "fabric" | "nature";

export interface TextureLibraryItem {
	id: string;
	displayName: string;
	category: TextureCategory;
	filename: string;
	defaultTileX: number;
	defaultTileY: number;
	hasPBR?: boolean;
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
	{ id: "wood", label: "Wood" },
	{ id: "metal", label: "Metal" },
	{ id: "concrete", label: "Concrete" },
	{ id: "tiles", label: "Tiles" },
	{ id: "fabric", label: "Fabric" },
	{ id: "nature", label: "Nature" },
];

export const TEXTURE_CATALOG: TextureLibraryItem[] = [
	// ═══════════════ Original textures ═══════════════
	{ id: "grass_mossy", displayName: "Mossy Grass", category: "ground", filename: "grass_mossy.jpg", defaultTileX: 2, defaultTileY: 2 },
	{ id: "dirt_dry", displayName: "Dry Dirt", category: "ground", filename: "dirt_dry.jpg", defaultTileX: 2, defaultTileY: 2 },
	{ id: "moss", displayName: "Moss", category: "ground", filename: "moss.jpg", defaultTileX: 2, defaultTileY: 2 },
	{ id: "rockgrass", displayName: "Rock Grass", category: "ground", filename: "rockgrass.jpg", defaultTileX: 2, defaultTileY: 2 },
	{ id: "cobblestone", displayName: "Cobblestone", category: "stone", filename: "cobblestone.jpg", defaultTileX: 2, defaultTileY: 2 },
	{ id: "stone_pebbles", displayName: "Stone Pebbles", category: "stone", filename: "stone_pebbles.jpg", defaultTileX: 2, defaultTileY: 2 },
	{ id: "bricks", displayName: "Bricks", category: "brick", filename: "bricks.jpg", defaultTileX: 2, defaultTileY: 2 },
	{ id: "blockout_grid", displayName: "Blockout Grid", category: "nature", filename: "blockout_grid.jpg", defaultTileX: 1, defaultTileY: 1 },
	{ id: "water", displayName: "Water", category: "nature", filename: "water.jpg", defaultTileX: 2, defaultTileY: 2 },

	// ═══════════════ Ground (15) — ambientCG ═══════════════
	{ id: "Ground103", displayName: "Forest Floor", category: "ground", filename: "Ground103.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Ground104", displayName: "Leaf Litter", category: "ground", filename: "Ground104.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Ground037", displayName: "Dry Earth", category: "ground", filename: "Ground037.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Ground054", displayName: "Sandy Ground", category: "ground", filename: "Ground054.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Ground080", displayName: "Muddy Path", category: "ground", filename: "Ground080.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Ground068", displayName: "Gravel Path", category: "ground", filename: "Ground068.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Ground085", displayName: "Rocky Terrain", category: "ground", filename: "Ground085.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Ground048", displayName: "Cracked Soil", category: "ground", filename: "Ground048.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Ground102", displayName: "Bark Mulch", category: "ground", filename: "Ground102.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Ground093C", displayName: "Beach Sand", category: "ground", filename: "Ground093C.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Grass005", displayName: "Short Grass", category: "ground", filename: "Grass005.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Grass001", displayName: "Wild Grass", category: "ground", filename: "Grass001.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Grass004", displayName: "Lawn Grass", category: "ground", filename: "Grass004.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Grass008", displayName: "Tall Grass", category: "ground", filename: "Grass008.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Grass006", displayName: "Meadow Grass", category: "ground", filename: "Grass006.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },

	// ═══════════════ Stone / Rock (15) ═══════════════
	{ id: "Rock063", displayName: "Rough Rock", category: "stone", filename: "Rock063.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Rock058", displayName: "Slate Rock", category: "stone", filename: "Rock058.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Rock060", displayName: "Cliff Rock", category: "stone", filename: "Rock060.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Rock051", displayName: "Mossy Rock", category: "stone", filename: "Rock051.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Rock035", displayName: "Sandstone", category: "stone", filename: "Rock035.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Rock061", displayName: "Granite", category: "stone", filename: "Rock061.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Rock020", displayName: "Limestone", category: "stone", filename: "Rock020.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Rock030", displayName: "Boulder", category: "stone", filename: "Rock030.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Rock050", displayName: "Canyon Rock", category: "stone", filename: "Rock050.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Rock062", displayName: "Quarry Stone", category: "stone", filename: "Rock062.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "PavingStones150", displayName: "Paving Stones", category: "stone", filename: "PavingStones150.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "PavingStones138", displayName: "Cobbled Path", category: "stone", filename: "PavingStones138.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "PavingStones142", displayName: "Stone Pavers", category: "stone", filename: "PavingStones142.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "PavingStones128", displayName: "Brick Pavers", category: "stone", filename: "PavingStones128.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "PavingStones146", displayName: "Hexagonal Pavers", category: "stone", filename: "PavingStones146.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },

	// ═══════════════ Brick (12) ═══════════════
	{ id: "Bricks102", displayName: "Red Brick Wall", category: "brick", filename: "Bricks102.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Bricks101", displayName: "Old Brick", category: "brick", filename: "Bricks101.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Bricks097", displayName: "Weathered Brick", category: "brick", filename: "Bricks097.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Bricks075A", displayName: "White Brick", category: "brick", filename: "Bricks075A.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Bricks085", displayName: "Dark Brick", category: "brick", filename: "Bricks085.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Bricks092", displayName: "Brown Brick", category: "brick", filename: "Bricks092.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Bricks094", displayName: "Painted Brick", category: "brick", filename: "Bricks094.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Bricks060", displayName: "Stone Brick", category: "brick", filename: "Bricks060.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Bricks066", displayName: "Mossy Brick", category: "brick", filename: "Bricks066.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Bricks059", displayName: "Castle Brick", category: "brick", filename: "Bricks059.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Bricks084", displayName: "Terracotta Brick", category: "brick", filename: "Bricks084.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Bricks100", displayName: "Rustic Brick", category: "brick", filename: "Bricks100.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },

	// ═══════════════ Wood (15) ═══════════════
	{ id: "Wood094", displayName: "Oak Planks", category: "wood", filename: "Wood094.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Wood092", displayName: "Pine Wood", category: "wood", filename: "Wood092.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Wood051", displayName: "Barn Wood", category: "wood", filename: "Wood051.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Wood066", displayName: "Cedar Planks", category: "wood", filename: "Wood066.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Wood049", displayName: "Rough Timber", category: "wood", filename: "Wood049.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Wood058", displayName: "Walnut Wood", category: "wood", filename: "Wood058.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Wood067", displayName: "Birch Wood", category: "wood", filename: "Wood067.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Wood060", displayName: "Mahogany", category: "wood", filename: "Wood060.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Wood048", displayName: "Weathered Wood", category: "wood", filename: "Wood048.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "WoodFloor051", displayName: "Herringbone Floor", category: "wood", filename: "WoodFloor051.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "WoodFloor064", displayName: "Parquet Floor", category: "wood", filename: "WoodFloor064.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "WoodFloor070", displayName: "Dark Hardwood", category: "wood", filename: "WoodFloor070.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "WoodFloor071", displayName: "Light Hardwood", category: "wood", filename: "WoodFloor071.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "WoodFloor043", displayName: "Rustic Plank", category: "wood", filename: "WoodFloor043.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "WoodFloor040", displayName: "Bamboo Floor", category: "wood", filename: "WoodFloor040.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },

	// ═══════════════ Metal (10) ═══════════════
	{ id: "Metal049A", displayName: "Brushed Steel", category: "metal", filename: "Metal049A.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal055A", displayName: "Rusty Iron", category: "metal", filename: "Metal055A.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal046B", displayName: "Diamond Plate", category: "metal", filename: "Metal046B.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal048A", displayName: "Corrugated Metal", category: "metal", filename: "Metal048A.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal061B", displayName: "Galvanized Steel", category: "metal", filename: "Metal061B.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal032", displayName: "Copper Plate", category: "metal", filename: "Metal032.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal041A", displayName: "Aluminum Panel", category: "metal", filename: "Metal041A.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal053C", displayName: "Worn Metal", category: "metal", filename: "Metal053C.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal050A", displayName: "Industrial Metal", category: "metal", filename: "Metal050A.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal046A", displayName: "Hammered Metal", category: "metal", filename: "Metal046A.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },

	// ═══════════════ Concrete (10) ═══════════════
	{ id: "Concrete048", displayName: "Smooth Concrete", category: "concrete", filename: "Concrete048.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Concrete047A", displayName: "Rough Concrete", category: "concrete", filename: "Concrete047A.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Concrete034", displayName: "Stained Concrete", category: "concrete", filename: "Concrete034.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Concrete046", displayName: "Polished Concrete", category: "concrete", filename: "Concrete046.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Concrete042A", displayName: "Cracked Concrete", category: "concrete", filename: "Concrete042A.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Concrete031", displayName: "Aged Concrete", category: "concrete", filename: "Concrete031.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Concrete030", displayName: "Bare Concrete", category: "concrete", filename: "Concrete030.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Concrete044D", displayName: "Exposed Aggregate", category: "concrete", filename: "Concrete044D.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Concrete036", displayName: "Sidewalk", category: "concrete", filename: "Concrete036.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Concrete032", displayName: "Foundation", category: "concrete", filename: "Concrete032.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },

	// ═══════════════ Tiles (10) ═══════════════
	{ id: "Tiles138", displayName: "Subway Tile", category: "tiles", filename: "Tiles138.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Tiles107", displayName: "Mosaic Tile", category: "tiles", filename: "Tiles107.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Tiles133A", displayName: "Herringbone Tile", category: "tiles", filename: "Tiles133A.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Tiles132A", displayName: "Hexagonal Tile", category: "tiles", filename: "Tiles132A.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Tiles040", displayName: "Kitchen Tile", category: "tiles", filename: "Tiles040.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Tiles078", displayName: "Bathroom Tile", category: "tiles", filename: "Tiles078.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Tiles074", displayName: "Floor Tile", category: "tiles", filename: "Tiles074.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Tiles131", displayName: "Decorative Tile", category: "tiles", filename: "Tiles131.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Tiles052", displayName: "Ceramic Tile", category: "tiles", filename: "Tiles052.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Tiles093", displayName: "Pool Tile", category: "tiles", filename: "Tiles093.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },

	// ═══════════════ Fabric (8) ═══════════════
	{ id: "Fabric083", displayName: "Canvas", category: "fabric", filename: "Fabric083.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Fabric081C", displayName: "Denim", category: "fabric", filename: "Fabric081C.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Fabric061", displayName: "Linen", category: "fabric", filename: "Fabric061.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Fabric066", displayName: "Burlap", category: "fabric", filename: "Fabric066.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Fabric030", displayName: "Carpet", category: "fabric", filename: "Fabric030.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Fabric082A", displayName: "Woven Cloth", category: "fabric", filename: "Fabric082A.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Leather037", displayName: "Brown Leather", category: "fabric", filename: "Leather037.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Leather038", displayName: "Black Leather", category: "fabric", filename: "Leather038.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },

	// ═══════════════ Nature (5) ═══════════════
	{ id: "Snow015", displayName: "Fresh Snow", category: "nature", filename: "Snow015.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Snow014", displayName: "Packed Snow", category: "nature", filename: "Snow014.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Snow013", displayName: "Icy Snow", category: "nature", filename: "Snow013.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Marble012", displayName: "White Marble", category: "nature", filename: "Marble012.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Marble016", displayName: "Dark Marble", category: "nature", filename: "Marble016.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
];

export function getTexturesByCategory(category: TextureCategory): TextureLibraryItem[] {
	return TEXTURE_CATALOG.filter((t) => t.category === category);
}

export function getTextureById(id: string): TextureLibraryItem | undefined {
	return TEXTURE_CATALOG.find((t) => t.id === id);
}
