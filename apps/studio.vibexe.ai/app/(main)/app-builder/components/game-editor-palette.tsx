"use client";

/**
 * GameEditorPalette — Object spawner palette for the 3D scene editor.
 * Shows categorized model cards from KayKit packs. Click to set active prefab,
 * then click viewport to spawn at that position.
 */

import { Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useGameEditor, type PrefabDefinition } from "../lib/game-editor-context";

// Palette categories with factory mappings
const PALETTE_CATEGORIES: {
	label: string;
	items: PrefabDefinition[];
}[] = [
	{
		label: "Platforms",
		items: [
			{ factory: "createPlatform3D", args: { variant: "4x4x1", color: "blue" }, displayName: "Platform 4x4", category: "Platforms" },
			{ factory: "createPlatform3D", args: { variant: "6x6x1", color: "blue" }, displayName: "Platform 6x6", category: "Platforms" },
			{ factory: "createPlatform3D", args: { variant: "2x2x1", color: "blue" }, displayName: "Platform 2x2", category: "Platforms" },
			{ factory: "createPlatform3D", args: { variant: "4x2x1", color: "green" }, displayName: "Plat 4x2 Green", category: "Platforms" },
			{ factory: "createPlatform3D", args: { variant: "4x4x2", color: "red" }, displayName: "Plat 4x4x2 Red", category: "Platforms" },
			{ factory: "createPlatform3D", args: { variant: "6x2x1", color: "yellow" }, displayName: "Plat 6x2 Yellow", category: "Platforms" },
		],
	},
	{
		label: "Collectibles",
		items: [
			{ factory: "createCollectible3D", args: { type: "diamond", color: "blue" }, displayName: "Diamond", category: "Collectibles" },
			{ factory: "createCollectible3D", args: { type: "star", color: "yellow" }, displayName: "Star", category: "Collectibles" },
			{ factory: "createCollectible3D", args: { type: "heart", color: "red" }, displayName: "Heart", category: "Collectibles" },
			{ factory: "createCollectible3D", args: { type: "ball", color: "green" }, displayName: "Ball", category: "Collectibles" },
		],
	},
	{
		label: "Barriers",
		items: [
			{ factory: "createBarrier3D", args: { variant: "2x1x2", color: "blue" }, displayName: "Wall 2x1x2", category: "Barriers" },
			{ factory: "createBarrier3D", args: { variant: "4x1x4", color: "blue" }, displayName: "Wall 4x1x4", category: "Barriers" },
			{ factory: "createBarrier3D", args: { variant: "3x1x2", color: "red" }, displayName: "Wall 3x1x2 Red", category: "Barriers" },
			{ factory: "createBarrier3D", args: { variant: "1x1x4", color: "green" }, displayName: "Pillar 1x1x4", category: "Barriers" },
		],
	},
	{
		label: "Decorations",
		items: [
			{ factory: "createDecoration3D", args: { type: "pillar_2x2x4", neutral: true }, displayName: "Pillar", category: "Decorations" },
			{ factory: "createDecoration3D", args: { type: "structure_A", neutral: true }, displayName: "Structure A", category: "Decorations" },
			{ factory: "createDecoration3D", args: { type: "floor_wood_4x4", neutral: true }, displayName: "Wood Floor", category: "Decorations" },
			{ factory: "createDecoration3D", args: { type: "sign", neutral: true }, displayName: "Sign", category: "Decorations" },
		],
	},
	{
		label: "Characters",
		items: [
			{ factory: "createPlayer3D", args: { model: "ball", color: "blue" }, displayName: "Player Ball", category: "Characters" },
			{ factory: "createPlayer3D", args: { model: "diamond", color: "yellow" }, displayName: "Player Diamond", category: "Characters" },
			{ factory: "createPlayer3D", args: { model: "star", color: "red" }, displayName: "Player Star", category: "Characters" },
		],
	},
	{
		label: "City",
		items: [
			{ factory: "createDecoration3D", args: { type: "building_A", _pack: "kaykit-city-builder", _path: "Assets/gltf/building_A.gltf" }, displayName: "Building A", category: "City" },
			{ factory: "createDecoration3D", args: { type: "building_C", _pack: "kaykit-city-builder", _path: "Assets/gltf/building_C.gltf" }, displayName: "Building C", category: "City" },
			{ factory: "createDecoration3D", args: { type: "car_sedan", _pack: "kaykit-city-builder", _path: "Assets/gltf/car_sedan.gltf" }, displayName: "Car Sedan", category: "City" },
			{ factory: "createDecoration3D", args: { type: "streetlight", _pack: "kaykit-city-builder", _path: "Assets/gltf/streetlight.gltf" }, displayName: "Streetlight", category: "City" },
		],
	},
	{
		label: "Resources",
		items: [
			{ factory: "createDecoration3D", args: { type: "Gold_Bar", _pack: "kaykit-resource-bits", _path: "Assets/gltf/Gold_Bar.gltf" }, displayName: "Gold Bar", category: "Resources" },
			{ factory: "createDecoration3D", args: { type: "Iron_Bar", _pack: "kaykit-resource-bits", _path: "Assets/gltf/Iron_Bar.gltf" }, displayName: "Iron Bar", category: "Resources" },
			{ factory: "createDecoration3D", args: { type: "Wood_Log_A", _pack: "kaykit-resource-bits", _path: "Assets/gltf/Wood_Log_A.gltf" }, displayName: "Wood Log", category: "Resources" },
			{ factory: "createDecoration3D", args: { type: "Fuel_A_Barrel", _pack: "kaykit-resource-bits", _path: "Assets/gltf/Fuel_A_Barrel.gltf" }, displayName: "Fuel Barrel", category: "Resources" },
		],
	},
];

const COLOR_MAP: Record<string, string> = {
	blue: "#3b82f6",
	green: "#22c55e",
	red: "#ef4444",
	yellow: "#eab308",
	// City/Resource items don't have a color arg — show neutral
	undefined: "#888888",
};

export function GameEditorPalette() {
	const { activePrefab, setActivePrefab, spawnObject } = useGameEditor();
	const [search, setSearch] = useState("");
	const [activeTab, setActiveTab] = useState(0);

	const filteredCategories = useMemo(() => {
		if (!search) return PALETTE_CATEGORIES;
		const q = search.toLowerCase();
		return PALETTE_CATEGORIES.map((cat) => ({
			...cat,
			items: cat.items.filter((item) => item.displayName.toLowerCase().includes(q)),
		})).filter((cat) => cat.items.length > 0);
	}, [search]);

	const handleSelect = useCallback(
		(prefab: PrefabDefinition) => {
			if (activePrefab?.displayName === prefab.displayName) {
				setActivePrefab(null);
			} else {
				setActivePrefab(prefab);
			}
		},
		[activePrefab, setActivePrefab],
	);

	const handleQuickSpawn = useCallback(
		(prefab: PrefabDefinition) => {
			// Quick spawn at origin (y=2 so it falls onto ground)
			spawnObject(prefab.factory, { x: 0, y: 2, z: 0 }, prefab.args);
		},
		[spawnObject],
	);

	return (
		<div className="max-h-[200px] overflow-hidden flex flex-col">
			{/* Search */}
			<div className="px-2 py-1.5 flex items-center gap-1.5">
				<Search className="w-3 h-3 text-white/30" />
				<input
					type="text"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Search objects..."
					className="flex-1 bg-transparent text-[11px] text-white/70 placeholder:text-white/20 outline-none"
				/>
			</div>

			{/* Category tabs */}
			<div className="flex gap-0.5 px-2 pb-1 overflow-x-auto scrollbar-none">
				{filteredCategories.map((cat, i) => (
					<button
						key={cat.label}
						type="button"
						onClick={() => setActiveTab(i)}
						className={`px-2 py-0.5 text-[9px] rounded-full whitespace-nowrap transition-colors ${
							activeTab === i
								? "bg-white/[0.12] text-white/80"
								: "text-white/30 hover:text-white/50"
						}`}
					>
						{cat.label}
					</button>
				))}
			</div>

			{/* Grid */}
			<div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2">
				<div className="grid grid-cols-3 gap-1">
					{(filteredCategories[activeTab]?.items || []).map((item) => {
						const isActive = activePrefab?.displayName === item.displayName;
						const color = COLOR_MAP[item.args.color] || "#888";
						return (
							<button
								key={item.displayName}
								type="button"
								onClick={() => handleSelect(item)}
								onDoubleClick={() => handleQuickSpawn(item)}
								className={`relative flex flex-col items-center gap-0.5 p-1.5 rounded transition-all ${
									isActive
										? "bg-emerald-500/20 ring-1 ring-emerald-500/40"
										: "bg-white/[0.04] hover:bg-white/[0.08]"
								}`}
								title={`Click to select, double-click to spawn at origin\n${item.factory}(${JSON.stringify(item.args)})`}
							>
								<div
									className="w-6 h-6 rounded"
									style={{ backgroundColor: color, opacity: 0.8 }}
								/>
								<span className="text-[8px] text-white/50 truncate w-full text-center leading-tight">
									{item.displayName}
								</span>
							</button>
						);
					})}
				</div>
			</div>

			{/* Active prefab indicator */}
			{activePrefab && (
				<div className="px-2 py-1 bg-emerald-500/10 border-t border-emerald-500/20 text-[10px] text-emerald-400 text-center">
					Click viewport to spawn: {activePrefab.displayName}
				</div>
			)}
		</div>
	);
}
