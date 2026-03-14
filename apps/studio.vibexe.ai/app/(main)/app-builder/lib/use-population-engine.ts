/**
 * usePopulationEngine — React hook for driving terrain population
 *
 * Manages the PopulationEngine instance, handles terrain data extraction
 * from the iframe, and sends spawn/clear commands through the WB bridge.
 *
 * The flow:
 * 1. Panel requests terrain data from iframe → wb-get-terrain-data
 * 2. Iframe responds with heightmap → wb-terrain-data
 * 3. Engine computes positions (Poisson + heatmap filtering)
 * 4. Panel sends positions to iframe → wb-populate-spawn
 * 5. Bridge loads models and places them in the scene
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
	PopulationEngine,
	type PopulationLayer,
	type PopulationResult,
	type TerrainInfo,
	DEFAULT_POPULATION_LAYER,
} from "@vibexe-ai/vibexe-engine";
import { resolveBlueprint, resolvePresetById } from "./blueprint-resolver";
import { loadTextureAsHeatmap } from "./heatmap-textures";

export interface UsePopulationEngineOptions {
	sendToIframe: (msg: Record<string, unknown>) => void;
}

export interface PopulationEngineState {
	/** All configured layers */
	layers: PopulationLayer[];
	/** Whether terrain data has been loaded from iframe */
	terrainLoaded: boolean;
	/** Currently populating layer ID (null if idle) */
	populatingLayerId: string | null;
	/** Last population results per layer */
	results: Map<string, PopulationResult>;
	/** Spawn progress for active population */
	spawnProgress: { spawned: number; total: number } | null;
	/** Whether heatmap preview overlay is showing (layer ID or null) */
	heatmapPreviewLayerId: string | null;
	/** Whether point preview is showing (layer ID or null) */
	pointPreviewLayerId: string | null;
	/** Number of preview points currently shown */
	previewPointCount: number;
}

let _layerIdCounter = 1;
function generateLayerId(): string {
	return `pop_layer_${_layerIdCounter++}_${Date.now().toString(36)}`;
}

function generateEntryId(): string {
	return `pop_entry_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function usePopulationEngine({ sendToIframe }: UsePopulationEngineOptions) {
	const engineRef = useRef<PopulationEngine>(new PopulationEngine());
	const [state, setState] = useState<PopulationEngineState>({
		layers: [],
		terrainLoaded: false,
		populatingLayerId: null,
		results: new Map(),
		spawnProgress: null,
		heatmapPreviewLayerId: null,
		pointPreviewLayerId: null,
		previewPointCount: 0,
	});

	// Track whether we've loaded terrain at least once, for auto-refresh
	const hasLoadedOnce = useRef(false);

	// Listen for messages from iframe
	useEffect(() => {
		function handleMessage(ev: MessageEvent) {
			const msg = ev.data;
			if (!msg || typeof msg !== "object" || !msg.type) return;

			if (msg.type === "wb-terrain-data") {
				if (msg.error) {
					console.warn("[Population] No terrain found in scene");
					return;
				}
				const terrainInfo: TerrainInfo = {
					heightData: new Float32Array(msg.heightData),
					resolution: msg.resolution,
					bounds: msg.bounds,
				};
				engineRef.current.setTerrainData(terrainInfo);
				hasLoadedOnce.current = true;
				setState((s) => ({ ...s, terrainLoaded: true }));
				console.log(
					`[Population] Terrain loaded: ${msg.resolution}x${msg.resolution}, bounds:`,
					msg.bounds,
				);
			}

			// Auto-refresh terrain data when terrain is modified
			// (only if we've loaded it at least once — don't spam requests on every repaint)
			if (msg.type === "terrain-painter-repainted" && hasLoadedOnce.current) {
				console.log("[Population] Terrain changed — auto-refreshing heightmap");
				sendToIframe({ type: "wb-get-terrain-data" });
			}

			if (msg.type === "wb-populate-complete") {
				setState((s) => ({
					...s,
					populatingLayerId: null,
					spawnProgress: null,
				}));
			}

			if (msg.type === "wb-populate-progress") {
				setState((s) => ({
					...s,
					spawnProgress: { spawned: msg.spawned, total: msg.total },
				}));
			}

			if (msg.type === "wb-populate-preview-ready") {
				setState((s) => ({
					...s,
					previewPointCount: msg.count || 0,
				}));
			}

			// AI-triggered population via blueprint
			if (msg.type === "wb-populate-blueprint") {
				const blueprint = msg.blueprint;
				if (!blueprint) return;

				// Resolve blueprint to layers
				const resolvedLayers = blueprint.biome && !blueprint.layers?.length
					? resolvePresetById(blueprint.biome) || []
					: resolveBlueprint(blueprint);

				if (resolvedLayers.length === 0) {
					console.warn("[Population] Blueprint resolved to 0 layers");
					return;
				}

				// Clear existing, set new layers
				engineRef.current.clearAll();
				sendToIframe({ type: "wb-populate-clear-all" });
				for (const layer of resolvedLayers) {
					engineRef.current.setLayer(layer);
				}
				setState((s) => ({ ...s, layers: engineRef.current.getLayers() }));

				// If terrain is loaded, auto-populate all layers
				if (engineRef.current.getTerrainBounds()) {
					const seed = blueprint.seed ?? Math.floor(Math.random() * 99999);
					for (const layer of resolvedLayers) {
						const result = engineRef.current.populateLayer(layer.id, seed);
						if (result.objects.length > 0) {
							sendToIframe({
								type: "wb-populate-spawn",
								layerId: layer.id,
								objects: result.objects.map((obj) => ({
									id: obj.id,
									modelPath: obj.modelPath,
									packId: obj.packId,
									position: obj.position,
									rotation: obj.rotation,
									scale: obj.scale,
									entryId: obj.entryId,
								})),
							});
						}
					}
					setState((s) => ({ ...s, layers: engineRef.current.getLayers() }));
				}
				console.log(`[Population] Blueprint applied: ${resolvedLayers.length} layers`);
			}
		}

		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [sendToIframe]);

	/** Request terrain data from the iframe */
	const requestTerrainData = useCallback(() => {
		sendToIframe({ type: "wb-get-terrain-data" });
	}, [sendToIframe]);

	/** Add a new empty layer */
	const addLayer = useCallback((): PopulationLayer => {
		const layer: PopulationLayer = {
			...DEFAULT_POPULATION_LAYER,
			id: generateLayerId(),
		};
		engineRef.current.setLayer(layer);
		setState((s) => ({ ...s, layers: engineRef.current.getLayers() }));
		return layer;
	}, []);

	/** Update an existing layer */
	const updateLayer = useCallback((layer: PopulationLayer) => {
		engineRef.current.setLayer(layer);
		engineRef.current.invalidateHeatmap(layer.id);
		setState((s) => ({ ...s, layers: engineRef.current.getLayers() }));
	}, []);

	/** Remove a layer and its spawned objects + any active preview */
	const removeLayer = useCallback(
		(layerId: string) => {
			engineRef.current.removeLayer(layerId);
			sendToIframe({ type: "wb-populate-clear", layerId });
			setState((s) => {
				const updates: Partial<PopulationEngineState> = { layers: engineRef.current.getLayers() };
				// Clean up previews if this layer had them
				if (s.heatmapPreviewLayerId === layerId) {
					sendToIframe({ type: "wb-populate-heatmap-hide" });
					updates.heatmapPreviewLayerId = null;
				}
				if (s.pointPreviewLayerId === layerId) {
					sendToIframe({ type: "wb-populate-preview-clear" });
					updates.pointPreviewLayerId = null;
					updates.previewPointCount = 0;
				}
				return { ...s, ...updates };
			});
		},
		[sendToIframe],
	);

	/** Populate a single layer — compute positions then send to bridge */
	const populateLayer = useCallback(
		(layerId: string, seed?: number) => {
			if (!state.terrainLoaded) {
				console.warn("[Population] No terrain data — call requestTerrainData first");
				return null;
			}

			// Clear existing objects for this layer in iframe
			sendToIframe({ type: "wb-populate-clear", layerId });

			// Run the engine
			const result = engineRef.current.populateLayer(layerId, seed);

			if (result.objects.length > 0) {
				// Send spawn commands to bridge
				setState((s) => ({
					...s,
					populatingLayerId: layerId,
					spawnProgress: { spawned: 0, total: result.objects.length },
				}));

				sendToIframe({
					type: "wb-populate-spawn",
					layerId,
					objects: result.objects.map((obj) => ({
						id: obj.id,
						modelPath: obj.modelPath,
						packId: obj.packId,
						position: obj.position,
						rotation: obj.rotation,
						scale: obj.scale,
						entryId: obj.entryId,
					})),
				});
			}

			// Update results
			setState((s) => {
				const newResults = new Map(s.results);
				newResults.set(layerId, result);
				return { ...s, results: newResults, layers: engineRef.current.getLayers() };
			});

			return result;
		},
		[state.terrainLoaded, sendToIframe],
	);

	/** Populate all enabled layers */
	const populateAll = useCallback(
		(seed?: number) => {
			const layers = engineRef.current.getLayers();
			const results: PopulationResult[] = [];
			for (const layer of layers) {
				if (layer.enabled) {
					const r = populateLayer(layer.id, seed);
					if (r) results.push(r);
				}
			}
			return results;
		},
		[populateLayer],
	);

	/** Clear population objects for a layer + its previews */
	const clearLayer = useCallback(
		(layerId: string) => {
			engineRef.current.clearLayer(layerId);
			sendToIframe({ type: "wb-populate-clear", layerId });
			setState((s) => {
				const newResults = new Map(s.results);
				newResults.delete(layerId);
				const updates: Partial<PopulationEngineState> = { results: newResults };
				if (s.heatmapPreviewLayerId === layerId) {
					sendToIframe({ type: "wb-populate-heatmap-hide" });
					updates.heatmapPreviewLayerId = null;
				}
				if (s.pointPreviewLayerId === layerId) {
					sendToIframe({ type: "wb-populate-preview-clear" });
					updates.pointPreviewLayerId = null;
					updates.previewPointCount = 0;
				}
				return { ...s, ...updates };
			});
		},
		[sendToIframe],
	);

	/** Clear all population objects + all previews */
	const clearAll = useCallback(() => {
		engineRef.current.clearAll();
		sendToIframe({ type: "wb-populate-clear-all" });
		sendToIframe({ type: "wb-populate-preview-clear" });
		setState((s) => ({
			...s,
			results: new Map(),
			populatingLayerId: null,
			spawnProgress: null,
			heatmapPreviewLayerId: null,
			pointPreviewLayerId: null,
			previewPointCount: 0,
		}));
	}, [sendToIframe]);

	/** Show heatmap overlay for a layer (toggle — call again to hide) */
	const previewHeatmap = useCallback(
		(layerId: string) => {
			// Toggle off if already showing this layer
			if (state.heatmapPreviewLayerId === layerId) {
				sendToIframe({ type: "wb-populate-heatmap-hide" });
				setState((s) => ({ ...s, heatmapPreviewLayerId: null }));
				return;
			}

			if (!state.terrainLoaded) {
				console.warn("[Population] No terrain data for heatmap preview");
				return;
			}

			const heatmap = engineRef.current.computeHeatmap(layerId);
			if (!heatmap) return;

			const bounds = engineRef.current.getTerrainBounds();
			if (!bounds) return;

			sendToIframe({
				type: "wb-populate-heatmap-preview",
				heatmapData: Array.from(heatmap.data as Float32Array),
				width: heatmap.width,
				height: heatmap.height,
				bounds,
			});
			setState((s) => ({ ...s, heatmapPreviewLayerId: layerId }));
		},
		[state.terrainLoaded, state.heatmapPreviewLayerId, sendToIframe],
	);

	/** Show point preview for a layer (toggle — call again to hide) */
	const previewPoints = useCallback(
		(layerId: string, seed?: number) => {
			// Toggle off if already showing this layer
			if (state.pointPreviewLayerId === layerId) {
				sendToIframe({ type: "wb-populate-preview-clear" });
				setState((s) => ({ ...s, pointPreviewLayerId: null, previewPointCount: 0 }));
				return;
			}

			if (!state.terrainLoaded) {
				console.warn("[Population] No terrain data for point preview");
				return;
			}

			// Dry-run: compute positions without storing objects or triggering spawns
			const result = engineRef.current.dryRunLayer(layerId, seed);
			if (result.objects.length === 0) {
				console.log("[Population] Preview: 0 points computed");
				return;
			}

			// Send only positions (no GLTF loading — just dots)
			sendToIframe({
				type: "wb-populate-preview-points",
				layerId,
				points: result.objects.map((o) => o.position),
			});
			setState((s) => ({
				...s,
				pointPreviewLayerId: layerId,
				previewPointCount: result.objects.length,
			}));
		},
		[state.terrainLoaded, state.pointPreviewLayerId, sendToIframe],
	);

	/** Clear all preview overlays (heatmap + points) */
	const clearPreview = useCallback(() => {
		sendToIframe({ type: "wb-populate-preview-clear" });
		setState((s) => ({
			...s,
			heatmapPreviewLayerId: null,
			pointPreviewLayerId: null,
			previewPointCount: 0,
		}));
	}, [sendToIframe]);

	/** Load a custom heatmap texture for a layer from URL */
	const loadCustomHeatmapForLayer = useCallback(
		async (layerId: string, textureUrl: string) => {
			try {
				console.log(`[Population] Loading custom heatmap: ${textureUrl}`);
				const heatmapData = await loadTextureAsHeatmap(textureUrl);
				engineRef.current.setCustomHeatmap(layerId, heatmapData);
				engineRef.current.invalidateHeatmap(layerId);
				// Re-set the cached heatmap (invalidateHeatmap clears it, so set again)
				engineRef.current.setCustomHeatmap(layerId, heatmapData);
				console.log(`[Population] Custom heatmap loaded: ${heatmapData.width}x${heatmapData.height}`);
			} catch (err) {
				console.error(`[Population] Failed to load heatmap texture: ${textureUrl}`, err);
			}
		},
		[],
	);

	// Auto-load custom heatmap textures when layers change
	useEffect(() => {
		for (const layer of state.layers) {
			if (layer.heatmapSource === "custom" && layer.heatmapTextureUrl) {
				loadCustomHeatmapForLayer(layer.id, layer.heatmapTextureUrl);
			}
		}
	}, [state.layers, loadCustomHeatmapForLayer]);

	/** Serialize state for persistence */
	const toJSON = useCallback(() => {
		return engineRef.current.toJSON();
	}, []);

	/** Restore from saved state */
	const fromJSON = useCallback(
		(data: Parameters<PopulationEngine["fromJSON"]>[0]) => {
			engineRef.current.fromJSON(data);
			setState((s) => ({ ...s, layers: engineRef.current.getLayers() }));
		},
		[],
	);

	return {
		...state,
		engine: engineRef.current,
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
		loadCustomHeatmapForLayer,
		toJSON,
		fromJSON,
		generateEntryId,
	};
}
