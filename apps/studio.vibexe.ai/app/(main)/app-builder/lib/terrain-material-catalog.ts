/**
 * Terrain Material Catalog — 30 Yughues Free Ground Materials + classic presets
 *
 * Hand-painted artist materials converted from Unity Standard (Specular setup).
 * Each material includes: diffuse, normal map, roughness (inverted from specular alpha).
 * Special materials: Lava/Burnt have emission maps.
 *
 * Textures served from /api/app-builder/media-stock-3d/textures/
 * Thumbnails (128x128): /api/app-builder/media-stock-3d/textures/thumbnails/
 */

// ===== Types =====

export type TerrainMaterialCategory =
	| "grass" | "ground" | "rock" | "sand" | "snow" | "special" | "classic";

export interface TerrainMaterial {
	id: string;
	name: string;
	category: TerrainMaterialCategory;
	diffuseFilename: string;
	normalFilename: string | null;
	roughnessFilename: string | null;
	emissionFilename: string | null;
	/** Scalar roughness fallback (0-1). Default 0.8 */
	defaultRoughness: number;
	/** Recommended world-units per tile. Default 4 */
	defaultTileSize: number;
	/** Hex color for UI swatch fallback */
	previewColor: string;
	/** Thumbnail filename (128x128) */
	thumbnailFilename: string | null;
	/** Unity _Color tint (multiplied on albedo). Default [1,1,1] */
	colorTint?: [number, number, number];
	/** Emission intensity for emissive materials. Default 0 */
	emissionIntensity?: number;
}

// ===== URL helpers =====

export function terrainTextureUrl(filename: string): string {
	return `/api/app-builder/media-stock-3d/textures/${encodeURIComponent(filename)}`;
}

export function terrainThumbnailUrl(filename: string): string {
	return `/api/app-builder/media-stock-3d/textures/thumbnails/${encodeURIComponent(filename)}`;
}

// ===== Categories =====

export const TERRAIN_MATERIAL_CATEGORIES: { id: TerrainMaterialCategory; label: string }[] = [
	{ id: "grass", label: "Grass" },
	{ id: "ground", label: "Ground" },
	{ id: "rock", label: "Rock" },
	{ id: "sand", label: "Sand" },
	{ id: "snow", label: "Snow" },
	{ id: "special", label: "Special" },
	{ id: "classic", label: "Classic" },
];

// ===== Catalog =====

export const TERRAIN_MATERIAL_CATALOG: TerrainMaterial[] = [
	// ═══════════════ Grass (9) ═══════════════
	{ id: "yfgm_grass01", name: "Green Grass", category: "grass", diffuseFilename: "YFGM_Grass01.jpg", normalFilename: "YFGM_Grass01_Normal.jpg", roughnessFilename: "YFGM_Grass01_Roughness.jpg", emissionFilename: null, defaultRoughness: 1.0, defaultTileSize: 4, previewColor: "#4a7a2e", thumbnailFilename: "YFGM_Grass01_thumb.jpg" },
	{ id: "yfgm_grass02", name: "Wild Grass", category: "grass", diffuseFilename: "YFGM_Grass02.jpg", normalFilename: "YFGM_Grass02_Normal.jpg", roughnessFilename: "YFGM_Grass02_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.8, defaultTileSize: 4, previewColor: "#5a8a3e", thumbnailFilename: "YFGM_Grass02_thumb.jpg" },
	{ id: "yfgm_grass03", name: "Dense Grass", category: "grass", diffuseFilename: "YFGM_Grass03.jpg", normalFilename: "YFGM_Grass03_Normal.jpg", roughnessFilename: "YFGM_Grass03_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.8, defaultTileSize: 4, previewColor: "#4d8030", thumbnailFilename: "YFGM_Grass03_thumb.jpg" },
	{ id: "yfgm_grass04", name: "Warm Grass", category: "grass", diffuseFilename: "YFGM_Grass04.jpg", normalFilename: "YFGM_Grass04_Normal.jpg", roughnessFilename: "YFGM_Grass04_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.8, defaultTileSize: 4, previewColor: "#558538", colorTint: [1.0, 0.95, 0.95], thumbnailFilename: "YFGM_Grass04_thumb.jpg" },
	{ id: "yfgm_grass05", name: "Autumn Grass", category: "grass", diffuseFilename: "YFGM_Grass05.jpg", normalFilename: "YFGM_Grass05_Normal.jpg", roughnessFilename: "YFGM_Grass05_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.8, defaultTileSize: 4, previewColor: "#6a8a48", colorTint: [1.0, 0.961, 0.902], thumbnailFilename: "YFGM_Grass05_thumb.jpg" },
	{ id: "yfgm_grass06", name: "Meadow Grass", category: "grass", diffuseFilename: "YFGM_Grass06.jpg", normalFilename: "YFGM_Grass06_Normal.jpg", roughnessFilename: "YFGM_Grass06_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.8, defaultTileSize: 4, previewColor: "#5d8a42", thumbnailFilename: "YFGM_Grass06_thumb.jpg" },
	{ id: "yfgm_grassleafs01", name: "Grass & Leaves", category: "grass", diffuseFilename: "YFGM_GrassLeafs01.jpg", normalFilename: "YFGM_GrassLeafs01_Normal.jpg", roughnessFilename: "YFGM_GrassLeafs01_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.8, defaultTileSize: 4, previewColor: "#4a7030", thumbnailFilename: "YFGM_GrassLeafs01_thumb.jpg" },
	{ id: "yfgm_grassleafs02", name: "Leafy Ground", category: "grass", diffuseFilename: "YFGM_GrassLeafs02.jpg", normalFilename: "YFGM_GrassLeafs02_Normal.jpg", roughnessFilename: "YFGM_GrassLeafs02_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.8, defaultTileSize: 4, previewColor: "#506828", thumbnailFilename: "YFGM_GrassLeafs02_thumb.jpg" },
	{ id: "yfgm_frozengrass", name: "Frozen Grass", category: "snow", diffuseFilename: "YFGM_FrozenGrass.jpg", normalFilename: "YFGM_FrozenGrass_Normal.jpg", roughnessFilename: "YFGM_FrozenGrass_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.8, defaultTileSize: 4, previewColor: "#8aaa8e", thumbnailFilename: "YFGM_FrozenGrass_thumb.jpg" },

	// ═══════════════ Ground (4) ═══════════════
	{ id: "yfgm_ground01", name: "Dark Ground", category: "ground", diffuseFilename: "YFGM_Ground01.jpg", normalFilename: "YFGM_Ground01_Normal.jpg", roughnessFilename: "YFGM_Ground01_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.85, defaultTileSize: 4, previewColor: "#5a4430", colorTint: [0.35, 0.268, 0.21], thumbnailFilename: "YFGM_Ground01_thumb.jpg" },
	{ id: "yfgm_ground02", name: "Sandy Ground", category: "ground", diffuseFilename: "YFGM_Ground02.jpg", normalFilename: "YFGM_Ground02_Normal.jpg", roughnessFilename: "YFGM_Ground02_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.85, defaultTileSize: 4, previewColor: "#8a7050", colorTint: [0.6, 0.501, 0.36], thumbnailFilename: "YFGM_Ground02_thumb.jpg" },
	{ id: "yfgm_groundstones01", name: "Stony Ground", category: "ground", diffuseFilename: "YFGM_GroundStones01.jpg", normalFilename: "YFGM_GroundStones01_Normal.jpg", roughnessFilename: "YFGM_GroundStones01_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.85, defaultTileSize: 4, previewColor: "#7a7060", thumbnailFilename: "YFGM_GroundStones01_thumb.jpg" },
	{ id: "yfgm_groundstones02", name: "Rocky Ground", category: "ground", diffuseFilename: "YFGM_GroundStones02.jpg", normalFilename: "YFGM_GroundStones02_Normal.jpg", roughnessFilename: "YFGM_GroundStones02_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.85, defaultTileSize: 4, previewColor: "#6a6050", thumbnailFilename: "YFGM_GroundStones02_thumb.jpg" },

	// ═══════════════ Rock / Soil / Gravel (5) ═══════════════
	{ id: "yfgm_soilgravel01", name: "Soil & Gravel", category: "rock", diffuseFilename: "YFGM_SoilGravel01.jpg", normalFilename: "YFGM_SoilGravel01_Normal.jpg", roughnessFilename: "YFGM_SoilGravel01_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.85, defaultTileSize: 4, previewColor: "#7a6a50", thumbnailFilename: "YFGM_SoilGravel01_thumb.jpg" },
	{ id: "yfgm_soilgravel02", name: "Fine Gravel", category: "rock", diffuseFilename: "YFGM_SoilGravel02.jpg", normalFilename: "YFGM_SoilGravel02_Normal.jpg", roughnessFilename: "YFGM_SoilGravel02_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.85, defaultTileSize: 4, previewColor: "#8a7a60", thumbnailFilename: "YFGM_SoilGravel02_thumb.jpg" },
	{ id: "yfgm_soilgravel03", name: "Coarse Gravel", category: "rock", diffuseFilename: "YFGM_SoilGravel03.jpg", normalFilename: "YFGM_SoilGravel03_Normal.jpg", roughnessFilename: "YFGM_SoilGravel03_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.85, defaultTileSize: 4, previewColor: "#8a7868", colorTint: [0.9, 0.855, 0.855], thumbnailFilename: "YFGM_SoilGravel03_thumb.jpg" },
	{ id: "yfgm_soilgravel04", name: "Pebble Gravel", category: "rock", diffuseFilename: "YFGM_SoilGravel04.jpg", normalFilename: "YFGM_SoilGravel04_Normal.jpg", roughnessFilename: "YFGM_SoilGravel04_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.85, defaultTileSize: 4, previewColor: "#7a7060", thumbnailFilename: "YFGM_SoilGravel04_thumb.jpg" },
	{ id: "yfgm_mossstones", name: "Mossy Stones", category: "rock", diffuseFilename: "YFGM_MossStones.jpg", normalFilename: "YFGM_MossStones_Normal.jpg", roughnessFilename: "YFGM_MossStones_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.85, defaultTileSize: 4, previewColor: "#5a7048", thumbnailFilename: "YFGM_MossStones_thumb.jpg" },

	// ═══════════════ Sand / Soil (5) ═══════════════
	{ id: "yfgm_sandysoil", name: "Sandy Soil", category: "sand", diffuseFilename: "YFGM_SandySoil.jpg", normalFilename: "YFGM_SandySoil_Normal.jpg", roughnessFilename: "YFGM_SandySoil_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.85, defaultTileSize: 4, previewColor: "#b09060", thumbnailFilename: "YFGM_SandySoil_thumb.jpg" },
	{ id: "yfgm_soilmoss", name: "Mossy Soil", category: "sand", diffuseFilename: "YFGM_SoilMoss.jpg", normalFilename: "YFGM_SoilMoss_Normal.jpg", roughnessFilename: "YFGM_SoilMoss_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.85, defaultTileSize: 4, previewColor: "#5a6a38", thumbnailFilename: "YFGM_SoilMoss_thumb.jpg" },
	{ id: "yfgm_soilweeds", name: "Weedy Soil", category: "sand", diffuseFilename: "YFGM_SoilWeeds.jpg", normalFilename: "YFGM_SoilWeeds_Normal.jpg", roughnessFilename: "YFGM_SoilWeeds_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.85, defaultTileSize: 4, previewColor: "#6a7040", thumbnailFilename: "YFGM_SoilWeeds_thumb.jpg" },
	{ id: "yfgm_clay", name: "Clay", category: "sand", diffuseFilename: "YFGM_Clay.jpg", normalFilename: "YFGM_Clay_Normal.jpg", roughnessFilename: "YFGM_Clay_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.85, defaultTileSize: 4, previewColor: "#8a7a68", colorTint: [0.5, 0.485, 0.475], thumbnailFilename: "YFGM_Clay_thumb.jpg" },
	{ id: "yfgm_salt", name: "Salt Flat", category: "sand", diffuseFilename: "YFGM_Salt.jpg", normalFilename: "YFGM_Salt_Normal.jpg", roughnessFilename: "YFGM_Salt_Roughness.jpg", emissionFilename: null, defaultRoughness: 1.0, defaultTileSize: 4, previewColor: "#c0c0b0", colorTint: [0.75, 0.75, 0.75], thumbnailFilename: "YFGM_Salt_thumb.jpg" },

	// ═══════════════ Snow (1 + FrozenGrass above) ═══════════════
	// Snow has no diffuse texture in the package — uses white albedo + normal map only
	// Skipped: needs a white placeholder or procedural white

	// ═══════════════ Dry / Arid (3) ═══════════════
	{ id: "yfgm_dry01", name: "Dry Earth", category: "ground", diffuseFilename: "YFGM_Dry01.jpg", normalFilename: "YFGM_Dry01_Normal.jpg", roughnessFilename: "YFGM_Dry01_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.85, defaultTileSize: 4, previewColor: "#9a8060", colorTint: [0.6, 0.549, 0.478], thumbnailFilename: "YFGM_Dry01_thumb.jpg" },
	{ id: "yfgm_dry02", name: "Cracked Earth", category: "ground", diffuseFilename: "YFGM_Dry02.jpg", normalFilename: "YFGM_Dry02_Normal.jpg", roughnessFilename: "YFGM_Dry02_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.85, defaultTileSize: 4, previewColor: "#8a7050", thumbnailFilename: "YFGM_Dry02_thumb.jpg" },
	{ id: "yfgm_dry03", name: "Parched Ground", category: "ground", diffuseFilename: "YFGM_Dry03.jpg", normalFilename: "YFGM_Dry03_Normal.jpg", roughnessFilename: "YFGM_Dry03_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.85, defaultTileSize: 4, previewColor: "#7a6840", thumbnailFilename: "YFGM_Dry03_thumb.jpg" },

	// ═══════════════ Special (3) ═══════════════
	{ id: "yfgm_mars", name: "Mars Surface", category: "special", diffuseFilename: "YFGM_Mars.jpg", normalFilename: "YFGM_Mars_Normal.jpg", roughnessFilename: "YFGM_Mars_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.85, defaultTileSize: 4, previewColor: "#b05830", thumbnailFilename: "YFGM_Mars_thumb.jpg" },
	{ id: "yfgm_burnt", name: "Burnt Ground", category: "special", diffuseFilename: "YFGM_Burnt.jpg", normalFilename: "YFGM_Burnt_Normal.jpg", roughnessFilename: "YFGM_Burnt_Roughness.jpg", emissionFilename: "YFGM_Burnt_Emission.jpg", defaultRoughness: 0.8, defaultTileSize: 4, previewColor: "#3a2a1a", colorTint: [0.25, 0.25, 0.25], emissionIntensity: 1.5, thumbnailFilename: "YFGM_Burnt_thumb.jpg" },
	{ id: "yfgm_lava", name: "Lava", category: "special", diffuseFilename: "", normalFilename: "YFGM_Lava_Normal.jpg", roughnessFilename: "YFGM_Lava_Roughness.jpg", emissionFilename: "YFGM_Lava_Emission.jpg", defaultRoughness: 0.8, defaultTileSize: 4, previewColor: "#ff4400", emissionIntensity: 2.5, thumbnailFilename: "YFGM_Lava_thumb.jpg" },

	// ═══════════════ Classic (4) — Original ambientCG terrain textures ═══════════════
	{ id: "classic_ground037", name: "Dry Earth (Classic)", category: "classic", diffuseFilename: "Ground037.jpg", normalFilename: "Ground037_Normal.jpg", roughnessFilename: "Ground037_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.85, defaultTileSize: 4, previewColor: "#8b6914", thumbnailFilename: null },
	{ id: "classic_grass004", name: "Lawn Grass (Classic)", category: "classic", diffuseFilename: "Grass004.jpg", normalFilename: "Grass004_Normal.jpg", roughnessFilename: "Grass004_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.75, defaultTileSize: 4, previewColor: "#6b8e23", thumbnailFilename: null },
	{ id: "classic_rock035", name: "Mountain Rock (Classic)", category: "classic", diffuseFilename: "Rock035.jpg", normalFilename: "Rock035_Normal.jpg", roughnessFilename: "Rock035_Roughness.jpg", emissionFilename: null, defaultRoughness: 0.92, defaultTileSize: 128, previewColor: "#7a7a7a", thumbnailFilename: null },
	{ id: "classic_snow006", name: "Snow (Classic)", category: "classic", diffuseFilename: "Snow006.jpg", normalFilename: "Snow006_Normal.jpg", roughnessFilename: null, emissionFilename: null, defaultRoughness: 0.3, defaultTileSize: 2, previewColor: "#f0f0f0", thumbnailFilename: null },
];

// ===== Lookup helpers =====

export function getTerrainMaterialById(id: string): TerrainMaterial | undefined {
	return TERRAIN_MATERIAL_CATALOG.find((m) => m.id === id);
}

export function getTerrainMaterialsByCategory(cat: TerrainMaterialCategory): TerrainMaterial[] {
	return TERRAIN_MATERIAL_CATALOG.filter((m) => m.category === cat);
}

/** Given a diffuse URL, find the matching catalog material */
export function findMaterialByDiffuseUrl(diffuseUrl: string): TerrainMaterial | undefined {
	return TERRAIN_MATERIAL_CATALOG.find(
		(m) => diffuseUrl.endsWith(m.diffuseFilename) || diffuseUrl.includes(m.diffuseFilename),
	);
}
