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
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	TEXTURE_CATALOG,
	TEXTURE_CATEGORIES,
	textureUrl,
	type TextureCategory,
} from "../lib/texture-library-data";

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
		name: "Dirt",
		enabled: true,
		previewColor: "#8b6914",
		diffuseUrl: "/api/app-builder/media-stock-3d/textures/Ground037.jpg",
		tileSize: 4,
		modifiers: [
			{ type: "Height", ...MODIFIER_DEFAULTS.Height, params: { min: 0, max: 0.25, minFalloff: 0.01, maxFalloff: 0.08 } },
			{ type: "Slope", ...MODIFIER_DEFAULTS.Slope, params: { minAngle: 0, maxAngle: 25, minFalloff: 5, maxFalloff: 10 } },
		],
	},
	{
		name: "Grass",
		enabled: true,
		previewColor: "#6b8e23",
		diffuseUrl: "/api/app-builder/media-stock-3d/textures/Grass004.jpg",
		tileSize: 4,
		modifiers: [
			{ type: "Height", ...MODIFIER_DEFAULTS.Height, params: { min: 0.05, max: 0.55, minFalloff: 0.03, maxFalloff: 0.08 } },
			{ type: "Slope", ...MODIFIER_DEFAULTS.Slope, params: { minAngle: 0, maxAngle: 30, minFalloff: 3, maxFalloff: 8 } },
		],
	},
	{
		name: "Rock",
		enabled: true,
		previewColor: "#7a7a7a",
		diffuseUrl: "/api/app-builder/media-stock-3d/textures/Rock035.jpg",
		tileSize: 128,
		modifiers: [
			{ type: "Slope", ...MODIFIER_DEFAULTS.Slope, params: { minAngle: 20, maxAngle: 90, minFalloff: 8, maxFalloff: 3 } },
		],
	},
	{
		name: "Snow",
		enabled: true,
		previewColor: "#f0f0f0",
		diffuseUrl: "/api/app-builder/media-stock-3d/textures/Snow006.jpg",
		tileSize: 2,
		modifiers: [
			{ type: "Height", ...MODIFIER_DEFAULTS.Height, params: { min: 0.55, max: 1.0, minFalloff: 0.08, maxFalloff: 0.02 } },
			{ type: "Slope", ...MODIFIER_DEFAULTS.Slope, params: { minAngle: 0, maxAngle: 50, minFalloff: 5, maxFalloff: 10 } },
		],
	},
];

// ===== Props =====

export interface TerrainPainterPanelProps {
	sendToIframe: (msg: Record<string, unknown>) => void;
	onClose: () => void;
}

// ===== Component =====

export function TerrainPainterPanel({
	sendToIframe,
	onClose,
}: TerrainPainterPanelProps) {
	const [activeTab, setActiveTab] = useState<"layers" | "settings" | "sculpt">("layers");
	const [layers, setLayers] = useState<LayerData[]>(DEFAULT_LAYERS);
	const [selectedLayer, setSelectedLayer] = useState(0);
	const [showHeatmap, setShowHeatmap] = useState(false);
	const [settings, setSettings] = useState<TerrainPainterSettings>({
		splatmapResolution: 256,
		terrainWidth: 200,
		terrainDepth: 200,
		terrainHeightScale: 8,
		terrainSegments: 256,
	});

	// Sculpt state
	const [sculptBrushType, setSculptBrushType] = useState<"raise" | "lower" | "flatten" | "smooth">("raise");
	const [sculptBrushSize, setSculptBrushSize] = useState(10);
	const [sculptBrushStrength, setSculptBrushStrength] = useState(0.3);
	const [sculptBrushFalloff, setSculptBrushFalloff] = useState<"gaussian" | "linear" | "flat">("gaussian");
	const [sculptActive, setSculptActive] = useState(false);

	// Sculpt activation/deactivation on tab change
	useEffect(() => {
		if (activeTab === "sculpt") {
			sendToIframe({
				type: "terrain-painter-sculpt-activate",
				brushType: sculptBrushType,
				brushSize: sculptBrushSize,
				brushStrength: sculptBrushStrength,
				brushFalloff: sculptBrushFalloff,
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
	}, [sculptActive]); // eslint-disable-line react-hooks/exhaustive-deps

	// Send parameter updates when sculpt is active
	useEffect(() => {
		if (sculptActive) {
			sendToIframe({
				type: "terrain-painter-sculpt-update",
				brushType: sculptBrushType,
				brushSize: sculptBrushSize,
				brushStrength: sculptBrushStrength,
				brushFalloff: sculptBrushFalloff,
			});
		}
	}, [sculptBrushType, sculptBrushSize, sculptBrushStrength, sculptBrushFalloff, sculptActive]); // eslint-disable-line react-hooks/exhaustive-deps

	// Auto-repaint after terrain generation — listen for bridge callback
	const layersRef = useRef(layers);
	layersRef.current = layers;
	useEffect(() => {
		function handleTerrainGenerated(e: MessageEvent) {
			if (e.data?.type === "terrain-painter-terrain-generated") {
				console.log("[TerrainPainterPanel] Terrain generated, auto-repainting...");
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
		window.addEventListener("message", handleTerrainGenerated);
		return () => window.removeEventListener("message", handleTerrainGenerated);
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
	}, [sendToIframe, layers]);

	const sendGenerateTerrain = useCallback(() => {
		sendToIframe({
			type: "terrain-painter-generate-terrain",
			settings,
		});
	}, [sendToIframe, settings]);

	// ===== Layer actions =====

	const addLayer = useCallback(() => {
		setLayers((prev) => {
			const newLayer: LayerData = {
				name: `Layer ${prev.length + 1}`,
				enabled: true,
				previewColor: "#808080",
				diffuseUrl: "",
				tileSize: 4,
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
		(index: number, field: keyof LayerData, value: string) => {
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
						currentLayer={currentLayer}
						onAddModifier={addModifier}
						onRemoveModifier={removeModifier}
						onUpdateModifier={updateModifier}
						onUpdateModifierParam={updateModifierParam}
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
						{/* Brush Type */}
						<div>
							<label className="text-[10px] text-white/50 uppercase tracking-wider mb-2 block">Brush Tool</label>
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
	currentLayer,
	onAddModifier,
	onRemoveModifier,
	onUpdateModifier,
	onUpdateModifierParam,
}: {
	layers: LayerData[];
	selectedLayer: number;
	onSelectLayer: (i: number) => void;
	onToggleLayer: (i: number) => void;
	onRemoveLayer: (i: number) => void;
	onAddLayer: () => void;
	onUpdateLayerField: (i: number, field: keyof LayerData, value: string) => void;
	showHeatmap: boolean;
	onToggleHeatmap: () => void;
	currentLayer: LayerData | undefined;
	onAddModifier: (type: ModifierType) => void;
	onRemoveModifier: (i: number) => void;
	onUpdateModifier: (i: number, updates: Partial<ModifierData>) => void;
	onUpdateModifierParam: (i: number, key: string, value: number | string | boolean) => void;
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

			{/* Texture picker for selected layer */}
			{currentLayer && (
				<TerrainTexturePicker
					currentUrl={currentLayer.diffuseUrl}
					onSelect={(url, displayName) => {
						onUpdateLayerField(selectedLayer, "diffuseUrl", url);
						if (displayName) onUpdateLayerField(selectedLayer, "name", displayName);
					}}
				/>
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
	return (
		<div className="p-3 flex flex-col gap-3">
			<div className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">
				Terrain
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
				max={50}
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
