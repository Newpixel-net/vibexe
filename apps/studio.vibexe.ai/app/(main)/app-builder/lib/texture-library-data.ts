/**
 * Texture Library Data — Tileable texture catalog for the Scene Editor.
 *
 * Provides TextureLibraryItems organized by category.
 * Textures served from /api/app-builder/media-stock-3d/textures/.
 * 300+ textures sourced from ambientCG.com (CC0 license).
 */

// ===== Types =====

export type TextureCategory =
	| "ground" | "stone" | "brick" | "wood"
	| "metal" | "concrete" | "tiles" | "fabric" | "nature"
	| "marble" | "road" | "special";

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
	{ id: "marble", label: "Marble" },
	{ id: "road", label: "Road" },
	{ id: "special", label: "Special" },
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
	{ id: "blockout_grid", displayName: "Blockout Grid", category: "special", filename: "blockout_grid.jpg", defaultTileX: 1, defaultTileY: 1 },
	{ id: "water", displayName: "Water", category: "nature", filename: "water.jpg", defaultTileX: 2, defaultTileY: 2 },

	// ═══════════════ Ground (30) — ambientCG ═══════════════
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
	// +15 new ground
	{ id: "Ground055", displayName: "Clay Ground", category: "ground", filename: "Ground055.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Ground069", displayName: "Worn Path", category: "ground", filename: "Ground069.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Ground078", displayName: "Stony Ground", category: "ground", filename: "Ground078.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Gravel036", displayName: "Fine Gravel", category: "ground", filename: "Gravel036.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Gravel023", displayName: "Coarse Gravel", category: "ground", filename: "Gravel023.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Gravel042", displayName: "River Gravel", category: "ground", filename: "Gravel042.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Sand005", displayName: "Desert Sand", category: "ground", filename: "Sand005.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Sand002", displayName: "Fine Sand", category: "ground", filename: "Sand002.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Ground046", displayName: "Mossy Ground", category: "ground", filename: "Ground046.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Ground082", displayName: "Packed Dirt", category: "ground", filename: "Ground082.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Ground067", displayName: "Garden Soil", category: "ground", filename: "Ground067.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Ground079", displayName: "Eroded Ground", category: "ground", filename: "Ground079.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Grass009", displayName: "Thick Grass", category: "ground", filename: "Grass009.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Ground042", displayName: "Dried Mud", category: "ground", filename: "Ground042.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Ground044", displayName: "Forest Path", category: "ground", filename: "Ground044.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },

	// ═══════════════ Stone / Rock (30) ═══════════════
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
	// +15 new stone
	{ id: "Rock064", displayName: "Weathered Rock", category: "stone", filename: "Rock064.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Rock065", displayName: "Mountain Rock", category: "stone", filename: "Rock065.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Rock052", displayName: "Jagged Rock", category: "stone", filename: "Rock052.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "PavingStones151", displayName: "Roman Pavers", category: "stone", filename: "PavingStones151.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "PavingStones139", displayName: "Mosaic Pavers", category: "stone", filename: "PavingStones139.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "PavingStones143", displayName: "Herringbone Pavers", category: "stone", filename: "PavingStones143.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Rock040", displayName: "Basalt", category: "stone", filename: "Rock040.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Rock041", displayName: "Pumice Stone", category: "stone", filename: "Rock041.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Rock045", displayName: "Shale", category: "stone", filename: "Rock045.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "PavingStones130", displayName: "Garden Pavers", category: "stone", filename: "PavingStones130.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "PavingStones135", displayName: "Slate Pavers", category: "stone", filename: "PavingStones135.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Rock033", displayName: "Volcanic Rock", category: "stone", filename: "Rock033.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Rock036", displayName: "Fieldstone", category: "stone", filename: "Rock036.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "PavingStones136", displayName: "Rustic Pavers", category: "stone", filename: "PavingStones136.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "PavingStones137", displayName: "Flagstone", category: "stone", filename: "PavingStones137.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },

	// ═══════════════ Brick (27) ═══════════════
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
	// +15 new brick
	{ id: "Bricks098", displayName: "Aged Red Brick", category: "brick", filename: "Bricks098.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Bricks103", displayName: "Modern Brick", category: "brick", filename: "Bricks103.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Bricks076", displayName: "Yellow Brick", category: "brick", filename: "Bricks076.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Bricks086", displayName: "Clinker Brick", category: "brick", filename: "Bricks086.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Bricks093", displayName: "Stacked Brick", category: "brick", filename: "Bricks093.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "PaintedBricks001", displayName: "Painted White Brick", category: "brick", filename: "PaintedBricks001.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Bricks074", displayName: "Grey Brick", category: "brick", filename: "Bricks074.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Bricks083", displayName: "Sandblasted Brick", category: "brick", filename: "Bricks083.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Bricks070", displayName: "Tudor Brick", category: "brick", filename: "Bricks070.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Bricks068", displayName: "Industrial Brick", category: "brick", filename: "Bricks068.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Bricks071", displayName: "Heritage Brick", category: "brick", filename: "Bricks071.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Bricks090", displayName: "Glazed Brick", category: "brick", filename: "Bricks090.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Bricks088", displayName: "Fire Brick", category: "brick", filename: "Bricks088.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Bricks096", displayName: "Reclaimed Brick", category: "brick", filename: "Bricks096.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Bricks091", displayName: "Roman Brick", category: "brick", filename: "Bricks091.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },

	// ═══════════════ Wood (35) ═══════════════
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
	// +20 new wood
	{ id: "Wood095", displayName: "Teak Wood", category: "wood", filename: "Wood095.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Wood093", displayName: "Cherry Wood", category: "wood", filename: "Wood093.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Wood052", displayName: "Plywood", category: "wood", filename: "Wood052.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Planks021", displayName: "Fence Planks", category: "wood", filename: "Planks021.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Planks033", displayName: "Deck Planks", category: "wood", filename: "Planks033.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "WoodSiding011", displayName: "Wood Siding", category: "wood", filename: "WoodSiding011.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Bark009", displayName: "Tree Bark", category: "wood", filename: "Bark009.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Wood054", displayName: "Driftwood", category: "wood", filename: "Wood054.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Wood056", displayName: "Ash Wood", category: "wood", filename: "Wood056.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Wood062", displayName: "Ebony Wood", category: "wood", filename: "Wood062.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "WoodFloor046", displayName: "Chevron Floor", category: "wood", filename: "WoodFloor046.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "WoodFloor048", displayName: "Versailles Floor", category: "wood", filename: "WoodFloor048.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "WoodFloor052", displayName: "Strip Floor", category: "wood", filename: "WoodFloor052.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Planks024", displayName: "Painted Planks", category: "wood", filename: "Planks024.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Planks030", displayName: "Aged Planks", category: "wood", filename: "Planks030.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "WoodSiding009", displayName: "Shingle Siding", category: "wood", filename: "WoodSiding009.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Wood063", displayName: "Spalted Wood", category: "wood", filename: "Wood063.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Wood064", displayName: "Reclaimed Wood", category: "wood", filename: "Wood064.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Bark007", displayName: "Birch Bark", category: "wood", filename: "Bark007.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Wood070", displayName: "Scorched Wood", category: "wood", filename: "Wood070.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },

	// ═══════════════ Metal (35) ═══════════════
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
	// +25 new metal
	{ id: "Metal054", displayName: "Zinc Panel", category: "metal", filename: "Metal054.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal055B", displayName: "Rusted Steel", category: "metal", filename: "Metal055B.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal047", displayName: "Brass Plate", category: "metal", filename: "Metal047.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "CorrugatedSteel005", displayName: "Corrugated Steel", category: "metal", filename: "CorrugatedSteel005.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "DiamondPlate008", displayName: "Diamond Floor Plate", category: "metal", filename: "DiamondPlate008.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "PaintedMetal010", displayName: "Painted Metal", category: "metal", filename: "PaintedMetal010.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Rust004", displayName: "Heavy Rust", category: "metal", filename: "Rust004.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal033", displayName: "Patina Copper", category: "metal", filename: "Metal033.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal034", displayName: "Bronze Plate", category: "metal", filename: "Metal034.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal035", displayName: "Cast Iron", category: "metal", filename: "Metal035.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal036", displayName: "Tin Plate", category: "metal", filename: "Metal036.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal037", displayName: "Gold Leaf", category: "metal", filename: "Metal037.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal038", displayName: "Silver Sheet", category: "metal", filename: "Metal038.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal039", displayName: "Stainless Steel", category: "metal", filename: "Metal039.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal040", displayName: "Anodized Aluminum", category: "metal", filename: "Metal040.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal042", displayName: "Chrome", category: "metal", filename: "Metal042.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal043", displayName: "Nickel Plate", category: "metal", filename: "Metal043.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal044", displayName: "Pewter", category: "metal", filename: "Metal044.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal045", displayName: "Titanium", category: "metal", filename: "Metal045.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal051", displayName: "Wrought Iron", category: "metal", filename: "Metal051.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal052", displayName: "Oxidized Metal", category: "metal", filename: "Metal052.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal056", displayName: "Scratched Metal", category: "metal", filename: "Metal056.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal057", displayName: "Perforated Metal", category: "metal", filename: "Metal057.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal058", displayName: "Embossed Metal", category: "metal", filename: "Metal058.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Metal060", displayName: "Sheet Metal", category: "metal", filename: "Metal060.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },

	// ═══════════════ Concrete (25) ═══════════════
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
	// +15 new concrete
	{ id: "Concrete049", displayName: "Brushed Concrete", category: "concrete", filename: "Concrete049.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Concrete035", displayName: "Weathered Concrete", category: "concrete", filename: "Concrete035.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Concrete047B", displayName: "Textured Concrete", category: "concrete", filename: "Concrete047B.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Plaster004", displayName: "White Plaster", category: "concrete", filename: "Plaster004.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Plaster007", displayName: "Rough Plaster", category: "concrete", filename: "Plaster007.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "PaintedPlaster013", displayName: "Painted Plaster", category: "concrete", filename: "PaintedPlaster013.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Concrete033", displayName: "Stamped Concrete", category: "concrete", filename: "Concrete033.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Concrete037", displayName: "Poured Concrete", category: "concrete", filename: "Concrete037.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Concrete038", displayName: "Board-Formed", category: "concrete", filename: "Concrete038.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Concrete039", displayName: "Brutalist Concrete", category: "concrete", filename: "Concrete039.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Concrete040", displayName: "Precast Panel", category: "concrete", filename: "Concrete040.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Concrete041", displayName: "Concrete Block", category: "concrete", filename: "Concrete041.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Plaster005", displayName: "Venetian Plaster", category: "concrete", filename: "Plaster005.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Plaster006", displayName: "Stucco", category: "concrete", filename: "Plaster006.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Concrete043", displayName: "Mossy Concrete", category: "concrete", filename: "Concrete043.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },

	// ═══════════════ Tiles (30) ═══════════════
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
	// +20 new tiles
	{ id: "Tiles139", displayName: "Penny Tile", category: "tiles", filename: "Tiles139.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Tiles108", displayName: "Checkered Tile", category: "tiles", filename: "Tiles108.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Tiles134", displayName: "Fish Scale Tile", category: "tiles", filename: "Tiles134.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Terrazzo007", displayName: "Classic Terrazzo", category: "tiles", filename: "Terrazzo007.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Terrazzo003", displayName: "Fine Terrazzo", category: "tiles", filename: "Terrazzo003.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "GlazedTerracotta001", displayName: "Glazed Terracotta", category: "tiles", filename: "GlazedTerracotta001.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Tiles095", displayName: "Metro Tile", category: "tiles", filename: "Tiles095.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Tiles096", displayName: "Arabesque Tile", category: "tiles", filename: "Tiles096.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Tiles097", displayName: "Lantern Tile", category: "tiles", filename: "Tiles097.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Tiles098", displayName: "Diamond Tile", category: "tiles", filename: "Tiles098.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Tiles100", displayName: "Picket Tile", category: "tiles", filename: "Tiles100.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Tiles101", displayName: "Star Tile", category: "tiles", filename: "Tiles101.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Tiles102", displayName: "Ogee Tile", category: "tiles", filename: "Tiles102.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Tiles103", displayName: "Zellige Tile", category: "tiles", filename: "Tiles103.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Tiles106", displayName: "Encaustic Tile", category: "tiles", filename: "Tiles106.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Tiles110", displayName: "Cement Tile", category: "tiles", filename: "Tiles110.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Tiles111", displayName: "Porcelain Tile", category: "tiles", filename: "Tiles111.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Tiles112", displayName: "Slate Tile", category: "tiles", filename: "Tiles112.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Tiles113", displayName: "Travertine Tile", category: "tiles", filename: "Tiles113.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Tiles115", displayName: "Quarry Tile", category: "tiles", filename: "Tiles115.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },

	// ═══════════════ Fabric (28) ═══════════════
	{ id: "Fabric083", displayName: "Canvas", category: "fabric", filename: "Fabric083.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Fabric081C", displayName: "Denim", category: "fabric", filename: "Fabric081C.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Fabric061", displayName: "Linen", category: "fabric", filename: "Fabric061.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Fabric066", displayName: "Burlap", category: "fabric", filename: "Fabric066.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Fabric030", displayName: "Carpet", category: "fabric", filename: "Fabric030.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Fabric082A", displayName: "Woven Cloth", category: "fabric", filename: "Fabric082A.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Leather037", displayName: "Brown Leather", category: "fabric", filename: "Leather037.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Leather038", displayName: "Black Leather", category: "fabric", filename: "Leather038.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	// +20 new fabric
	{ id: "Fabric084", displayName: "Silk", category: "fabric", filename: "Fabric084.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Fabric085", displayName: "Velvet", category: "fabric", filename: "Fabric085.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Leather039", displayName: "Tan Leather", category: "fabric", filename: "Leather039.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Leather041", displayName: "Distressed Leather", category: "fabric", filename: "Leather041.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Carpet008", displayName: "Shag Carpet", category: "fabric", filename: "Carpet008.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Carpet012", displayName: "Berber Carpet", category: "fabric", filename: "Carpet012.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Wicker002", displayName: "Wicker", category: "fabric", filename: "Wicker002.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Fabric032", displayName: "Tweed", category: "fabric", filename: "Fabric032.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Fabric035", displayName: "Corduroy", category: "fabric", filename: "Fabric035.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Fabric040", displayName: "Satin", category: "fabric", filename: "Fabric040.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Fabric045", displayName: "Fleece", category: "fabric", filename: "Fabric045.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Fabric050", displayName: "Wool Knit", category: "fabric", filename: "Fabric050.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Fabric055", displayName: "Cotton Weave", category: "fabric", filename: "Fabric055.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Fabric060", displayName: "Muslin", category: "fabric", filename: "Fabric060.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Fabric062", displayName: "Hessian", category: "fabric", filename: "Fabric062.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Fabric064", displayName: "Felt", category: "fabric", filename: "Fabric064.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Fabric068", displayName: "Jersey Knit", category: "fabric", filename: "Fabric068.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Fabric070", displayName: "Taffeta", category: "fabric", filename: "Fabric070.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Leather035", displayName: "Suede", category: "fabric", filename: "Leather035.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Leather036", displayName: "Patent Leather", category: "fabric", filename: "Leather036.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },

	// ═══════════════ Nature (20) ═══════════════
	{ id: "Snow015", displayName: "Fresh Snow", category: "nature", filename: "Snow015.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Snow014", displayName: "Packed Snow", category: "nature", filename: "Snow014.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Snow013", displayName: "Icy Snow", category: "nature", filename: "Snow013.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	// +15 new nature (marble moved to own category)
	{ id: "Snow016", displayName: "Powder Snow", category: "nature", filename: "Snow016.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Snow017", displayName: "Crunchy Snow", category: "nature", filename: "Snow017.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Ice004", displayName: "Frozen Ice", category: "nature", filename: "Ice004.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Moss005", displayName: "Forest Moss", category: "nature", filename: "Moss005.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Leaf003", displayName: "Autumn Leaves", category: "nature", filename: "Leaf003.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "ScatteredLeaves001", displayName: "Scattered Leaves", category: "nature", filename: "ScatteredLeaves001.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Grass009_nature", displayName: "Wild Meadow", category: "nature", filename: "Grass010.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Snow010", displayName: "Melting Snow", category: "nature", filename: "Snow010.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Snow011", displayName: "Frost", category: "nature", filename: "Snow011.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Ice003", displayName: "Glacier Ice", category: "nature", filename: "Ice003.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Moss003", displayName: "Thick Moss", category: "nature", filename: "Moss003.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Moss004", displayName: "Rock Moss", category: "nature", filename: "Moss004.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Snow012", displayName: "Snowy Ground", category: "nature", filename: "Snow012.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Ice005", displayName: "Thin Ice", category: "nature", filename: "Ice005.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Leaf004", displayName: "Fallen Leaves", category: "nature", filename: "Leaf004.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },

	// ═══════════════ Marble (NEW - 20) ═══════════════
	{ id: "Marble012", displayName: "White Marble", category: "marble", filename: "Marble012.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Marble016", displayName: "Dark Marble", category: "marble", filename: "Marble016.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Marble013", displayName: "Carrara Marble", category: "marble", filename: "Marble013.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Marble017", displayName: "Calacatta Marble", category: "marble", filename: "Marble017.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Marble023", displayName: "Emperador Marble", category: "marble", filename: "Marble023.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Granite004", displayName: "Black Granite", category: "marble", filename: "Granite004.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Granite008", displayName: "Speckled Granite", category: "marble", filename: "Granite008.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Onyx006", displayName: "Green Onyx", category: "marble", filename: "Onyx006.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Travertine005", displayName: "Cream Travertine", category: "marble", filename: "Travertine005.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Marble014", displayName: "Rosa Marble", category: "marble", filename: "Marble014.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Marble015", displayName: "Veined Marble", category: "marble", filename: "Marble015.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Marble018", displayName: "Statuario Marble", category: "marble", filename: "Marble018.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Marble019", displayName: "Grey Marble", category: "marble", filename: "Marble019.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Marble020", displayName: "Nero Marquina", category: "marble", filename: "Marble020.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Marble021", displayName: "Botticino Marble", category: "marble", filename: "Marble021.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Marble022", displayName: "Crema Marfil", category: "marble", filename: "Marble022.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Granite005", displayName: "Grey Granite", category: "marble", filename: "Granite005.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Granite006", displayName: "Red Granite", category: "marble", filename: "Granite006.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Granite007", displayName: "Salt & Pepper Granite", category: "marble", filename: "Granite007.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Travertine006", displayName: "Noce Travertine", category: "marble", filename: "Travertine006.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },

	// ═══════════════ Road (NEW - 10) ═══════════════
	{ id: "Asphalt026", displayName: "Fresh Asphalt", category: "road", filename: "Asphalt026.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Asphalt019", displayName: "Worn Asphalt", category: "road", filename: "Asphalt019.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Asphalt030", displayName: "Cracked Asphalt", category: "road", filename: "Asphalt030.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Road007", displayName: "Highway Road", category: "road", filename: "Road007.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Road003", displayName: "Old Road", category: "road", filename: "Road003.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "TactilePaving004", displayName: "Tactile Paving", category: "road", filename: "TactilePaving004.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Asphalt020", displayName: "Patched Asphalt", category: "road", filename: "Asphalt020.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Asphalt022", displayName: "Wet Asphalt", category: "road", filename: "Asphalt022.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Asphalt024", displayName: "Tar Road", category: "road", filename: "Asphalt024.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Road005", displayName: "Country Road", category: "road", filename: "Road005.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },

	// ═══════════════ Special (NEW - 10) ═══════════════
	{ id: "ChristmasTreeOrnament007", displayName: "Christmas Ornament", category: "special", filename: "ChristmasTreeOrnament007.jpg", defaultTileX: 1, defaultTileY: 1, hasPBR: true },
	{ id: "Lava005", displayName: "Hot Lava", category: "special", filename: "Lava005.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Lava003", displayName: "Cooled Lava", category: "special", filename: "Lava003.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Chainmail004", displayName: "Chainmail", category: "special", filename: "Chainmail004.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "DiamondPlate010", displayName: "Heavy Diamond Plate", category: "special", filename: "DiamondPlate010.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Rust008", displayName: "Peeling Rust", category: "special", filename: "Rust008.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Rust005", displayName: "Light Rust", category: "special", filename: "Rust005.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Rust006", displayName: "Pitted Rust", category: "special", filename: "Rust006.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "Lava004", displayName: "Flowing Lava", category: "special", filename: "Lava004.jpg", defaultTileX: 2, defaultTileY: 2, hasPBR: true },
	{ id: "ChristmasTreeOrnament003", displayName: "Gold Ornament", category: "special", filename: "ChristmasTreeOrnament003.jpg", defaultTileX: 1, defaultTileY: 1, hasPBR: true },
];

export function getTexturesByCategory(category: TextureCategory): TextureLibraryItem[] {
	return TEXTURE_CATALOG.filter((t) => t.category === category);
}

export function getTextureById(id: string): TextureLibraryItem | undefined {
	return TEXTURE_CATALOG.find((t) => t.id === id);
}
