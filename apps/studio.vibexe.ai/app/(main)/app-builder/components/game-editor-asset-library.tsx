"use client";

/**
 * GameEditorAssetLibrary — Browse and spawn 500+ 3D models organized by category.
 * Replaces the old ~28-item palette with full asset catalog.
 */

import { Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameEditor, type PrefabDefinition } from "../lib/game-editor-context";
import {
	ASSET_CATALOG,
	ASSET_CATEGORIES,
	getItemsByCategory,
	getSubcategories,
	searchAssets,
	withColor,
	type AssetCategory,
	type AssetLibraryItem,
} from "../lib/asset-library-data";
import { useAssetThumbnail } from "../lib/asset-thumbnail-renderer";

const CATEGORY_LABELS: Record<AssetCategory, string> = {
	platforms: "Platforms",
	characters: "Characters",
	collectibles: "Collectibles",
	hazards: "Hazards",
	decorations: "Decor",
	interactive: "Interactive",
	buildings: "Buildings",
	resources: "Resources",
	weapons: "Weapons",
	environment: "Environment",
};

const COLOR_MAP: Record<string, string> = {
	blue: "#3b82f6",
	green: "#22c55e",
	red: "#ef4444",
	yellow: "#eab308",
};

const COLOR_OPTIONS = ["blue", "green", "red", "yellow"];

export function GameEditorAssetLibrary() {
	const { activePrefab, setActivePrefab, spawnObject } = useGameEditor();
	const [search, setSearch] = useState("");
	const [activeCategory, setActiveCategory] = useState<AssetCategory>("platforms");
	const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
	const [selectedColor, setSelectedColor] = useState("blue");

	// Get items for current category
	const categoryItems = useMemo(() => getItemsByCategory(activeCategory), [activeCategory]);
	const subcategories = useMemo(() => getSubcategories(activeCategory), [activeCategory]);

	// Reset subcategory when category changes
	useEffect(() => {
		setActiveSubcategory(null);
	}, [activeCategory]);

	// Filter items by subcategory
	const filteredItems = useMemo(() => {
		if (search) {
			return searchAssets(search);
		}
		let items = categoryItems;
		if (activeSubcategory) {
			items = items.filter((item) => item.subcategory === activeSubcategory);
		}
		return items;
	}, [search, categoryItems, activeSubcategory]);

	// Check if current view has any color variant items
	const hasColorItems = useMemo(
		() => filteredItems.some((item) => item.hasColorVariants),
		[filteredItems],
	);

	// Build PrefabDefinition from catalog item
	const buildPrefab = useCallback(
		(item: AssetLibraryItem): PrefabDefinition => {
			const args = item.hasColorVariants ? withColor(item, selectedColor) : item.factoryArgs;
			return {
				factory: item.factory,
				args,
				displayName: item.displayName,
				category: item.category,
			};
		},
		[selectedColor],
	);

	const handleSelect = useCallback(
		(item: AssetLibraryItem) => {
			const prefab = buildPrefab(item);
			if (activePrefab?.displayName === prefab.displayName) {
				setActivePrefab(null);
			} else {
				setActivePrefab(prefab);
			}
		},
		[activePrefab, buildPrefab, setActivePrefab],
	);

	const handleQuickSpawn = useCallback(
		(item: AssetLibraryItem) => {
			const prefab = buildPrefab(item);
			spawnObject(prefab.factory, { x: 0, y: 2, z: 0 }, prefab.args);
		},
		[buildPrefab, spawnObject],
	);

	// Categories with non-zero counts (for display)
	const categoriesWithCounts = useMemo(() => {
		return ASSET_CATEGORIES.map((cat) => ({
			id: cat,
			label: CATEGORY_LABELS[cat],
			count: getItemsByCategory(cat).length,
		})).filter((c) => c.count > 0);
	}, []);

	return (
		<div className="flex flex-col flex-1 min-h-0">
			{/* Search */}
			<div className="px-2 py-1.5 flex-shrink-0">
				<div className="flex items-center gap-1.5 px-2 py-1 bg-white/[0.04] rounded">
					<Search className="w-3 h-3 text-white/20 flex-shrink-0" />
					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search assets..."
						className="flex-1 bg-transparent text-[10px] text-white/70 placeholder:text-white/20 outline-none"
					/>
					{search && (
						<button type="button" onClick={() => setSearch("")} className="text-white/20 hover:text-white/50">
							<X className="w-2.5 h-2.5" />
						</button>
					)}
				</div>
			</div>

			{/* Category pills — scrollable horizontal */}
			{!search && (
				<div className="flex-shrink-0 px-2 pb-1">
					<div className="flex gap-0.5 overflow-x-auto scrollbar-none">
						{categoriesWithCounts.map((cat) => (
							<button
								key={cat.id}
								type="button"
								onClick={() => setActiveCategory(cat.id)}
								className={`px-2 py-0.5 text-[9px] rounded-full whitespace-nowrap transition-colors ${
									activeCategory === cat.id
										? "bg-white/[0.12] text-white/80"
										: "text-white/30 hover:text-white/50"
								}`}
							>
								{cat.label}
								<span className="ml-0.5 text-white/20">{cat.count}</span>
							</button>
						))}
					</div>
				</div>
			)}

			{/* Subcategory pills */}
			{!search && subcategories.length > 1 && (
				<div className="flex-shrink-0 px-2 pb-1">
					<div className="flex gap-0.5 overflow-x-auto scrollbar-none">
						<button
							type="button"
							onClick={() => setActiveSubcategory(null)}
							className={`px-1.5 py-0.5 text-[8px] rounded-full whitespace-nowrap transition-colors ${
								!activeSubcategory
									? "bg-violet-500/20 text-violet-300"
									: "text-white/25 hover:text-white/40"
							}`}
						>
							All
						</button>
						{subcategories.map((sub) => (
							<button
								key={sub}
								type="button"
								onClick={() => setActiveSubcategory(sub)}
								className={`px-1.5 py-0.5 text-[8px] rounded-full whitespace-nowrap transition-colors ${
									activeSubcategory === sub
										? "bg-violet-500/20 text-violet-300"
										: "text-white/25 hover:text-white/40"
								}`}
							>
								{sub}
							</button>
						))}
					</div>
				</div>
			)}

			{/* Color selector — only for kaykit color items */}
			{!search && hasColorItems && (
				<div className="flex-shrink-0 px-2 pb-1.5">
					<div className="flex items-center gap-1">
						<span className="text-[8px] text-white/25 mr-0.5">Color:</span>
						{COLOR_OPTIONS.map((color) => (
							<button
								key={color}
								type="button"
								onClick={() => setSelectedColor(color)}
								className={`w-4 h-4 rounded-full border transition-all ${
									selectedColor === color
										? "border-white/60 ring-1 ring-white/30 scale-110"
										: "border-white/10 hover:border-white/30"
								}`}
								style={{ backgroundColor: COLOR_MAP[color] }}
								title={color}
							/>
						))}
					</div>
				</div>
			)}

			{/* Asset grid — 2 columns */}
			<div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2 min-h-0">
				{filteredItems.length > 0 ? (
					<div className="grid grid-cols-2 gap-1">
						{filteredItems.map((item) => {
							const prefab = buildPrefab(item);
							const isActive = activePrefab?.displayName === prefab.displayName;
							const itemColor = item.hasColorVariants ? COLOR_MAP[selectedColor] : undefined;

							return (
								<button
									key={item.id}
									type="button"
									onClick={() => handleSelect(item)}
									onDoubleClick={() => handleQuickSpawn(item)}
									className={`relative flex flex-col items-center gap-0.5 p-2 rounded transition-all ${
										isActive
											? "bg-emerald-500/20 ring-1 ring-emerald-500/40"
											: "bg-white/[0.03] hover:bg-white/[0.07]"
									}`}
									title={`${item.displayName}\n${item.packId} / ${item.subcategory}\nClick: select | Dbl-click: spawn`}
								>
									{/* Thumbnail — 3D canvas or colored placeholder */}
									<AssetThumbnailCard
										item={item}
										itemColor={itemColor}
									/>
									{/* Name */}
									<span className="text-[8px] text-white/50 truncate w-full text-center leading-tight mt-0.5">
										{item.displayName}
									</span>
									{/* Animated badge */}
									{item.isAnimated && (
										<span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" title="Animated" />
									)}
								</button>
							);
						})}
					</div>
				) : (
					<div className="py-8 text-center text-[10px] text-white/20">
						No assets found
					</div>
				)}
			</div>

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

/**
 * Individual asset card thumbnail — uses 3D canvas when available,
 * falls back to a colored square or category icon.
 */
function AssetThumbnailCard({ item, itemColor }: { item: AssetLibraryItem; itemColor?: string }) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [isVisible, setIsVisible] = useState(false);
	const { canvasRef, hasRendered } = useAssetThumbnail(item.packId, item.modelPath, isVisible);

	// IntersectionObserver to only render when visible
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setIsVisible(true);
					observer.disconnect();
				}
			},
			{ threshold: 0.1 },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	return (
		<div
			ref={containerRef}
			className="w-full aspect-square rounded flex items-center justify-center text-white/20 overflow-hidden relative"
			style={{
				backgroundColor: itemColor
					? `${itemColor}30`
					: "rgba(255,255,255,0.03)",
			}}
		>
			{/* Canvas always mounted so the ref is available for the renderer */}
			<canvas
				ref={canvasRef}
				className={`w-full h-full ${hasRendered ? "" : "absolute opacity-0 pointer-events-none"}`}
				width={128}
				height={128}
			/>
			{/* Placeholder shown until 3D render completes */}
			{!hasRendered && (
				itemColor ? (
					<div
						className="w-6 h-6 rounded"
						style={{ backgroundColor: itemColor, opacity: 0.7 }}
					/>
				) : (
					<div className="text-[18px] opacity-30">
						{getCategoryIcon(item.category)}
					</div>
				)
			)}
		</div>
	);
}

function getCategoryIcon(category: AssetCategory): string {
	switch (category) {
		case "platforms": return "\u25a0"; // square
		case "characters": return "\u265f"; // chess pawn
		case "collectibles": return "\u2b50"; // star
		case "hazards": return "\u26a0"; // warning
		case "decorations": return "\u2741"; // flower
		case "interactive": return "\u2699"; // gear
		case "buildings": return "\u2302"; // house
		case "resources": return "\u2692"; // pick & hammer
		case "weapons": return "\u2694"; // crossed swords
		case "environment": return "\u2600"; // sun
		default: return "\u25cb"; // circle
	}
}
