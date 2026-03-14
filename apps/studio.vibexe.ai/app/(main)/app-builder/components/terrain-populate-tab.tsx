"use client";

/**
 * TerrainPopulateTab — Population system UI for terrain painter
 *
 * Provides layer-based terrain population with:
 * - Population layers (each with its own heatmap rules + object entries)
 * - Auto-heatmap rules (height, slope, curvature, noise, splatmap)
 * - Tree entries (large objects with Poisson spacing + scale variation)
 * - Detail entries (small objects with clustering)
 * - Biome presets (Forest, Desert, Alpine, etc.)
 * - Populate / Clear / Preview controls
 */

import {
	ChevronDown,
	ChevronRight,
	Eye,
	EyeOff,
	Layers,
	Map,
	Plus,
	Play,
	Trash2,
	TreePine,
	Flower2,
	Sparkles,
	CircleDot,
} from "lucide-react";
import { useCallback, useState } from "react";
import {
	type PopulationLayer,
	type TreePopulationEntry,
	type DetailPopulationEntry,
	type AutoHeatmapRule,
	type HeatmapSource,
	DEFAULT_POPULATION_LAYER,
	DEFAULT_TREE_ENTRY,
	DEFAULT_DETAIL_ENTRY,
	DEFAULT_AUTO_RULE,
	BIOME_PRESETS,
} from "@vibexe-ai/vibexe-engine";
import type { usePopulationEngine } from "../lib/use-population-engine";
import { resolvePresetById } from "../lib/blueprint-resolver";
import { SharedAssetBrowser, toWBItem } from "./shared-asset-browser";
import type { AssetLibraryItem } from "../lib/asset-library-data";

// ===== Props =====

interface TerrainPopulateTabProps {
	population: ReturnType<typeof usePopulationEngine>;
}

// ===== Helpers =====

function generateId(): string {
	return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

const HEATMAP_SOURCE_LABELS: Record<HeatmapSource, string> = {
	height: "Height",
	slope: "Slope",
	curvature: "Curvature",
	noise: "Noise",
	splatmap: "Splatmap Layer",
};

const DENSITY_LABELS = { sparse: "Sparse (10m)", medium: "Medium (6m)", dense: "Dense (3m)", "very-dense": "Very Dense (1.5m)" };

// ===== Component =====

export function TerrainPopulateTab({ population }: TerrainPopulateTabProps) {
	const {
		layers,
		terrainLoaded,
		populatingLayerId,
		results,
		spawnProgress,
		heatmapPreviewLayerId,
		pointPreviewLayerId,
		previewPointCount,
		requestTerrainData,
		addLayer,
		updateLayer,
		removeLayer,
		populateLayer,
		populateAll,
		clearLayer,
		clearAll,
		previewHeatmap,
		previewPoints,
		clearPreview,
	} = population;

	const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
	const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["rules", "trees", "details"]));
	const [showAssetPicker, setShowAssetPicker] = useState<{ layerId: string; type: "tree" | "detail" } | null>(null);
	const [seed, setSeed] = useState<number>(42);

	const selectedLayer = layers.find((l) => l.id === selectedLayerId) || null;

	const toggleSection = useCallback((section: string) => {
		setExpandedSections((s) => {
			const next = new Set(s);
			if (next.has(section)) next.delete(section);
			else next.add(section);
			return next;
		});
	}, []);

	// Update a field on the selected layer
	const updateField = useCallback(
		<K extends keyof PopulationLayer>(field: K, value: PopulationLayer[K]) => {
			if (!selectedLayer) return;
			updateLayer({ ...selectedLayer, [field]: value });
		},
		[selectedLayer, updateLayer],
	);

	// Add a rule to the selected layer
	const addRule = useCallback(() => {
		if (!selectedLayer) return;
		const rule: AutoHeatmapRule = { ...DEFAULT_AUTO_RULE, id: generateId() };
		updateLayer({ ...selectedLayer, autoRules: [...selectedLayer.autoRules, rule] });
	}, [selectedLayer, updateLayer]);

	const updateRule = useCallback(
		(ruleId: string, updates: Partial<AutoHeatmapRule>) => {
			if (!selectedLayer) return;
			const newRules = selectedLayer.autoRules.map((r) =>
				r.id === ruleId ? { ...r, ...updates } : r,
			);
			updateLayer({ ...selectedLayer, autoRules: newRules });
		},
		[selectedLayer, updateLayer],
	);

	const removeRule = useCallback(
		(ruleId: string) => {
			if (!selectedLayer) return;
			updateLayer({ ...selectedLayer, autoRules: selectedLayer.autoRules.filter((r) => r.id !== ruleId) });
		},
		[selectedLayer, updateLayer],
	);

	// Add asset from picker
	const handleAssetPicked = useCallback(
		(item: AssetLibraryItem, color: string) => {
			if (!showAssetPicker || !selectedLayer) return;
			const wbItem = toWBItem(item, color);

			if (showAssetPicker.type === "tree") {
				const entry: TreePopulationEntry = {
					...DEFAULT_TREE_ENTRY,
					id: generateId(),
					assetId: item.id,
					displayName: item.displayName,
					modelPath: wbItem.modelPath,
					packId: wbItem.pack,
				};
				updateLayer({ ...selectedLayer, trees: [...selectedLayer.trees, entry] });
			} else {
				const entry: DetailPopulationEntry = {
					...DEFAULT_DETAIL_ENTRY,
					id: generateId(),
					assetId: item.id,
					displayName: item.displayName,
					modelPath: wbItem.modelPath,
					packId: wbItem.pack,
				};
				updateLayer({ ...selectedLayer, details: [...selectedLayer.details, entry] });
			}

			setShowAssetPicker(null);
		},
		[showAssetPicker, selectedLayer, updateLayer],
	);

	const removeTree = useCallback(
		(treeId: string) => {
			if (!selectedLayer) return;
			updateLayer({ ...selectedLayer, trees: selectedLayer.trees.filter((t) => t.id !== treeId) });
		},
		[selectedLayer, updateLayer],
	);

	const updateTree = useCallback(
		(treeId: string, updates: Partial<TreePopulationEntry>) => {
			if (!selectedLayer) return;
			const newTrees = selectedLayer.trees.map((t) =>
				t.id === treeId ? { ...t, ...updates } : t,
			);
			updateLayer({ ...selectedLayer, trees: newTrees });
		},
		[selectedLayer, updateLayer],
	);

	const removeDetail = useCallback(
		(detailId: string) => {
			if (!selectedLayer) return;
			updateLayer({ ...selectedLayer, details: selectedLayer.details.filter((d) => d.id !== detailId) });
		},
		[selectedLayer, updateLayer],
	);

	const updateDetail = useCallback(
		(detailId: string, updates: Partial<DetailPopulationEntry>) => {
			if (!selectedLayer) return;
			const newDetails = selectedLayer.details.map((d) =>
				d.id === detailId ? { ...d, ...updates } : d,
			);
			updateLayer({ ...selectedLayer, details: newDetails });
		},
		[selectedLayer, updateLayer],
	);

	// Apply biome preset with auto-resolved assets
	const applyPreset = useCallback(
		(presetId: string) => {
			// Clear existing layers
			for (const l of layers) removeLayer(l.id);

			// Resolve preset: matches keyword slots to actual catalog assets
			const resolved = resolvePresetById(presetId);
			if (!resolved || resolved.length === 0) {
				console.warn("[Population] No assets resolved for preset:", presetId);
				return;
			}

			// Set resolved layers on engine
			for (const layer of resolved) {
				population.engine.setLayer(layer);
			}

			// Force state refresh
			const newLayers = population.engine.getLayers();
			if (newLayers.length > 0) setSelectedLayerId(newLayers[0].id);
		},
		[layers, removeLayer, population.engine],
	);

	// Asset picker modal
	if (showAssetPicker) {
		return (
			<div className="flex flex-col flex-1 min-h-0">
				<div className="flex items-center justify-between px-2 py-1.5 border-b border-white/10">
					<span className="text-[10px] text-white/70">
						Pick {showAssetPicker.type === "tree" ? "Tree" : "Detail"} Asset
					</span>
					<button
						type="button"
						onClick={() => setShowAssetPicker(null)}
						className="text-[9px] px-2 py-0.5 rounded bg-white/10 text-white/60 hover:bg-white/20"
					>
						Cancel
					</button>
				</div>
				<SharedAssetBrowser
					onSelect={handleAssetPicked}
					selectedItemId={null}
					columns={3}
					highlightColor="emerald"
					showPackFilter
				/>
			</div>
		);
	}

	return (
		<div className="flex flex-col flex-1 min-h-0 p-2 space-y-2">
			{/* Terrain Data Status */}
			{!terrainLoaded && (
				<button
					type="button"
					onClick={requestTerrainData}
					className="w-full py-2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-medium hover:bg-amber-500/30 transition-colors"
				>
					Load Terrain Data
				</button>
			)}
			{terrainLoaded && (
				<div className="text-[9px] text-green-400/70 flex items-center gap-1">
					<Eye className="w-2.5 h-2.5" /> Terrain data loaded
				</div>
			)}

			{/* Biome Presets */}
			<div>
				<label className="text-[9px] text-white/40 uppercase tracking-wider mb-1 block">Biome Presets</label>
				<div className="flex gap-1 flex-wrap">
					{BIOME_PRESETS.map((p) => (
						<button
							key={p.id}
							type="button"
							onClick={() => applyPreset(p.id)}
							className="px-2 py-0.5 text-[9px] rounded-full bg-white/[0.06] text-white/50 hover:bg-emerald-500/20 hover:text-emerald-300 transition-colors"
							title={p.description}
						>
							{p.name}
						</button>
					))}
				</div>
			</div>

			{/* Layer List */}
			<div>
				<div className="flex items-center justify-between mb-1">
					<label className="text-[9px] text-white/40 uppercase tracking-wider">Population Layers</label>
					<button
						type="button"
						onClick={() => {
							const l = addLayer();
							setSelectedLayerId(l.id);
						}}
						className="p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-white/70"
						title="Add layer"
					>
						<Plus className="w-3 h-3" />
					</button>
				</div>

				<div className="space-y-0.5">
					{layers.map((layer) => {
						const result = results.get(layer.id);
						const objCount = result?.objects.length || 0;
						return (
							<button
								key={layer.id}
								type="button"
								onClick={() => setSelectedLayerId(layer.id)}
								className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-left transition-colors ${
									selectedLayerId === layer.id
										? "bg-emerald-500/20 ring-1 ring-emerald-500/30"
										: "bg-white/[0.04] hover:bg-white/[0.08]"
								}`}
							>
								<Layers className="w-3 h-3 text-emerald-400/50 flex-shrink-0" />
								<span className="text-[10px] text-white/70 flex-1 truncate">{layer.name}</span>
								{objCount > 0 && (
									<span className="text-[8px] text-emerald-400/50">{objCount}</span>
								)}
								{!layer.enabled && (
									<span className="text-[8px] text-red-400/50">OFF</span>
								)}
							</button>
						);
					})}
					{layers.length === 0 && (
						<div className="text-[9px] text-white/20 text-center py-3">
							No layers — add one or apply a preset
						</div>
					)}
				</div>
			</div>

			{/* Selected Layer Editor */}
			{selectedLayer && (
				<div className="flex-1 overflow-y-auto space-y-2 min-h-0">
					{/* Layer Header */}
					<div className="flex items-center gap-1.5">
						<input
							type="text"
							value={selectedLayer.name}
							onChange={(e) => updateField("name", e.target.value)}
							className="flex-1 bg-white/[0.06] text-[10px] text-white/80 px-2 py-1 rounded outline-none"
						/>
						<button
							type="button"
							onClick={() => updateField("enabled", !selectedLayer.enabled)}
							className={`p-1 rounded text-[9px] ${selectedLayer.enabled ? "text-green-400" : "text-red-400/50"}`}
							title={selectedLayer.enabled ? "Disable" : "Enable"}
						>
							<Eye className="w-3 h-3" />
						</button>
						<button
							type="button"
							onClick={() => {
								removeLayer(selectedLayer.id);
								setSelectedLayerId(null);
							}}
							className="p-1 rounded text-red-400/40 hover:text-red-400 hover:bg-red-500/10"
							title="Delete layer"
						>
							<Trash2 className="w-3 h-3" />
						</button>
					</div>

					{/* Threshold Sliders */}
					<div className="grid grid-cols-2 gap-2">
						<div>
							<label className="text-[8px] text-white/30">Min Threshold</label>
							<input
								type="range"
								min={0}
								max={1}
								step={0.05}
								value={selectedLayer.minThreshold}
								onChange={(e) => updateField("minThreshold", Number(e.target.value))}
								className="w-full h-1 accent-emerald-500"
							/>
							<span className="text-[8px] text-white/40">{selectedLayer.minThreshold.toFixed(2)}</span>
						</div>
						<div>
							<label className="text-[8px] text-white/30">Max Threshold</label>
							<input
								type="range"
								min={0}
								max={1}
								step={0.05}
								value={selectedLayer.maxThreshold}
								onChange={(e) => updateField("maxThreshold", Number(e.target.value))}
								className="w-full h-1 accent-emerald-500"
							/>
							<span className="text-[8px] text-white/40">{selectedLayer.maxThreshold.toFixed(2)}</span>
						</div>
					</div>

					{/* Additive Mode */}
					<label className="flex items-center gap-1.5 text-[9px] text-white/50">
						<input
							type="checkbox"
							checked={selectedLayer.additiveMode}
							onChange={(e) => updateField("additiveMode", e.target.checked)}
							className="accent-emerald-500"
						/>
						Additive mode (keep existing objects)
					</label>

					{/* Auto-Heatmap Rules */}
					<CollapsibleSection
						title="Heatmap Rules"
						icon={<Sparkles className="w-3 h-3" />}
						expanded={expandedSections.has("rules")}
						onToggle={() => toggleSection("rules")}
						count={selectedLayer.autoRules.length}
					>
						{selectedLayer.autoRules.map((rule) => (
							<div key={rule.id} className="bg-white/[0.03] rounded p-1.5 space-y-1">
								<div className="flex items-center gap-1">
									<select
										value={rule.source}
										onChange={(e) => updateRule(rule.id, { source: e.target.value as HeatmapSource })}
										className="flex-1 bg-white/[0.06] text-[9px] text-white/70 rounded px-1 py-0.5 outline-none"
									>
										{Object.entries(HEATMAP_SOURCE_LABELS).map(([k, v]) => (
											<option key={k} value={k}>{v}</option>
										))}
									</select>
									<select
										value={rule.blendMode}
										onChange={(e) => updateRule(rule.id, { blendMode: e.target.value as AutoHeatmapRule["blendMode"] })}
										className="bg-white/[0.06] text-[9px] text-white/70 rounded px-1 py-0.5 outline-none"
									>
										<option value="multiply">Multiply</option>
										<option value="add">Add</option>
										<option value="min">Min</option>
										<option value="max">Max</option>
									</select>
									<button type="button" onClick={() => removeRule(rule.id)} className="text-red-400/40 hover:text-red-400">
										<Trash2 className="w-2.5 h-2.5" />
									</button>
								</div>
								<div className="flex items-center gap-2">
									<label className="flex items-center gap-1 text-[8px] text-white/40">
										<input
											type="checkbox"
											checked={rule.invert}
											onChange={(e) => updateRule(rule.id, { invert: e.target.checked })}
											className="accent-emerald-500"
										/>
										Invert
									</label>
									<div className="flex-1 flex items-center gap-1">
										<span className="text-[8px] text-white/30">Range:</span>
										<input
											type="number"
											min={0}
											max={1}
											step={0.05}
											value={rule.inputMin}
											onChange={(e) => updateRule(rule.id, { inputMin: Number(e.target.value) })}
											className="w-10 bg-white/[0.06] text-[8px] text-white/60 rounded px-1 py-0.5 outline-none"
										/>
										<span className="text-[8px] text-white/20">-</span>
										<input
											type="number"
											min={0}
											max={1}
											step={0.05}
											value={rule.inputMax}
											onChange={(e) => updateRule(rule.id, { inputMax: Number(e.target.value) })}
											className="w-10 bg-white/[0.06] text-[8px] text-white/60 rounded px-1 py-0.5 outline-none"
										/>
									</div>
								</div>
							</div>
						))}
						<button
							type="button"
							onClick={addRule}
							className="w-full py-1 rounded bg-white/[0.04] text-[9px] text-white/40 hover:bg-white/[0.08] hover:text-white/60 flex items-center justify-center gap-1"
						>
							<Plus className="w-2.5 h-2.5" /> Add Rule
						</button>
					</CollapsibleSection>

					{/* Trees */}
					<CollapsibleSection
						title="Trees (Large Objects)"
						icon={<TreePine className="w-3 h-3" />}
						expanded={expandedSections.has("trees")}
						onToggle={() => toggleSection("trees")}
						count={selectedLayer.trees.length}
					>
						{selectedLayer.trees.map((tree) => (
							<div key={tree.id} className="bg-white/[0.03] rounded p-1.5 space-y-1">
								<div className="flex items-center gap-1">
									<span className="text-[9px] text-white/60 flex-1 truncate">{tree.displayName}</span>
									<button type="button" onClick={() => removeTree(tree.id)} className="text-red-400/40 hover:text-red-400">
										<Trash2 className="w-2.5 h-2.5" />
									</button>
								</div>
								<div className="grid grid-cols-3 gap-1">
									<div>
										<label className="text-[7px] text-white/25">Distance</label>
										<input
											type="number"
											min={0.5}
											step={0.5}
											value={tree.minimumDistance}
											onChange={(e) => updateTree(tree.id, { minimumDistance: Number(e.target.value) })}
											className="w-full bg-white/[0.06] text-[8px] text-white/60 rounded px-1 py-0.5 outline-none"
										/>
									</div>
									<div>
										<label className="text-[7px] text-white/25">Min Scale</label>
										<input
											type="number"
											min={0.1}
											step={0.1}
											value={tree.minScale}
											onChange={(e) => updateTree(tree.id, { minScale: Number(e.target.value) })}
											className="w-full bg-white/[0.06] text-[8px] text-white/60 rounded px-1 py-0.5 outline-none"
										/>
									</div>
									<div>
										<label className="text-[7px] text-white/25">Max Scale</label>
										<input
											type="number"
											min={0.1}
											step={0.1}
											value={tree.maxScale}
											onChange={(e) => updateTree(tree.id, { maxScale: Number(e.target.value) })}
											className="w-full bg-white/[0.06] text-[8px] text-white/60 rounded px-1 py-0.5 outline-none"
										/>
									</div>
								</div>
								<label className="flex items-center gap-1 text-[8px] text-white/40">
									<input
										type="checkbox"
										checked={tree.randomRotation}
										onChange={(e) => updateTree(tree.id, { randomRotation: e.target.checked })}
										className="accent-emerald-500"
									/>
									Random Rotation
								</label>
							</div>
						))}
						<button
							type="button"
							onClick={() => setShowAssetPicker({ layerId: selectedLayer.id, type: "tree" })}
							className="w-full py-1 rounded bg-white/[0.04] text-[9px] text-white/40 hover:bg-white/[0.08] hover:text-white/60 flex items-center justify-center gap-1"
						>
							<Plus className="w-2.5 h-2.5" /> Add Tree
						</button>
					</CollapsibleSection>

					{/* Details */}
					<CollapsibleSection
						title="Details (Small Objects)"
						icon={<Flower2 className="w-3 h-3" />}
						expanded={expandedSections.has("details")}
						onToggle={() => toggleSection("details")}
						count={selectedLayer.details.length}
					>
						{selectedLayer.details.map((detail) => (
							<div key={detail.id} className="bg-white/[0.03] rounded p-1.5 space-y-1">
								<div className="flex items-center gap-1">
									<span className="text-[9px] text-white/60 flex-1 truncate">{detail.displayName}</span>
									<button type="button" onClick={() => removeDetail(detail.id)} className="text-red-400/40 hover:text-red-400">
										<Trash2 className="w-2.5 h-2.5" />
									</button>
								</div>
								<div className="grid grid-cols-3 gap-1">
									<div>
										<label className="text-[7px] text-white/25">Distance</label>
										<input
											type="number"
											min={0.5}
											step={0.5}
											value={detail.minimumDistance}
											onChange={(e) => updateDetail(detail.id, { minimumDistance: Number(e.target.value) })}
											className="w-full bg-white/[0.06] text-[8px] text-white/60 rounded px-1 py-0.5 outline-none"
										/>
									</div>
									<div>
										<label className="text-[7px] text-white/25">Cluster R</label>
										<input
											type="number"
											min={0}
											step={0.5}
											value={detail.clusterRadius}
											onChange={(e) => updateDetail(detail.id, { clusterRadius: Number(e.target.value) })}
											className="w-full bg-white/[0.06] text-[8px] text-white/60 rounded px-1 py-0.5 outline-none"
										/>
									</div>
									<div>
										<label className="text-[7px] text-white/25">Cluster #</label>
										<input
											type="number"
											min={1}
											step={1}
											value={detail.clusterAmount}
											onChange={(e) => updateDetail(detail.id, { clusterAmount: Number(e.target.value) })}
											className="w-full bg-white/[0.06] text-[8px] text-white/60 rounded px-1 py-0.5 outline-none"
										/>
									</div>
								</div>
							</div>
						))}
						<button
							type="button"
							onClick={() => setShowAssetPicker({ layerId: selectedLayer.id, type: "detail" })}
							className="w-full py-1 rounded bg-white/[0.04] text-[9px] text-white/40 hover:bg-white/[0.08] hover:text-white/60 flex items-center justify-center gap-1"
						>
							<Plus className="w-2.5 h-2.5" /> Add Detail
						</button>
					</CollapsibleSection>
				</div>
			)}

			{/* Action Buttons */}
			<div className="flex-shrink-0 space-y-1 pt-1 border-t border-white/10">
				{/* Seed */}
				<div className="flex items-center gap-1.5">
					<label className="text-[8px] text-white/30">Seed:</label>
					<input
						type="number"
						value={seed}
						onChange={(e) => setSeed(Number(e.target.value))}
						className="w-16 bg-white/[0.06] text-[9px] text-white/60 rounded px-1.5 py-0.5 outline-none"
					/>
					<button
						type="button"
						onClick={() => setSeed(Math.floor(Math.random() * 99999))}
						className="text-[8px] text-white/30 hover:text-white/60"
					>
						Random
					</button>
				</div>

				{/* Preview buttons */}
				{selectedLayer && terrainLoaded && (
					<div className="flex gap-1">
						<button
							type="button"
							onClick={() => previewHeatmap(selectedLayer.id)}
							className={`flex-1 py-1.5 rounded text-[10px] font-medium flex items-center justify-center gap-1 transition-colors ${
								heatmapPreviewLayerId === selectedLayer.id
									? "bg-cyan-600/40 text-cyan-300 ring-1 ring-cyan-400/30"
									: "bg-white/[0.06] text-white/50 hover:bg-cyan-500/15 hover:text-cyan-300"
							}`}
						>
							<Map className="w-3 h-3" />
							{heatmapPreviewLayerId === selectedLayer.id ? "Hide Heatmap" : "Preview Heatmap"}
						</button>
						<button
							type="button"
							onClick={() => previewPoints(selectedLayer.id, seed)}
							className={`flex-1 py-1.5 rounded text-[10px] font-medium flex items-center justify-center gap-1 transition-colors ${
								pointPreviewLayerId === selectedLayer.id
									? "bg-cyan-600/40 text-cyan-300 ring-1 ring-cyan-400/30"
									: "bg-white/[0.06] text-white/50 hover:bg-cyan-500/15 hover:text-cyan-300"
							}`}
						>
							<CircleDot className="w-3 h-3" />
							{pointPreviewLayerId === selectedLayer.id ? "Hide Points" : "Preview Points"}
						</button>
					</div>
				)}
				{previewPointCount > 0 && pointPreviewLayerId && (
					<div className="text-[8px] text-cyan-400/60 text-center">
						{previewPointCount} preview points shown
					</div>
				)}

				{/* Populate buttons */}
				<div className="flex gap-1">
					{selectedLayer && (
						<button
							type="button"
							onClick={() => {
								clearPreview();
								populateLayer(selectedLayer.id, seed);
							}}
							disabled={!terrainLoaded || !!populatingLayerId}
							className="flex-1 py-1.5 rounded bg-emerald-600 text-white text-[10px] font-medium hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1"
						>
							<Play className="w-3 h-3" />
							{populatingLayerId === selectedLayer.id ? "Spawning..." : "Populate Layer"}
						</button>
					)}
					<button
						type="button"
						onClick={() => {
							clearPreview();
							populateAll(seed);
						}}
						disabled={!terrainLoaded || layers.length === 0 || !!populatingLayerId}
						className="flex-1 py-1.5 rounded bg-emerald-600/70 text-white text-[10px] font-medium hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1"
					>
						<Sparkles className="w-3 h-3" /> Populate All
					</button>
				</div>

				{/* Clear buttons */}
				<div className="flex gap-1">
					{selectedLayer && (
						<button
							type="button"
							onClick={() => clearLayer(selectedLayer.id)}
							className="flex-1 py-1 rounded bg-white/[0.04] text-[9px] text-white/40 hover:bg-red-500/10 hover:text-red-400"
						>
							Clear Layer
						</button>
					)}
					<button
						type="button"
						onClick={clearAll}
						className="flex-1 py-1 rounded bg-white/[0.04] text-[9px] text-white/40 hover:bg-red-500/10 hover:text-red-400"
					>
						Clear All
					</button>
				</div>

				{/* Progress */}
				{spawnProgress && (
					<div className="text-[8px] text-emerald-400/60 text-center">
						Spawning: {spawnProgress.spawned} / {spawnProgress.total}
					</div>
				)}

				{/* Results summary */}
				{results.size > 0 && !populatingLayerId && (
					<div className="text-[8px] text-white/30 text-center">
						{Array.from(results.values()).reduce((sum, r) => sum + r.objects.length, 0)} objects placed
						{" "}({Array.from(results.values()).reduce((sum, r) => sum + r.durationMs, 0).toFixed(0)}ms)
					</div>
				)}
			</div>
		</div>
	);
}

// ===== Collapsible Section =====

function CollapsibleSection({
	title,
	icon,
	expanded,
	onToggle,
	count,
	children,
}: {
	title: string;
	icon: React.ReactNode;
	expanded: boolean;
	onToggle: () => void;
	count: number;
	children: React.ReactNode;
}) {
	return (
		<div>
			<button
				type="button"
				onClick={onToggle}
				className="w-full flex items-center gap-1.5 py-1 text-left"
			>
				{expanded ? <ChevronDown className="w-2.5 h-2.5 text-white/30" /> : <ChevronRight className="w-2.5 h-2.5 text-white/30" />}
				{icon}
				<span className="text-[9px] text-white/50 flex-1">{title}</span>
				<span className="text-[8px] text-white/20">{count}</span>
			</button>
			{expanded && <div className="space-y-1 pl-4">{children}</div>}
		</div>
	);
}
