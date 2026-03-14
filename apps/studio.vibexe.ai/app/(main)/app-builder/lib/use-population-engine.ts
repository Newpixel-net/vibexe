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
	});

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
				setState((s) => ({ ...s, terrainLoaded: true }));
				console.log(
					`[Population] Terrain loaded: ${msg.resolution}x${msg.resolution}, bounds:`,
					msg.bounds,
				);
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
		}

		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, []);

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

	/** Remove a layer and its spawned objects */
	const removeLayer = useCallback(
		(layerId: string) => {
			engineRef.current.removeLayer(layerId);
			sendToIframe({ type: "wb-populate-clear", layerId });
			setState((s) => ({ ...s, layers: engineRef.current.getLayers() }));
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

	/** Clear population objects for a layer */
	const clearLayer = useCallback(
		(layerId: string) => {
			engineRef.current.clearLayer(layerId);
			sendToIframe({ type: "wb-populate-clear", layerId });
			setState((s) => {
				const newResults = new Map(s.results);
				newResults.delete(layerId);
				return { ...s, results: newResults };
			});
		},
		[sendToIframe],
	);

	/** Clear all population objects */
	const clearAll = useCallback(() => {
		engineRef.current.clearAll();
		sendToIframe({ type: "wb-populate-clear-all" });
		setState((s) => ({
			...s,
			results: new Map(),
			populatingLayerId: null,
			spawnProgress: null,
		}));
	}, [sendToIframe]);

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
		toJSON,
		fromJSON,
		generateEntryId,
	};
}
