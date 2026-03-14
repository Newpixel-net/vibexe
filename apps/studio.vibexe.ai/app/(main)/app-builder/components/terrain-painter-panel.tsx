"use client";

/**
 * TerrainPainterPanel — UI for the Procedural Terrain Painter module
 *
 * Mirrors the Unity inspector layout:
 * - Two tabs: Layers | Settings
 * - Layer list with texture swatches, enable/disable, delete
 * - Modifier stack per selected layer (Height, Slope, Curvature, Noise, Direction, TextureMask)
 * - Each modifier: blend mode dropdown, opacity slider
 * - Repaint button at the bottom
 *
 * Communicates with the sandpack iframe via postMessage bridge.
 */

import {
	ChevronDown,
	ChevronRight,
	Eye,
	EyeOff,
	Layers,
	Mountain,
	Paintbrush,
	Plus,
	Settings,
	Trash2,
	X,
	TreePine,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePopulationEngine } from "../lib/use-population-engine";
import { TerrainPopulateTab } from "./terrain-populate-tab";
import {
	TEXTURE_CATALOG,
	TEXTURE_CATEGORIES,
	textureUrl,
	type TextureCategory,
} from "../lib/texture-library-data";
import {
	TERRAIN_MATERIAL_CATALOG,
	TERRAIN_MATERIAL_CATEGORIES,
	terrainTextureUrl,
	terrainThumbnailUrl,
	getTerrainMaterialById,
	findMaterialByDiffuseUrl,
	type TerrainMaterialCategory,
} from "../lib/terrain-material-catalog";
import {
	TERRAIN_PRESETS,
	GENRE_CATEGORIES,
	ENVIRONMENT_CATEGORIES,
	filterPresets,
} from "../lib/terrain-presets";
import type { BiomeParamRanges } from "../lib/terrain-presets";

// ===== Resolve biome params from preset ranges =====
// This runs client-side so the bridge doesn't need to depend on
// the terrain-painter module being loaded on window.__vibexe_modules__
function resolveBiomeParams(biomeRanges: BiomeParamRanges, seed: number) {
	// Seeded PRNG (same algorithm as the module uses)
	let s = ((seed % 2147483647) + 2147483647) % 2147483647;
	if (s === 0) s = 1;
	const rng = () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
	const rand = (lo: number, hi: number) => lo + (hi - lo) * rng();

	return {
		heightScale: rand(biomeRanges.heightScale[0], biomeRanges.heightScale[1]),
		continentalGamma: rand(biomeRanges.continentalGamma[0], biomeRanges.continentalGamma[1]),
		continentalFreq: biomeRanges.continentalFreq,
		ridgeFreq: rand(biomeRanges.ridgeFreq[0], biomeRanges.ridgeFreq[1]),
		ridgePower: rand(biomeRanges.ridgePower[0], biomeRanges.ridgePower[1]),
		ridgeSharpness: rand(biomeRanges.ridgeSharpness[0], biomeRanges.ridgeSharpness[1]),
		plateauSteepness: rand(biomeRanges.plateauSteepness[0], biomeRanges.plateauSteepness[1]),
		hillsAmp: rand(biomeRanges.hillsAmp[0], biomeRanges.hillsAmp[1]),
		detailAmp: rand(biomeRanges.detailAmp[0], biomeRanges.detailAmp[1]),
		warpStrength: rand(biomeRanges.warpStrength[0], biomeRanges.warpStrength[1]),
		thermalIterations: Math.round(rand(biomeRanges.thermalIter[0], biomeRanges.thermalIter[1])),
		talusAngle: rand(biomeRanges.talusAngle[0], biomeRanges.talusAngle[1]),
		hydroDrops: Math.round(rand(biomeRanges.hydroDrops[0], biomeRanges.hydroDrops[1])),
		peakRounds: Math.round(rand(biomeRanges.peakRounds[0], biomeRanges.peakRounds[1])),
		seed,
	};
}

// ===== Types (mirroring the runtime module types) =====

type BlendMode = "Multiply" | "Add" | "Subtract" | "Min" | "Max";
type ModifierType = "Height" | "Slope" | "Curvature" | "Noise" | "Direction" | "TextureMask";

interface ModifierData {
	type: ModifierType;
	enabled: boolean;
	blendMode: BlendMode;
	opacity: number; // 0-100
	params: Record<string, number | string | boolean>;
}

interface LayerData {
	name: string;
	enabled: boolean;
	previewColor: string;
	diffuseUrl: string;
	tileSize: number; // world units per tile — matching Unity's TerrainLayer.tileSize
	modifiers: ModifierData[];
	// PBR material controls
	opacity: number; // 0-100, default 100
	roughness: number; // 0.0-1.0, default 0.8
	normalIntensity: number; // 0.0-1.0, default 1.0
	metallic: boolean; // default false
	// Material catalog reference
	materialId?: string; // links to terrain-material-catalog
	emissionUrl?: string; // emission map URL (for Lava/Burnt)
	emissionIntensity?: number; // 0.0-3.0, default 0
}

interface TerrainPainterSettings {
	splatmapResolution: number;
	terrainWidth: number;
	terrainDepth: number;
	terrainHeightScale: number;
	terrainSegments: number;
}

// ===== Default modifier templates =====

const MODIFIER_DEFAULTS: Record<ModifierType, Omit<ModifierData, "type">> = {
	Height: {
		enabled: true,
		blendMode: "Multiply",
		opacity: 100,
		params: { min: 0, max: 2000, minFalloff: 1, maxFalloff: 1 },
	},
	Slope: {
		enabled: true,
		blendMode: "Multiply",
		opacity: 100,
		params: { minAngle: 0, maxAngle: 90, minFalloff: 10, maxFalloff: 10 },
	},
	Curvature: {
		enabled: true,
		blendMode: "Multiply",
		opacity: 100,
		params: { solver: 0, minCurvature: 0, maxCurvature: 0.25, radius: 1, minFalloff: 0.001, maxFalloff: 0.001 },
	},
	Noise: {
		enabled: true,
		blendMode: "Multiply",
		opacity: 100,
		params: { noiseType: 0, noiseScale: 50, noiseOffsetX: 0, noiseOffsetY: 0, levelMin: 0.5, levelMax: 1 },
	},
	Direction: {
		enabled: true,
		blendMode: "Multiply",
		opacity: 100,
		params: { xAngle: 45, yAngle: 0, levelMin: 0, levelMax: 1 },
	},
	TextureMask: {
		enabled: true,
		blendMode: "Multiply",
		opacity: 100,
		params: { textureUrl: "", channel: 0, spanTerrains: false, tiling: 1 },
	},
};

// ===== Default layer presets =====

const DEFAULT_LAYERS: LayerData[] = [
	{
		name: "Sandy Ground",
		enabled: true,
		previewColor: "#b8a07a",
		diffuseUrl: "/api/app-builder/media-stock-3d/textures/YFGM_Ground02.jpg",
		tileSize: 4,
		opacity: 100,
		roughness: 0.85,
		normalIntensity: 1.0,
		metallic: false,
		materialId: "yfgm_ground02",
		modifiers: [
			{ type: "Height", ...MODIFIER_DEFAULTS.Height, params: { min: 0, max: 0.25, minFalloff: 0.02, maxFalloff: 0.1 } },
			{ type: "Slope", ...MODIFIER_DEFAULTS.Slope, params: { minAngle: 0, maxAngle: 40, minFalloff: 5, maxFalloff: 10 } },
		],
	},
	{
		name: "Green Grass",
		enabled: true,
		previewColor: "#4a7a2e",
		diffuseUrl: "/api/app-builder/media-stock-3d/textures/YFGM_Grass01.jpg",
		tileSize: 4,
		opacity: 100,
		roughness: 0.8,
		normalIntensity: 1.0,
		metallic: false,
		materialId: "yfgm_grass01",
		modifiers: [
			{ type: "Height", ...MODIFIER_DEFAULTS.Height, params: { min: 0.05, max: 0.45, minFalloff: 0.03, maxFalloff: 0.12 } },
			{ type: "Slope", ...MODIFIER_DEFAULTS.Slope, params: { minAngle: 0, maxAngle: 30, minFalloff: 3, maxFalloff: 10 } },
		],
	},
	{
		name: "Rocky Ground",
		enabled: true,
		previewColor: "#6a6a6a",
		diffuseUrl: "/api/app-builder/media-stock-3d/textures/YFGM_GroundStones02.jpg",
		tileSize: 4,
		opacity: 100,
		roughness: 0.9,
		normalIntensity: 1.0,
		metallic: false,
		materialId: "yfgm_groundstones02",
		modifiers: [
			{ type: "Height", ...MODIFIER_DEFAULTS.Height, params: { min: 0.15, max: 0.95, minFalloff: 0.08, maxFalloff: 0.1 } },
			{ type: "Slope", ...MODIFIER_DEFAULTS.Slope, params: { minAngle: 30, maxAngle: 90, minFalloff: 10, maxFalloff: 5 } },
		],
	},
	{
		name: "Snow",
		enabled: true,
		previewColor: "#e8f0f0",
		diffuseUrl: "/api/app-builder/media-stock-3d/textures/YFGM_FrozenGrass.jpg",
		tileSize: 4,
		opacity: 100,
		roughness: 0.7,
		normalIntensity: 1.0,
		metallic: false,
		materialId: "yfgm_frozengrass",
		modifiers: [
			{ type: "Height", ...MODIFIER_DEFAULTS.Height, params: { min: 0.55, max: 1.0, minFalloff: 0.1, maxFalloff: 0.02 } },
			{ type: "Slope", ...MODIFIER_DEFAULTS.Slope, params: { minAngle: 0, maxAngle: 40, minFalloff: 5, maxFalloff: 10 } },
		],
	},
];


// ===== Props =====

export interface TerrainPainterPanelProps {
	sendToIframe: (msg: Record<string, unknown>) => void;
	onClose: () => void;
	onTerrainConfigChanged?: (config: {
		enabled: boolean;
		width: number;
		depth: number;
		heightScale: number;
		segments: number;
		biome?: string;
		seed?: number;
		layers: Array<{ textureUrl: string; normalUrl: string; enabled: boolean; tileSize: number; opacity?: number; roughness?: number; normalIntensity?: number; metallic?: boolean; modifiers?: any[]; materialId?: string; emissionUrl?: string; emissionIntensity?: number }>;
	}) => void;
	initialConfig?: {
		width?: number;
		depth?: number;
		heightScale?: number;
		segments?: number;
		biome?: string;
		seed?: number;
		layers?: Array<{
			textureUrl?: string;
			enabled?: boolean;
			tileSize?: number;
			opacity?: number;
			roughness?: number;
			normalIntensity?: number;
			metallic?: boolean;
			modifiers?: any[];
			materialId?: string;
			emissionUrl?: string;
			emissionIntensity?: number;
		}>;
	};
}

// ===== Component =====

export function TerrainPainterPanel({
	sendToIframe,
	onClose,
	onTerrainConfigChanged,
	initialConfig,
}: TerrainPainterPanelProps) {
	const [activeTab, setActiveTab] = useState<"layers" | "settings" | "sculpt" | "populate">("layers");
	const population = usePopulationEngine({ sendToIframe });
	// Initialize layers from saved config if available, otherwise use defaults
	const [layers, setLayers] = useState<LayerData[]>(() => {
		if (initialConfig?.layers && initialConfig.layers.length > 0) {
			return initialConfig.layers.map((l, idx) => {
				const defLayer = DEFAULT_LAYERS[idx];
				// Resolve display name from catalog (materialId > URL match > filename)
				const catEntry = l.materialId
					? getTerrainMaterialById(l.materialId)
					: l.textureUrl ? findMaterialByDiffuseUrl(l.textureUrl) : undefined;
				const fileName = l.textureUrl?.split("/").pop()?.replace(/\.[^.]+$/, "") || defLayer?.name || `Layer ${idx + 1}`;
				return {
					name: catEntry?.name || fileName,
					enabled: l.enabled !== false,
					previewColor: catEntry?.previewColor || defLayer?.previewColor || "#808080",
					diffuseUrl: l.textureUrl || defLayer?.diffuseUrl || "",
					tileSize: l.tileSize ?? defLayer?.tileSize ?? 4,
					opacity: l.opacity ?? defLayer?.opacity ?? 100,
					roughness: l.roughness ?? defLayer?.roughness ?? 0.8,
					normalIntensity: l.normalIntensity ?? defLayer?.normalIntensity ?? 1.0,
					metallic: l.metallic ?? defLayer?.metallic ?? false,
					materialId: l.materialId ?? catEntry?.id ?? defLayer?.materialId,
					emissionUrl: l.emissionUrl,
					emissionIntensity: l.emissionIntensity,
					modifiers: (l.modifiers && l.modifiers.length > 0 ? l.modifiers : defLayer?.modifiers || []) as ModifierData[],
				};
			});
		}
		return DEFAULT_LAYERS;
	});
	const [selectedLayer, setSelectedLayer] = useState(0);
	const [showHeatmap, setShowHeatmap] = useState(false);
	const [showBoundaryGrid, setShowBoundaryGrid] = useState(false);
	const [settings, setSettings] = useState<TerrainPainterSettings>(() => ({
		splatmapResolution: 256,
		terrainWidth: initialConfig?.width ?? 200,
		terrainDepth: initialConfig?.depth ?? 200,
		terrainHeightScale: initialConfig?.heightScale ?? 40,
		terrainSegments: initialConfig?.segments ?? 256,
	}));

	// Sculpt state
	const [sculptBrushType, setSculptBrushType] = useState<"raise" | "lower" | "flatten" | "smooth" | "paint" | "erase">("raise");
	const [sculptBrushSize, setSculptBrushSize] = useState(10);
	const [sculptBrushStrength, setSculptBrushStrength] = useState(0.3);
	const [sculptBrushFalloff, setSculptBrushFalloff] = useState<"gaussian" | "linear" | "flat">("gaussian");
	const [sculptActive, setSculptActive] = useState(false);

	// Preset browser state — restore from saved config if biome was persisted
	const [selectedGenre, setSelectedGenre] = useState<string>("all");
	const [selectedEnvironment, setSelectedEnvironment] = useState<string>("all");
	const [selectedPreset, setSelectedPreset] = useState<string | null>(() => {
		if (initialConfig?.biome) {
			const match = TERRAIN_PRESETS.find((p) => p.biomeId === initialConfig.biome);
			return match?.id || null;
		}
		return null;
	});
	const [biomeSeed, setBiomeSeed] = useState<number>(() =>
		initialConfig?.seed ?? Math.floor(Math.random() * 999999)
	);

	// Sculpt activation/deactivation on tab change
	useEffect(() => {
		if (activeTab === "sculpt") {
			sendToIframe({
				type: "terrain-painter-sculpt-activate",
				brushType: sculptBrushType,
				brushSize: sculptBrushSize,
				brushStrength: sculptBrushStrength,
				brushFalloff: sculptBrushFalloff,
				paintLayerIndex: selectedLayer,
			});
			setSculptActive(true);
		} else if (sculptActive) {
			sendToIframe({ type: "terrain-painter-sculpt-deactivate" });
			setSculptActive(false);
		}
	}, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

	// Deactivate sculpt on panel close
	useEffect(() => {
		return () => {
			if (sculptActive) {
				sendToIframe({ type: "terrain-painter-sculpt-deactivate" });
			}
		};
	}, [sculptActive, sendToIframe]);

	// Send parameter updates when sculpt is active
	useEffect(() => {
		if (sculptActive) {
			sendToIframe({
				type: "terrain-painter-sculpt-update",
				brushType: sculptBrushType,
				brushSize: sculptBrushSize,
				brushStrength: sculptBrushStrength,
				brushFalloff: sculptBrushFalloff,
				paintLayerIndex: selectedLayer,
			});
		}
	}, [sculptBrushType, sculptBrushSize, sculptBrushStrength, sculptBrushFalloff, sculptActive, selectedLayer, sendToIframe]);

	// Auto-repaint after terrain generation or heatmap toggle-off — listen for bridge callbacks
	const layersRef = useRef(layers);
	layersRef.current = layers;
	useEffect(() => {
		function handleTerrainMessage(e: MessageEvent) {
			if (e.data?.type === "terrain-painter-terrain-generated" || e.data?.type === "terrain-painter-request-repaint") {
				console.log("[TerrainPainterPanel]", e.data.type, "— auto-repainting...");
				// Small delay to ensure terrain mesh is fully ready in iframe
				setTimeout(() => {
					sendToIframe({
						type: "terrain-painter-repaint",
						layers: layersRef.current.map((l) => ({
							...l,
							modifiers: l.modifiers.map((m) => ({ ...m })),
						})),
					});
				}, 300);
			}
		}
		window.addEventListener("message", handleTerrainMessage);
		return () => window.removeEventListener("message", handleTerrainMessage);
	}, [sendToIframe]);

	// ===== Bridge messages =====

	const sendRepaint = useCallback(() => {
		sendToIframe({
			type: "terrain-painter-repaint",
			layers: layers.map((l) => ({
				...l,
				modifiers: l.modifiers.map((m) => ({ ...m })),
			})),
		});
		// Also persist layer config changes on repaint (not just generate)
		if (onTerrainConfigChanged) {
			const preset = selectedPreset ? TERRAIN_PRESETS.find((p) => p.id === selectedPreset) : null;
			onTerrainConfigChanged({
				enabled: true,
				width: settings.terrainWidth,
				depth: settings.terrainDepth,
				heightScale: settings.terrainHeightScale,
				segments: settings.terrainSegments,
				biome: preset?.biomeId,
				seed: biomeSeed,
				layers: layers.map((l) => ({
					textureUrl: l.diffuseUrl,
					normalUrl: l.diffuseUrl.replace(/\.[^.]+$/, "_Normal$&"),
					enabled: l.enabled,
					tileSize: l.tileSize,
					opacity: l.opacity,
					roughness: l.roughness,
					normalIntensity: l.normalIntensity,
					metallic: l.metallic,
					modifiers: l.modifiers,
					materialId: l.materialId,
					emissionUrl: l.emissionUrl,
					emissionIntensity: l.emissionIntensity,
				})),
			});
		}
	}, [sendToIframe, layers, settings, onTerrainConfigChanged, selectedPreset, biomeSeed]);

	const sendGenerateTerrain = useCallback(() => {
		const preset = selectedPreset ? TERRAIN_PRESETS.find((p) => p.id === selectedPreset) : null;
		sendToIframe({
			type: "terrain-painter-generate-terrain",
			settings,
			biome: preset?.biomeId || null,
			seed: biomeSeed,
		});
		// Persist terrain config so it survives iframe reloads
		if (onTerrainConfigChanged) {
			onTerrainConfigChanged({
				enabled: true,
				width: settings.terrainWidth,
				depth: settings.terrainDepth,
				heightScale: settings.terrainHeightScale,
				segments: settings.terrainSegments,
				biome: preset?.biomeId,
				seed: biomeSeed,
				layers: layers.map((l) => ({
					textureUrl: l.diffuseUrl,
					normalUrl: l.diffuseUrl.replace(/\.[^.]+$/, "_Normal$&"),
					enabled: l.enabled,
					tileSize: l.tileSize,
					opacity: l.opacity,
					roughness: l.roughness,
					normalIntensity: l.normalIntensity,
					metallic: l.metallic,
					modifiers: l.modifiers,
				})),
			});
		}
	}, [sendToIframe, settings, layers, onTerrainConfigChanged, selectedPreset, biomeSeed]);

	const sendRandomize = useCallback(() => {
		if (!selectedPreset) return;
		const preset = TERRAIN_PRESETS.find((p) => p.id === selectedPreset);
		if (!preset) return;

		// Build layer data from preset material config
		const newLayers: LayerData[] = preset.layers.map((pl, i) => {
			const mat = getTerrainMaterialById(pl.materialId);
			return {
				name: mat?.name || `Layer ${i + 1}`,
				enabled: true,
				previewColor: mat?.previewColor || "#808080",
				diffuseUrl: mat ? terrainTextureUrl(mat.diffuseFilename) : "",
				tileSize: pl.tileSize,
				opacity: 100,
				roughness: pl.roughness,
				normalIntensity: pl.normalIntensity,
				metallic: false,
				materialId: pl.materialId,
				modifiers: pl.modifiers.map((m) => ({
					type: m.type as ModifierType,
					enabled: m.enabled,
					blendMode: m.blendMode as BlendMode,
					opacity: m.opacity,
					params: m.params,
				})),
			};
		});
		setLayers(newLayers);

		// Update settings state to match preset dimensions
		setSettings((prev) => ({
			...prev,
			terrainWidth: preset.terrain.width,
			terrainDepth: preset.terrain.depth,
			terrainSegments: preset.terrain.segments,
		}));

		// Resolve biome params from preset ranges (client-side, avoids module loading race)
		const resolved = resolveBiomeParams(preset.terrain.biome, biomeSeed);

		// Send generate with preset terrain dimensions, biomeId, AND resolved params
		sendToIframe({
			type: "terrain-painter-generate-terrain",
			settings: {
				...settings,
				terrainWidth: preset.terrain.width,
				terrainDepth: preset.terrain.depth,
				terrainHeightScale: resolved.heightScale,
				terrainSegments: preset.terrain.segments,
			},
			biome: preset.biomeId,
			seed: biomeSeed,
			resolvedBiomeParams: resolved,
		});

		// Persist terrain config so it survives iframe reloads
		if (onTerrainConfigChanged) {
			onTerrainConfigChanged({
				enabled: true,
				width: preset.terrain.width,
				depth: preset.terrain.depth,
				heightScale: resolved.heightScale,
				segments: preset.terrain.segments,
				biome: preset.biomeId,
				seed: biomeSeed,
				layers: newLayers.map((l) => ({
					textureUrl: l.diffuseUrl,
					normalUrl: l.diffuseUrl.replace(/\.[^.]+$/, "_Normal$&"),
					enabled: l.enabled,
					tileSize: l.tileSize,
					opacity: l.opacity,
					roughness: l.roughness,
					normalIntensity: l.normalIntensity,
					metallic: l.metallic,
					modifiers: l.modifiers,
					materialId: l.materialId,
				})),
			});
		}
		// Auto-repaint with new materials after terrain generation completes
		// Read from layersRef.current inside timeout to avoid stale closure over newLayers
		setTimeout(() => {
			sendToIframe({
				type: "terrain-painter-repaint",
				layers: layersRef.current.map((l) => ({
					textureUrl: l.diffuseUrl,
					normalUrl: l.diffuseUrl.replace(/\.[^.]+$/, "_Normal$&"),
					enabled: l.enabled,
					tileSize: l.tileSize,
					opacity: l.opacity,
					roughness: l.roughness,
					normalIntensity: l.normalIntensity,
					metallic: l.metallic,
					modifiers: l.modifiers,
					materialId: l.materialId,
				})),
				resolution: settings.splatmapResolution,
			});
		}, 1500);
	}, [selectedPreset, biomeSeed, sendToIframe, settings, onTerrainConfigChanged]);

	// ===== Layer actions =====

	const addLayer = useCallback(() => {
		setLayers((prev) => {
			const newLayer: LayerData = {
				name: `Layer ${prev.length + 1}`,
				enabled: true,
				previewColor: "#808080",
				diffuseUrl: "",
				tileSize: 4,
				opacity: 100,
				roughness: 0.8,
				normalIntensity: 1.0,
				metallic: false,
				modifiers: [],
			};
			setSelectedLayer(prev.length);
			return [...prev, newLayer];
		});
	}, []);

	const removeLayer = useCallback(
		(index: number) => {
			setLayers((prev) => {
				const next = prev.filter((_, i) => i !== index);
				setSelectedLayer((sel) => sel >= next.length ? Math.max(0, next.length - 1) : sel);
				return next;
			});
		},
		[],
	);

	const toggleLayer = useCallback((index: number) => {
		setLayers((prev) =>
			prev.map((l, i) => (i === index ? { ...l, enabled: !l.enabled } : l)),
		);
	}, []);

	const updateLayerField = useCallback(
		(index: number, field: keyof LayerData, value: string | number | boolean) => {
			setLayers((prev) =>
				prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)),
			);
		},
		[],
	);

	// ===== Modifier actions =====

	const addModifier = useCallback(
		(type: ModifierType) => {
			const defaults = MODIFIER_DEFAULTS[type];
			const newMod: ModifierData = { type, ...defaults };
			setLayers((prev) =>
				prev.map((l, i) =>
					i === selectedLayer
						? { ...l, modifiers: [...l.modifiers, newMod] }
						: l,
				),
			);
		},
		[selectedLayer],
	);

	const removeModifier = useCallback(
		(modIndex: number) => {
			setLayers((prev) =>
				prev.map((l, i) =>
					i === selectedLayer
						? {
								...l,
								modifiers: l.modifiers.filter(
									(_, mi) => mi !== modIndex,
								),
							}
						: l,
				),
			);
		},
		[selectedLayer],
	);

	const updateModifier = useCallback(
		(modIndex: number, updates: Partial<ModifierData>) => {
			setLayers((prev) =>
				prev.map((l, i) =>
					i === selectedLayer
						? {
								...l,
								modifiers: l.modifiers.map((m, mi) =>
									mi === modIndex ? { ...m, ...updates } : m,
								),
							}
						: l,
				),
			);
		},
		[selectedLayer],
	);

	const updateModifierParam = useCallback(
		(modIndex: number, paramKey: string, value: number | string | boolean) => {
			setLayers((prev) =>
				prev.map((l, i) =>
					i === selectedLayer
						? {
								...l,
								modifiers: l.modifiers.map((m, mi) =>
									mi === modIndex
										? { ...m, params: { ...m.params, [paramKey]: value } }
										: m,
								),
							}
						: l,
				),
			);
		},
		[selectedLayer],
	);

	const selectMaterial = useCallback(
		(layerIndex: number, mat: { diffuseUrl: string; name: string; previewColor: string; roughness: number; tileSize: number; materialId: string; emissionUrl?: string; emissionIntensity?: number }) => {
			setLayers((prev) => {
				const next = [...prev];
				next[layerIndex] = {
					...next[layerIndex],
					diffuseUrl: mat.diffuseUrl,
					name: mat.name,
					previewColor: mat.previewColor,
					roughness: mat.roughness,
					tileSize: mat.tileSize,
					materialId: mat.materialId,
					emissionUrl: mat.emissionUrl,
					emissionIntensity: mat.emissionIntensity,
				};
				return next;
			});
		},
		[],
	);

	// ===== Render =====

	const currentLayer = layers[selectedLayer];

	return (
		<div className="absolute right-0 top-0 bottom-0 w-[320px] bg-[#1a1a1a]/95 backdrop-blur-xl border-l border-white/10 flex flex-col z-40 text-white">
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
				<div className="flex items-center gap-2">
					<Mountain className="w-4 h-4 text-green-400" />
					<span className="text-xs font-semibold tracking-wide">Terrain Painter</span>
					<span className="text-[9px] text-white/30">v1.0.0</span>
				</div>
				<button
					onClick={onClose}
					className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white/80"
				>
					<X className="w-3.5 h-3.5" />
				</button>
			</div>

			{/* Tabs */}
			<div className="flex border-b border-white/10">
				<button
					onClick={() => setActiveTab("layers")}
					className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium transition-colors ${
						activeTab === "layers"
							? "text-green-400 border-b-2 border-green-400"
							: "text-white/50 hover:text-white/70"
					}`}
				>
					<Layers className="w-3 h-3" />
					Layers
				</button>
				<button
					onClick={() => setActiveTab("settings")}
					className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium transition-colors ${
						activeTab === "settings"
							? "text-green-400 border-b-2 border-green-400"
							: "text-white/50 hover:text-white/70"
					}`}
				>
					<Settings className="w-3 h-3" />
					Settings
				</button>
				<button
					onClick={() => setActiveTab("sculpt")}
					className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium transition-colors ${
						activeTab === "sculpt"
							? "text-green-400 border-b-2 border-green-400"
							: "text-white/50 hover:text-white/70"
					}`}
				>
					<Mountain className="w-3 h-3" />
					Sculpt
				</button>
				<button
					onClick={() => setActiveTab("populate")}
					className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium transition-colors ${
						activeTab === "populate"
							? "text-green-400 border-b-2 border-green-400"
							: "text-white/50 hover:text-white/70"
					}`}
				>
					<TreePine className="w-3 h-3" />
					Populate
				</button>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto">
				{activeTab === "layers" && (
					<LayersTab
						layers={layers}
						selectedLayer={selectedLayer}
						onSelectLayer={setSelectedLayer}
						onToggleLayer={toggleLayer}
						onRemoveLayer={removeLayer}
						onAddLayer={addLayer}
						onUpdateLayerField={updateLayerField}
						showHeatmap={showHeatmap}
						onToggleHeatmap={() => {
						const next = !showHeatmap;
						setShowHeatmap(next);
						sendToIframe({ type: "terrain-painter-toggle-heatmap", enabled: next });
					}}
						showBoundaryGrid={showBoundaryGrid}
						onToggleBoundaryGrid={() => {
						setShowBoundaryGrid(!showBoundaryGrid);
						sendToIframe({ type: "terrain-painter-toggle-boundary-grid" });
					}}
						currentLayer={currentLayer}
						onAddModifier={addModifier}
						onRemoveModifier={removeModifier}
						onUpdateModifier={updateModifier}
						onUpdateModifierParam={updateModifierParam}
						onSelectMaterial={selectMaterial}
					/>
				)}
				{activeTab === "settings" && (
					<SettingsTab
						settings={settings}
						onUpdateSettings={(s) => setSettings({ ...settings, ...s })}
						onGenerateTerrain={sendGenerateTerrain}
					/>
				)}
				{activeTab === "sculpt" && (
					<div className="p-3 space-y-4 flex-1">
						{/* Sculpt Tools */}
						<div>
							<label className="text-[10px] text-white/50 uppercase tracking-wider mb-2 block">Sculpt Tools</label>
							<div className="grid grid-cols-2 gap-1.5">
								{(["raise", "lower", "flatten", "smooth"] as const).map(type => (
									<button
										key={type}
										onClick={() => setSculptBrushType(type)}
										className={`py-1.5 rounded text-[11px] font-medium transition-colors ${
											sculptBrushType === type
												? "bg-green-600 text-white"
												: "bg-white/5 text-white/60 hover:bg-white/10"
										}`}
									>
										{type.charAt(0).toUpperCase() + type.slice(1)}
									</button>
								))}
							</div>
						</div>

						{/* Paint Tools */}
						<div>
							<label className="text-[10px] text-white/50 uppercase tracking-wider mb-2 block">Paint Tools</label>
							<div className="grid grid-cols-2 gap-1.5">
								{(["paint", "erase"] as const).map(type => (
									<button
										key={type}
										onClick={() => setSculptBrushType(type)}
										className={`py-1.5 rounded text-[11px] font-medium transition-colors ${
											sculptBrushType === type
												? "bg-blue-600 text-white"
												: "bg-white/5 text-white/60 hover:bg-white/10"
										}`}
									>
										{type.charAt(0).toUpperCase() + type.slice(1)}
									</button>
								))}
							</div>
						</div>

						{/* Paint Layer Selector — shown when paint/erase is active */}
						{(sculptBrushType === "paint" || sculptBrushType === "erase") && (
							<div>
								<label className="text-[10px] text-white/50 uppercase tracking-wider mb-1 block">Paint Layer</label>
								<div className="flex flex-col gap-1">
									{layers.map((layer, i) => (
										<button
											key={i}
											onClick={() => setSelectedLayer(i)}
											className={`flex items-center gap-2 px-2 py-1.5 rounded text-[11px] transition-colors ${
												selectedLayer === i
													? "bg-blue-600/30 ring-1 ring-blue-400/50 text-white"
													: "bg-white/5 text-white/60 hover:bg-white/10"
											}`}
										>
											<div
												className="w-4 h-4 rounded border border-white/20 overflow-hidden flex-shrink-0"
												style={{ backgroundColor: layer.previewColor }}
											>
												{layer.diffuseUrl && (
													<img src={layer.diffuseUrl} alt="" className="w-full h-full object-cover" />
												)}
											</div>
											<span>{layer.name}</span>
										</button>
									))}
								</div>
							</div>
						)}

						{/* Brush Size */}
						<div>
							<label className="text-[10px] text-white/50 uppercase tracking-wider">
								Brush Size: {sculptBrushSize}
							</label>
							<input type="range" min={1} max={50} step={1}
								value={sculptBrushSize}
								onChange={e => setSculptBrushSize(Number(e.target.value))}
								className="w-full accent-green-500 mt-1" />
						</div>

						{/* Brush Strength */}
						<div>
							<label className="text-[10px] text-white/50 uppercase tracking-wider">
								Strength: {sculptBrushStrength.toFixed(2)}
							</label>
							<input type="range" min={0.01} max={1} step={0.01}
								value={sculptBrushStrength}
								onChange={e => setSculptBrushStrength(Number(e.target.value))}
								className="w-full accent-green-500 mt-1" />
						</div>

						{/* Falloff */}
						<div>
							<label className="text-[10px] text-white/50 uppercase tracking-wider mb-1 block">Falloff</label>
							<div className="flex gap-1.5">
								{(["gaussian", "linear", "flat"] as const).map(f => (
									<button key={f}
										onClick={() => setSculptBrushFalloff(f)}
										className={`flex-1 py-1 rounded text-[10px] transition-colors ${
											sculptBrushFalloff === f
												? "bg-green-600/50 text-green-300"
												: "bg-white/5 text-white/50 hover:bg-white/10"
										}`}
									>
										{f.charAt(0).toUpperCase() + f.slice(1)}
									</button>
								))}
							</div>
						</div>

						{/* Terrain Presets */}
						<div className="pt-3 border-t border-white/10">
							<label className="text-[10px] text-white/50 uppercase tracking-wider mb-2 block">
								Terrain Presets
							</label>

							{/* Genre filter */}
							<div className="overflow-x-auto flex gap-1 pb-1 mb-1.5">
								{GENRE_CATEGORIES.map((g) => (
									<button
										key={g.id}
										onClick={() => {
											setSelectedGenre(g.id);
											const filtered = filterPresets(g.id, selectedEnvironment);
											if (filtered.length > 0) {
												setSelectedPreset(filtered[0].id);
											} else {
												setSelectedPreset(null);
											}
										}}
										className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] transition-colors ${
											selectedGenre === g.id
												? "bg-purple-600/50 text-purple-200 ring-1 ring-purple-400/40"
												: "bg-white/5 text-white/50 hover:bg-white/10"
										}`}
									>
										{g.icon} {g.name}
									</button>
								))}
							</div>

							{/* Environment filter */}
							<div className="overflow-x-auto flex gap-1 pb-1 mb-2">
								{ENVIRONMENT_CATEGORIES.map((e) => (
									<button
										key={e.id}
										onClick={() => {
											setSelectedEnvironment(e.id);
											const filtered = filterPresets(selectedGenre, e.id);
											if (filtered.length > 0) {
												setSelectedPreset(filtered[0].id);
											} else {
												setSelectedPreset(null);
											}
										}}
										className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] transition-colors ${
											selectedEnvironment === e.id
												? "bg-purple-600/50 text-purple-200 ring-1 ring-purple-400/40"
												: "bg-white/5 text-white/50 hover:bg-white/10"
										}`}
									>
										{e.icon} {e.name}
									</button>
								))}
							</div>

							{/* Preset grid */}
							<div className="grid grid-cols-2 gap-1.5 mb-3 max-h-[200px] overflow-y-auto">
								{filterPresets(selectedGenre, selectedEnvironment).map((preset) => (
									<button
										key={preset.id}
										onClick={() => setSelectedPreset(preset.id)}
										className={`p-1.5 rounded text-left transition-colors ${
											selectedPreset === preset.id
												? "bg-purple-600/40 ring-1 ring-purple-400/50"
												: "bg-white/5 hover:bg-white/10"
										}`}
									>
										<div className="flex items-center gap-1">
											<span className="text-sm">{preset.icon}</span>
											<span className="text-[10px] text-white/80 font-medium truncate">{preset.name}</span>
										</div>
										<div className="text-[9px] text-white/40 mt-0.5 line-clamp-2">{preset.description}</div>
									</button>
								))}
								{filterPresets(selectedGenre, selectedEnvironment).length === 0 && (
									<div className="col-span-2 text-[10px] text-white/30 text-center py-4">
										No presets match these filters
									</div>
								)}
							</div>

							{/* Seed */}
							<div className="flex items-center gap-2 mb-3">
								<label className="text-[10px] text-white/50 shrink-0">Seed:</label>
								<input
									type="number"
									value={biomeSeed}
									onChange={(e) => setBiomeSeed(Number(e.target.value) || 0)}
									className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] text-white/80 outline-none focus:border-purple-400/50"
								/>
								<button
									onClick={() => setBiomeSeed(Math.floor(Math.random() * 999999))}
									className="p-1 rounded bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors"
									title="Random seed"
								>
									<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
										<path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
									</svg>
								</button>
							</div>

							{/* Generate Button */}
							<button
								onClick={sendRandomize}
								disabled={!selectedPreset}
								className={`w-full py-2 rounded-md text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
									selectedPreset
										? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
										: "bg-white/10 text-white/30 cursor-not-allowed"
								}`}
							>
								<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
								</svg>
								Generate {TERRAIN_PRESETS.find((p) => p.id === selectedPreset)?.name || "Terrain"}
							</button>
						</div>

						{/* Repaint after sculpt */}
						<div className="pt-2 border-t border-white/10">
							<button
								onClick={sendRepaint}
								className="w-full py-2 rounded-md bg-white/5 hover:bg-white/10 text-white/70 text-xs transition-colors"
							>
								Repaint After Sculpt
							</button>
						</div>
					</div>
				)}
				{activeTab === "populate" && (
					<TerrainPopulateTab population={population} />
				)}
			</div>

			{/* Repaint button */}
			<div className="p-3 border-t border-white/10">
				<button
					onClick={sendRepaint}
					className="w-full py-2 rounded-md bg-green-600 hover:bg-green-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
				>
					<Paintbrush className="w-3.5 h-3.5" />
					Repaint Terrain
				</button>
			</div>
		</div>
	);
}

// ===== Layers Tab =====

function LayersTab({
	layers,
	selectedLayer,
	onSelectLayer,
	onToggleLayer,
	onRemoveLayer,
	onAddLayer,
	onUpdateLayerField,
	showHeatmap,
	onToggleHeatmap,
	showBoundaryGrid,
	onToggleBoundaryGrid,
	currentLayer,
	onAddModifier,
	onRemoveModifier,
	onUpdateModifier,
	onUpdateModifierParam,
	onSelectMaterial,
}: {
	layers: LayerData[];
	selectedLayer: number;
	onSelectLayer: (i: number) => void;
	onToggleLayer: (i: number) => void;
	onRemoveLayer: (i: number) => void;
	onAddLayer: () => void;
	onUpdateLayerField: (i: number, field: keyof LayerData, value: string | number | boolean) => void;
	showHeatmap: boolean;
	onToggleHeatmap: () => void;
	showBoundaryGrid: boolean;
	onToggleBoundaryGrid: () => void;
	currentLayer: LayerData | undefined;
	onAddModifier: (type: ModifierType) => void;
	onRemoveModifier: (i: number) => void;
	onUpdateModifier: (i: number, updates: Partial<ModifierData>) => void;
	onUpdateModifierParam: (i: number, key: string, value: number | string | boolean) => void;
	onSelectMaterial: (layerIndex: number, mat: { diffuseUrl: string; name: string; previewColor: string; roughness: number; tileSize: number; materialId: string; emissionUrl?: string; emissionIntensity?: number }) => void;
}) {
	const [showAddModifier, setShowAddModifier] = useState(false);

	return (
		<div className="flex flex-col gap-0">
			{/* Layer list */}
			<div className="p-2 flex flex-col gap-1">
				{layers.map((layer, i) => (
					<div
						key={i}
						onClick={() => onSelectLayer(i)}
						className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
							i === selectedLayer
								? "bg-white/10 ring-1 ring-green-400/40"
								: "hover:bg-white/5"
						}`}
					>
						{/* Texture thumbnail */}
						<div
							className="w-6 h-6 rounded border border-white/20 flex-shrink-0 overflow-hidden"
							style={{ backgroundColor: layer.previewColor }}
						>
							{layer.diffuseUrl && (
								<img
									src={layer.diffuseUrl}
									alt={layer.name}
									className="w-full h-full object-cover"
								/>
							)}
						</div>
						{/* Name */}
						<span
							className={`text-[11px] flex-1 ${
								layer.enabled ? "text-white/90" : "text-white/30 line-through"
							}`}
						>
							{layer.name}
						</span>
						{/* Toggle visibility */}
						<button
							onClick={(e) => {
								e.stopPropagation();
								onToggleLayer(i);
							}}
							className="p-0.5 rounded hover:bg-white/10"
						>
							{layer.enabled ? (
								<Eye className="w-3 h-3 text-white/40" />
							) : (
								<EyeOff className="w-3 h-3 text-white/20" />
							)}
						</button>
						{/* Delete */}
						<button
							onClick={(e) => {
								e.stopPropagation();
								onRemoveLayer(i);
							}}
							className="p-0.5 rounded hover:bg-red-500/20"
						>
							<Trash2 className="w-3 h-3 text-red-400/50 hover:text-red-400" />
						</button>
					</div>
				))}
			</div>

			{/* Material picker for selected layer */}
			{currentLayer && (
				<TerrainMaterialPicker
					currentUrl={currentLayer.diffuseUrl}
					currentMaterialId={currentLayer.materialId}
					onSelect={(mat) => onSelectMaterial(selectedLayer, mat)}
				/>
			)}

			{/* PBR Material Controls for selected layer */}
			{currentLayer && (
				<div className="px-3 py-2 border-t border-white/5 flex flex-col gap-2">
					<span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Material</span>
					{/* Opacity */}
					<div className="flex items-center gap-2">
						<span className="text-[9px] text-white/40 w-16 flex-shrink-0">Opacity</span>
						<input type="range" min={0} max={100} step={1}
							value={currentLayer.opacity}
							onChange={e => onUpdateLayerField(selectedLayer, "opacity", Number(e.target.value))}
							className="flex-1 h-1 accent-green-400" />
						<span className="text-[9px] text-white/40 w-7 text-right">{currentLayer.opacity}</span>
					</div>
					{/* Roughness */}
					<div className="flex items-center gap-2">
						<span className="text-[9px] text-white/40 w-16 flex-shrink-0">Roughness</span>
						<input type="range" min={0} max={1} step={0.01}
							value={currentLayer.roughness}
							onChange={e => onUpdateLayerField(selectedLayer, "roughness", Number(e.target.value))}
							className="flex-1 h-1 accent-green-400" />
						<span className="text-[9px] text-white/40 w-7 text-right">{currentLayer.roughness.toFixed(2)}</span>
					</div>
					{/* Normal Intensity */}
					<div className="flex items-center gap-2">
						<span className="text-[9px] text-white/40 w-16 flex-shrink-0">Normal</span>
						<input type="range" min={0} max={2} step={0.05}
							value={currentLayer.normalIntensity}
							onChange={e => onUpdateLayerField(selectedLayer, "normalIntensity", Number(e.target.value))}
							className="flex-1 h-1 accent-green-400" />
						<span className="text-[9px] text-white/40 w-7 text-right">{currentLayer.normalIntensity.toFixed(2)}</span>
					</div>
					{/* Metallic */}
					<label className="flex items-center gap-2 text-[9px] text-white/50 cursor-pointer">
						<input
							type="checkbox"
							checked={currentLayer.metallic}
							onChange={e => onUpdateLayerField(selectedLayer, "metallic", e.target.checked)}
							className="w-3 h-3 rounded accent-green-500"
						/>
						Metallic
					</label>
					{/* Tile Size */}
					<div className="flex items-center gap-2">
						<span className="text-[9px] text-white/40 w-16 flex-shrink-0">Tile Size</span>
						<input type="range" min={0.5} max={32} step={0.5}
							value={currentLayer.tileSize}
							onChange={e => onUpdateLayerField(selectedLayer, "tileSize", Number(e.target.value))}
							className="flex-1 h-1 accent-green-400" />
						<span className="text-[9px] text-white/40 w-7 text-right">{currentLayer.tileSize}</span>
					</div>
				</div>
			)}

			{/* Layer controls */}
			<div className="flex items-center gap-2 px-3 py-2 border-t border-white/5">
				<label className="flex items-center gap-1.5 text-[10px] text-white/40 cursor-pointer">
					<input
						type="checkbox"
						checked={showHeatmap}
						onChange={onToggleHeatmap}
						className="w-3 h-3 rounded border-white/20"
					/>
					Heatmap
				</label>
				<label className="flex items-center gap-1.5 text-[10px] text-white/40 cursor-pointer">
					<input
						type="checkbox"
						checked={showBoundaryGrid}
						onChange={onToggleBoundaryGrid}
						className="w-3 h-3 rounded border-white/20"
					/>
					Boundary
				</label>
				<div className="flex-1" />
				<button
					onClick={onAddLayer}
					className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] text-white/60 hover:text-white/80 transition-colors"
				>
					<Plus className="w-3 h-3" />
					Add Layer
				</button>
			</div>

			{/* Modifier stack for selected layer */}
			{currentLayer && (
				<div className="border-t border-white/10">
					<div className="px-3 py-2 flex items-center justify-between">
						<span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">
							Modifier Stack
						</span>
						<div className="relative">
							<button
								onClick={() => setShowAddModifier(!showAddModifier)}
								className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70"
							>
								<Plus className="w-3 h-3" />
							</button>
							{showAddModifier && (
								<div className="absolute right-0 top-full mt-1 bg-[#252525] border border-white/10 rounded-md shadow-xl z-50 py-1 min-w-[140px]">
									{(
										[
											"Height",
											"Slope",
											"Curvature",
											"Noise",
											"Direction",
											"TextureMask",
										] as ModifierType[]
									).map((type) => (
										<button
											key={type}
											onClick={() => {
												onAddModifier(type);
												setShowAddModifier(false);
											}}
											className="w-full px-3 py-1.5 text-left text-[11px] text-white/70 hover:bg-white/10 hover:text-white/90"
										>
											{type === "TextureMask" ? "Texture Mask" : type}
										</button>
									))}
								</div>
							)}
						</div>
					</div>

					{currentLayer.modifiers.length === 0 ? (
						<div className="px-3 pb-3 text-[10px] text-white/25 italic">
							No modifiers — texture fills entire terrain
						</div>
					) : (
						<div className="px-2 pb-2 flex flex-col gap-1">
							{currentLayer.modifiers.map((mod, mi) => (
								<ModifierRow
									key={mi}
									modifier={mod}
									onUpdate={(updates) => onUpdateModifier(mi, updates)}
									onUpdateParam={(key, val) => onUpdateModifierParam(mi, key, val)}
									onRemove={() => onRemoveModifier(mi)}
								/>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

// ===== Terrain Texture Picker =====

/** Terrain-specific categories most useful for landscape painting */
const TERRAIN_CATEGORIES: TextureCategory[] = [
	"ground", "stone", "nature", "road", "concrete", "brick", "wood", "marble", "special",
];

function TerrainTexturePicker({
	currentUrl,
	onSelect,
}: {
	currentUrl: string;
	onSelect: (url: string, displayName?: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const [category, setCategory] = useState<TextureCategory>("ground");

	// Find current texture's display name
	const currentTex = TEXTURE_CATALOG.find(
		(t) => textureUrl(t.filename) === currentUrl || currentUrl.endsWith(t.filename),
	);

	return (
		<div className="px-3 py-1.5 border-t border-white/5">
			<button
				onClick={() => setOpen(!open)}
				className="w-full flex items-center gap-2 px-2 py-1.5 rounded bg-[#252525] border border-white/10 hover:border-white/20 transition-colors"
			>
				{/* Current texture preview */}
				<div className="w-7 h-7 rounded border border-white/20 overflow-hidden flex-shrink-0 bg-[#1a1a1a]">
					{currentUrl && (
						<img src={currentUrl} alt="" className="w-full h-full object-cover" />
					)}
				</div>
				<span className="text-[10px] text-white/70 flex-1 text-left truncate">
					{currentTex?.displayName || "Select Texture"}
				</span>
				<ChevronDown className={`w-3 h-3 text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
			</button>

			{open && (
				<div className="mt-1.5 space-y-1">
					{/* Category tabs */}
					<div className="flex gap-0.5 overflow-x-auto pb-1 scrollbar-none">
						{TERRAIN_CATEGORIES.map((catId) => {
							const cat = TEXTURE_CATEGORIES.find((c) => c.id === catId);
							if (!cat) return null;
							return (
								<button
									key={cat.id}
									type="button"
									onClick={() => setCategory(cat.id)}
									className={`text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap transition-colors ${
										category === cat.id
											? "bg-green-500/20 text-green-300"
											: "text-neutral-400 hover:text-neutral-300 hover:bg-white/[0.04]"
									}`}
								>
									{cat.label}
								</button>
							);
						})}
					</div>
					{/* Texture grid */}
					<div className="grid grid-cols-5 gap-1 max-h-[200px] overflow-y-auto scrollbar-thin py-0.5">
						{TEXTURE_CATALOG.filter((t) => t.category === category).map((tex) => {
							const url = textureUrl(tex.filename);
							const isActive = currentUrl === url || currentUrl.endsWith(tex.filename);
							return (
								<button
									key={tex.id}
									type="button"
									onClick={() => {
										onSelect(url, tex.displayName);
										setOpen(false);
									}}
									className={`relative w-[38px] h-[38px] mx-auto rounded-full overflow-hidden transition-all shadow-[inset_0_0_6px_rgba(0,0,0,0.25)] ${
										isActive
											? "ring-2 ring-green-400 ring-offset-1 ring-offset-[#1a1a2e]"
											: "ring-1 ring-white/10 hover:ring-green-400/60"
									}`}
									title={tex.displayName}
								>
									<img
										src={url}
										alt={tex.displayName}
										className="w-full h-full object-cover"
										loading="lazy"
									/>
								</button>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}

// ===== Terrain Material Picker (30 YFGM materials + classic) =====

function TerrainMaterialPicker({
	currentUrl,
	currentMaterialId,
	onSelect,
}: {
	currentUrl: string;
	currentMaterialId?: string;
	onSelect: (material: { diffuseUrl: string; name: string; previewColor: string; roughness: number; tileSize: number; materialId: string; emissionUrl?: string; emissionIntensity?: number }) => void;
}) {
	const [open, setOpen] = useState(false);
	const [category, setCategory] = useState<TerrainMaterialCategory>("grass");

	// Find current material
	const currentMat = currentMaterialId
		? getTerrainMaterialById(currentMaterialId)
		: findMaterialByDiffuseUrl(currentUrl);

	return (
		<div className="px-3 py-1.5 border-t border-white/5">
			<button
				onClick={() => setOpen(!open)}
				className="w-full flex items-center gap-2 px-2 py-1.5 rounded bg-[#252525] border border-white/10 hover:border-white/20 transition-colors"
			>
				<div className="w-7 h-7 rounded border border-white/20 overflow-hidden flex-shrink-0 bg-[#1a1a1a]">
					{currentMat?.thumbnailFilename ? (
						<img src={terrainThumbnailUrl(currentMat.thumbnailFilename)} alt="" className="w-full h-full object-cover" />
					) : currentUrl ? (
						<img src={currentUrl} alt="" className="w-full h-full object-cover" />
					) : null}
				</div>
				<span className="text-[10px] text-white/70 flex-1 text-left truncate">
					{currentMat?.name || "Select Material"}
				</span>
				<ChevronDown className={`w-3 h-3 text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
			</button>

			{open && (
				<div className="mt-1.5 space-y-1">
					{/* Category tabs */}
					<div className="flex gap-0.5 overflow-x-auto pb-1 scrollbar-none">
						{TERRAIN_MATERIAL_CATEGORIES.map((cat) => (
							<button
								key={cat.id}
								type="button"
								onClick={() => setCategory(cat.id)}
								className={`text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap transition-colors ${
									category === cat.id
										? "bg-green-500/20 text-green-300"
										: "text-neutral-400 hover:text-neutral-300 hover:bg-white/[0.04]"
								}`}
							>
								{cat.label}
							</button>
						))}
					</div>
					{/* Material grid */}
					<div className="grid grid-cols-5 gap-1 max-h-[200px] overflow-y-auto scrollbar-thin py-0.5">
						{TERRAIN_MATERIAL_CATALOG.filter((m) => m.category === category).map((mat) => {
							const isActive = currentMaterialId === mat.id || currentUrl.endsWith(mat.diffuseFilename);
							const thumbSrc = mat.thumbnailFilename
								? terrainThumbnailUrl(mat.thumbnailFilename)
								: terrainTextureUrl(mat.diffuseFilename);
							return (
								<button
									key={mat.id}
									type="button"
									onClick={() => {
										onSelect({
											diffuseUrl: terrainTextureUrl(mat.diffuseFilename),
											name: mat.name,
											previewColor: mat.previewColor,
											roughness: mat.defaultRoughness,
											tileSize: mat.defaultTileSize,
											materialId: mat.id,
											emissionUrl: mat.emissionFilename ? terrainTextureUrl(mat.emissionFilename) : undefined,
											emissionIntensity: mat.emissionIntensity,
										});
										setOpen(false);
									}}
									className={`relative w-[38px] h-[38px] mx-auto rounded-full overflow-hidden transition-all shadow-[inset_0_0_6px_rgba(0,0,0,0.25)] ${
										isActive
											? "ring-2 ring-green-400 ring-offset-1 ring-offset-[#1a1a2e]"
											: "ring-1 ring-white/10 hover:ring-green-400/60"
									}`}
									title={mat.name}
								>
									<img
										src={thumbSrc}
										alt={mat.name}
										className="w-full h-full object-cover"
										loading="lazy"
									/>
									{mat.emissionFilename && (
										<div className="absolute bottom-0 right-0 w-2 h-2 bg-orange-400 rounded-full" title="Emissive" />
									)}
								</button>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}

// ===== Mini Texture Picker (for TextureMask modifier) =====

function MiniTexturePicker({
	currentUrl,
	onSelect,
}: {
	currentUrl: string;
	onSelect: (url: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const [category, setCategory] = useState<TextureCategory>("ground");

	const currentTex = TEXTURE_CATALOG.find(
		(t) => textureUrl(t.filename) === currentUrl || currentUrl.endsWith(t.filename),
	);

	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center gap-2">
				<span className="text-[9px] text-white/40 w-16">Texture</span>
				<button
					onClick={() => setOpen(!open)}
					className="flex-1 flex items-center gap-1.5 px-1.5 py-0.5 text-[9px] bg-[#333] border border-white/10 rounded hover:border-white/20 text-white/70"
				>
					{currentUrl && (
						<img src={currentUrl} alt="" className="w-4 h-4 rounded-sm object-cover" />
					)}
					<span className="truncate">{currentTex?.displayName || currentUrl || "Pick..."}</span>
					<ChevronDown className={`w-2.5 h-2.5 ml-auto text-white/30 ${open ? "rotate-180" : ""}`} />
				</button>
			</div>
			{open && (
				<div className="space-y-1 ml-[72px]">
					<div className="flex gap-0.5 overflow-x-auto pb-0.5 scrollbar-none">
						{TERRAIN_CATEGORIES.slice(0, 6).map((catId) => {
							const cat = TEXTURE_CATEGORIES.find((c) => c.id === catId);
							if (!cat) return null;
							return (
								<button
									key={cat.id}
									type="button"
									onClick={() => setCategory(cat.id)}
									className={`text-[8px] px-1 py-0.5 rounded whitespace-nowrap ${
										category === cat.id
											? "bg-green-500/20 text-green-300"
											: "text-neutral-400 hover:text-neutral-300"
									}`}
								>
									{cat.label}
								</button>
							);
						})}
					</div>
					<div className="grid grid-cols-5 gap-0.5 max-h-[120px] overflow-y-auto scrollbar-thin">
						{TEXTURE_CATALOG.filter((t) => t.category === category).map((tex) => {
							const url = textureUrl(tex.filename);
							return (
								<button
									key={tex.id}
									type="button"
									onClick={() => { onSelect(url); setOpen(false); }}
									className={`w-[28px] h-[28px] mx-auto rounded-full overflow-hidden ${
										currentUrl === url
											? "ring-2 ring-green-400"
											: "ring-1 ring-white/10 hover:ring-green-400/60"
									}`}
									title={tex.displayName}
								>
									<img src={url} alt={tex.displayName} className="w-full h-full object-cover" loading="lazy" />
								</button>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}

// ===== Modifier Row =====

function ModifierRow({
	modifier,
	onUpdate,
	onUpdateParam,
	onRemove,
}: {
	modifier: ModifierData;
	onUpdate: (updates: Partial<ModifierData>) => void;
	onUpdateParam: (key: string, value: number | string | boolean) => void;
	onRemove: () => void;
}) {
	const [expanded, setExpanded] = useState(false);

	const blendModes: BlendMode[] = ["Multiply", "Add", "Subtract", "Min", "Max"];

	const displayName =
		modifier.type === "TextureMask"
			? "Texture Mask"
			: `${modifier.type} range`;

	return (
		<div className="bg-white/5 rounded border border-white/5">
			{/* Header row — matches Unity layout: name | blend mode | opacity */}
			<div className="flex items-center gap-1 px-2 py-1.5">
				{/* Toggle expand */}
				<button
					onClick={() => setExpanded(!expanded)}
					className="p-0.5 rounded hover:bg-white/10 text-white/30"
				>
					{expanded ? (
						<ChevronDown className="w-3 h-3" />
					) : (
						<ChevronRight className="w-3 h-3" />
					)}
				</button>

				{/* Enable/disable */}
				<input
					type="checkbox"
					checked={modifier.enabled}
					onChange={() => onUpdate({ enabled: !modifier.enabled })}
					className="w-3 h-3"
				/>

				{/* Name */}
				<span className="text-[10px] text-white/70 flex-1 truncate">
					{displayName}
				</span>

				{/* Blend mode dropdown */}
				<select
					value={modifier.blendMode}
					onChange={(e) => onUpdate({ blendMode: e.target.value as BlendMode })}
					className="text-[9px] bg-[#333] border border-white/10 rounded px-1 py-0.5 text-white/70 outline-none"
				>
					{blendModes.map((bm) => (
						<option key={bm} value={bm}>
							{bm}
						</option>
					))}
				</select>

				{/* Opacity */}
				<input
					type="range"
					min={0}
					max={100}
					value={modifier.opacity}
					onChange={(e) => onUpdate({ opacity: Number(e.target.value) })}
					className="w-12 h-1 accent-green-400"
				/>
				<span className="text-[9px] text-white/40 w-7 text-right">
					{modifier.opacity}
				</span>

				{/* Remove */}
				<button
					onClick={onRemove}
					className="p-0.5 rounded hover:bg-red-500/20"
				>
					<X className="w-3 h-3 text-white/20 hover:text-red-400" />
				</button>
			</div>

			{/* Expanded params */}
			{expanded && (
				<div className="px-3 pb-2 pt-1 border-t border-white/5 flex flex-col gap-1.5">
					{modifier.type === "Height" && (
						<>
							<ParamSlider label="Min Height" value={modifier.params.min as number} min={0} max={2000} step={1} onChange={(v) => onUpdateParam("min", v)} />
							<ParamSlider label="Max Height" value={modifier.params.max as number} min={0} max={2000} step={1} onChange={(v) => onUpdateParam("max", v)} />
							<ParamSlider label="Min Falloff" value={modifier.params.minFalloff as number} min={0.001} max={100} step={0.1} onChange={(v) => onUpdateParam("minFalloff", v)} />
							<ParamSlider label="Max Falloff" value={modifier.params.maxFalloff as number} min={0.001} max={100} step={0.1} onChange={(v) => onUpdateParam("maxFalloff", v)} />
						</>
					)}
					{modifier.type === "Slope" && (
						<>
							<ParamSlider label="Min Angle" value={modifier.params.minAngle as number} min={0} max={90} step={1} onChange={(v) => onUpdateParam("minAngle", v)} />
							<ParamSlider label="Max Angle" value={modifier.params.maxAngle as number} min={0} max={90} step={1} onChange={(v) => onUpdateParam("maxAngle", v)} />
							<ParamSlider label="Min Falloff" value={modifier.params.minFalloff as number} min={0.001} max={90} step={0.1} onChange={(v) => onUpdateParam("minFalloff", v)} />
							<ParamSlider label="Max Falloff" value={modifier.params.maxFalloff as number} min={0.001} max={90} step={0.1} onChange={(v) => onUpdateParam("maxFalloff", v)} />
						</>
					)}
					{modifier.type === "Curvature" && (
						<>
							<div className="flex items-center gap-2">
								<span className="text-[9px] text-white/40 w-16">Solver</span>
								<select
									value={modifier.params.solver as number}
									onChange={(e) => onUpdateParam("solver", Number(e.target.value))}
									className="flex-1 text-[9px] bg-[#333] border border-white/10 rounded px-1 py-0.5 text-white/70"
								>
									<option value={0}>Soft</option>
									<option value={1}>Hard</option>
								</select>
							</div>
							<ParamSlider label="Min" value={modifier.params.minCurvature as number} min={0} max={1} step={0.01} onChange={(v) => onUpdateParam("minCurvature", v)} />
							<ParamSlider label="Max" value={modifier.params.maxCurvature as number} min={0} max={1} step={0.01} onChange={(v) => onUpdateParam("maxCurvature", v)} />
							<ParamSlider label="Radius" value={modifier.params.radius as number} min={1} max={16} step={0.5} onChange={(v) => onUpdateParam("radius", v)} />
						</>
					)}
					{modifier.type === "Noise" && (
						<>
							<div className="flex items-center gap-2">
								<span className="text-[9px] text-white/40 w-16">Type</span>
								<select
									value={modifier.params.noiseType as number}
									onChange={(e) => onUpdateParam("noiseType", Number(e.target.value))}
									className="flex-1 text-[9px] bg-[#333] border border-white/10 rounded px-1 py-0.5 text-white/70"
								>
									<option value={0}>Simplex</option>
									<option value={1}>Gradient</option>
								</select>
							</div>
							<ParamSlider label="Scale" value={modifier.params.noiseScale as number} min={1} max={200} step={1} onChange={(v) => onUpdateParam("noiseScale", v)} />
							<ParamSlider label="Offset X" value={modifier.params.noiseOffsetX as number} min={-100} max={100} step={0.1} onChange={(v) => onUpdateParam("noiseOffsetX", v)} />
							<ParamSlider label="Offset Y" value={modifier.params.noiseOffsetY as number} min={-100} max={100} step={0.1} onChange={(v) => onUpdateParam("noiseOffsetY", v)} />
							<ParamSlider label="Level Min" value={modifier.params.levelMin as number} min={0} max={1} step={0.01} onChange={(v) => onUpdateParam("levelMin", v)} />
							<ParamSlider label="Level Max" value={modifier.params.levelMax as number} min={0} max={1} step={0.01} onChange={(v) => onUpdateParam("levelMax", v)} />
						</>
					)}
					{modifier.type === "Direction" && (
						<>
							<ParamSlider label="X Angle" value={modifier.params.xAngle as number} min={0} max={90} step={1} onChange={(v) => onUpdateParam("xAngle", v)} />
							<ParamSlider label="Y Angle" value={modifier.params.yAngle as number} min={0} max={360} step={1} onChange={(v) => onUpdateParam("yAngle", v)} />
							<ParamSlider label="Level Min" value={modifier.params.levelMin as number} min={0} max={1} step={0.01} onChange={(v) => onUpdateParam("levelMin", v)} />
							<ParamSlider label="Level Max" value={modifier.params.levelMax as number} min={0} max={1} step={0.01} onChange={(v) => onUpdateParam("levelMax", v)} />
						</>
					)}
					{modifier.type === "TextureMask" && (
						<>
							<MiniTexturePicker
								currentUrl={(modifier.params.textureUrl as string) || ""}
								onSelect={(url) => onUpdateParam("textureUrl", url)}
							/>
							<div className="flex items-center gap-2">
								<span className="text-[9px] text-white/40 w-16">Channel</span>
								<select
									value={modifier.params.channel as number}
									onChange={(e) => onUpdateParam("channel", Number(e.target.value))}
									className="flex-1 text-[9px] bg-[#333] border border-white/10 rounded px-1 py-0.5 text-white/70"
								>
									<option value={0}>R</option>
									<option value={1}>G</option>
									<option value={2}>B</option>
									<option value={3}>A</option>
								</select>
							</div>
							<ParamSlider label="Tiling" value={modifier.params.tiling as number} min={0.1} max={50} step={0.1} onChange={(v) => onUpdateParam("tiling", v)} />
							<label className="flex items-center gap-2 text-[9px] text-white/40">
								<input
									type="checkbox"
									checked={modifier.params.spanTerrains as boolean}
									onChange={(e) => onUpdateParam("spanTerrains", e.target.checked)}
									className="w-3 h-3"
								/>
								Span Terrains
							</label>
						</>
					)}
				</div>
			)}
		</div>
	);
}

// ===== Param Slider =====

function ParamSlider({
	label,
	value,
	min,
	max,
	step,
	onChange,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	onChange: (v: number) => void;
}) {
	return (
		<div className="flex items-center gap-2">
			<span className="text-[9px] text-white/40 w-16 flex-shrink-0">
				{label}
			</span>
			<input
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(e) => onChange(Number(e.target.value))}
				className="flex-1 h-1 accent-green-400"
			/>
			<input
				type="number"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(e) => onChange(Number(e.target.value))}
				className="w-14 text-[9px] bg-[#333] border border-white/10 rounded px-1 py-0.5 text-white/70 text-right outline-none"
			/>
		</div>
	);
}

// ===== Settings Tab =====

function SettingsTab({
	settings,
	onUpdateSettings,
	onGenerateTerrain,
}: {
	settings: TerrainPainterSettings;
	onUpdateSettings: (s: Partial<TerrainPainterSettings>) => void;
	onGenerateTerrain: () => void;
}) {
	const SIZE_PRESETS = [
		{ label: "Small", width: 100, depth: 100, segments: 128, height: 30 },
		{ label: "Medium", width: 200, depth: 200, segments: 256, height: 40 },
		{ label: "Large", width: 400, depth: 400, segments: 384, height: 60 },
		{ label: "Huge", width: 500, depth: 500, segments: 512, height: 80 },
	];

	const vertexCount = (settings.terrainSegments + 1) * (settings.terrainSegments + 1);
	const isHighPerf = vertexCount > 100000; // >316 segments

	return (
		<div className="p-3 flex flex-col gap-3">
			<div className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">
				Terrain Size Preset
			</div>

			<div className="grid grid-cols-4 gap-1">
				{SIZE_PRESETS.map((p) => (
					<button
						key={p.label}
						onClick={() => onUpdateSettings({
							terrainWidth: p.width,
							terrainDepth: p.depth,
							terrainSegments: p.segments,
							terrainHeightScale: p.height,
						})}
						className={`text-[9px] py-1 rounded border transition-colors ${
							settings.terrainWidth === p.width && settings.terrainSegments === p.segments
								? "bg-blue-600 border-blue-500 text-white"
								: "bg-[#333] border-white/10 text-white/60 hover:bg-[#444]"
						}`}
					>
						{p.label}
					</button>
				))}
			</div>

			<div className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mt-1">
				Custom
			</div>

			<ParamSlider
				label="Width"
				value={settings.terrainWidth}
				min={10}
				max={500}
				step={10}
				onChange={(v) => onUpdateSettings({ terrainWidth: v })}
			/>
			<ParamSlider
				label="Depth"
				value={settings.terrainDepth}
				min={10}
				max={500}
				step={10}
				onChange={(v) => onUpdateSettings({ terrainDepth: v })}
			/>
			<ParamSlider
				label="Height"
				value={settings.terrainHeightScale}
				min={1}
				max={100}
				step={1}
				onChange={(v) => onUpdateSettings({ terrainHeightScale: v })}
			/>
			<ParamSlider
				label="Segments"
				value={settings.terrainSegments}
				min={16}
				max={512}
				step={16}
				onChange={(v) => onUpdateSettings({ terrainSegments: v })}
			/>

			{isHighPerf && (
				<div className="text-[9px] text-amber-400/80 bg-amber-900/20 border border-amber-500/20 rounded px-2 py-1">
					High vertex count ({(vertexCount / 1000).toFixed(0)}K). May reduce FPS on mobile devices.
				</div>
			)}

			<div className="text-[9px] text-white/30">
				{(vertexCount / 1000).toFixed(0)}K vertices &middot; {settings.terrainWidth}x{settings.terrainDepth} units
			</div>

			<div className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mt-2">
				Splatmap
			</div>

			<div className="flex items-center gap-2">
				<span className="text-[9px] text-white/40 w-16">Resolution</span>
				<select
					value={settings.splatmapResolution}
					onChange={(e) =>
						onUpdateSettings({
							splatmapResolution: Number(e.target.value),
						})
					}
					className="flex-1 text-[9px] bg-[#333] border border-white/10 rounded px-1 py-0.5 text-white/70"
				>
					{[64, 128, 256, 512, 1024].map((r) => (
						<option key={r} value={r}>
							{r} x {r}
						</option>
					))}
				</select>
			</div>

			<button
				onClick={onGenerateTerrain}
				className="mt-2 w-full py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
			>
				<Mountain className="w-3.5 h-3.5" />
				Generate Terrain
			</button>
		</div>
	);
}
