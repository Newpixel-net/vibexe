"use client";

/**
 * GameEditorAssetLibrary — Browse and spawn 500+ 3D models organized by category.
 * Wraps SharedAssetBrowser with game-editor-specific features:
 * - My Prefabs tab (custom saved prefabs)
 * - Active prefab indicator bar
 * - Double-click to quick-spawn at origin
 */

import { Box, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useGameEditor, type PrefabDefinition } from "../lib/game-editor-context";
import {
	withColor,
	type AssetLibraryItem,
} from "../lib/asset-library-data";
import { SharedAssetBrowser } from "./shared-asset-browser";

export function GameEditorAssetLibrary() {
	const { activePrefab, setActivePrefab, spawnObject, gameSettings, deletePrefab } = useGameEditor();
	const [showPrefabs, setShowPrefabs] = useState(false);

	// Custom prefabs from game settings
	const customPrefabs = gameSettings.customPrefabs || [];

	// Build PrefabDefinition from catalog item
	const buildPrefab = useCallback(
		(item: AssetLibraryItem, selectedColor: string): PrefabDefinition => {
			const args = item.hasColorVariants ? withColor(item, selectedColor) : item.factoryArgs;
			return {
				factory: item.factory,
				args,
				displayName: item.displayName,
				category: item.category,
			};
		},
		[],
	);

	const handleSelect = useCallback(
		(item: AssetLibraryItem, color: string) => {
			const prefab = buildPrefab(item, color);
			if (activePrefab?.displayName === prefab.displayName) {
				setActivePrefab(null);
			} else {
				setActivePrefab(prefab);
			}
		},
		[activePrefab, buildPrefab, setActivePrefab],
	);

	const handleDoubleClick = useCallback(
		(item: AssetLibraryItem, color: string) => {
			const prefab = buildPrefab(item, color);
			spawnObject(prefab.factory, { x: 0, y: 2, z: 0 }, prefab.args);
		},
		[buildPrefab, spawnObject],
	);

	// Selected item ID for highlight
	const selectedItemId = useMemo(() => {
		if (!activePrefab) return null;
		// Match by displayName since that's what we use for comparison
		return null; // SharedAssetBrowser handles highlight via selectedItemId prop
	}, [activePrefab]);

	return (
		<div className="flex flex-col flex-1 min-h-0">
			{/* My Prefabs section */}
			{showPrefabs && customPrefabs.length > 0 && (
				<div className="flex-shrink-0 max-h-48 overflow-y-auto scrollbar-thin px-2 pb-2 border-b border-white/[0.06]">
					<div className="grid grid-cols-2 gap-1">
						{customPrefabs.map((cp) => (
							<div key={cp.id} className="relative group">
								<button
									type="button"
									onClick={() => {
										spawnObject(cp.factory, { x: 0, y: 2, z: 0 }, {
											modelUrl: cp.modelUrl,
											textureUrl: cp.textureUrl,
											textureTileX: cp.textureTileX,
											textureTileY: cp.textureTileY,
										});
									}}
									className="w-full flex flex-col items-center gap-0.5 p-2 rounded bg-white/[0.03] hover:bg-blue-500/10 transition-all"
									title={`${cp.displayName}\nClick to spawn`}
								>
									<div className="w-full aspect-square rounded bg-blue-500/10 flex items-center justify-center">
										<Box className="w-5 h-5 text-blue-400/50" />
									</div>
									<span className="text-[8px] text-white/50 truncate w-full text-center leading-tight mt-0.5">
										{cp.displayName}
									</span>
								</button>
								<button
									type="button"
									onClick={() => deletePrefab(cp.id)}
									className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
									title="Delete prefab"
								>
									<X className="w-2.5 h-2.5" />
								</button>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Shared asset browser */}
			<SharedAssetBrowser
				onSelect={handleSelect}
				onDoubleClick={handleDoubleClick}
				selectedItemId={selectedItemId}
				columns={2}
				highlightColor="emerald"
				extraTabs={
					customPrefabs.length > 0 ? (
						<button
							type="button"
							onClick={() => setShowPrefabs(!showPrefabs)}
							className={`px-2 py-0.5 text-[9px] rounded-full whitespace-nowrap transition-colors ${
								showPrefabs
									? "bg-blue-500/20 text-blue-300"
									: "text-blue-400/40 hover:text-blue-400/70"
							}`}
						>
							My Prefabs
							<span className="ml-0.5 text-blue-400/30">{customPrefabs.length}</span>
						</button>
					) : undefined
				}
			/>

			{/* Active prefab indicator */}
			{activePrefab && (
				<div className="flex-shrink-0 px-2 py-1 bg-emerald-500/10 border-t border-emerald-500/20 flex items-center gap-1">
					<span className="flex-1 text-[9px] text-emerald-400 truncate">
						Active: {activePrefab.displayName}
					</span>
					<button
						type="button"
						onClick={() => setActivePrefab(null)}
						className="p-0.5 rounded text-emerald-400/60 hover:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
						title="Clear selection"
					>
						<X className="w-3 h-3" />
					</button>
				</div>
			)}
		</div>
	);
}
