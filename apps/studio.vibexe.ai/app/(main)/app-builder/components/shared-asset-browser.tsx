"use client";

/**
 * SharedAssetBrowser — Shared asset catalog browser used by both
 * the Game Editor (Assets tab) and the World Builder panel.
 *
 * Single source of truth: reads from asset-library-data.ts (PACKS_3D).
 * Provides search, category/subcategory filtering, color variants, and 3D thumbnails.
 */

import { Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ASSET_CATEGORIES,
	getItemsByCategory,
	getSubcategories,
	searchAssets,
	withColor,
	type AssetCategory,
	type AssetLibraryItem,
} from "../lib/asset-library-data";
import { useAssetThumbnail } from "../lib/asset-thumbnail-renderer";

// ===== Types =====

export interface SharedAssetBrowserProps {
	/** Called when user clicks an item */
	onSelect: (item: AssetLibraryItem, color: string) => void;
	/** Called on double-click (optional — e.g., for quick-spawn) */
	onDoubleClick?: (item: AssetLibraryItem, color: string) => void;
	/** Called when user starts dragging an item (for drag-and-drop placement) */
	onDragStart?: (item: AssetLibraryItem, color: string) => string | undefined;
	/** ID of the currently selected item (for highlight) */
	selectedItemId?: string | null;
	/** Number of grid columns (default: 2) */
	columns?: 2 | 3;
	/** Highlight color theme (default: "emerald") */
	highlightColor?: "emerald" | "amber";
	/** Extra content to render above the category pills (e.g., "My Prefabs" tab) */
	extraTabs?: React.ReactNode;
	/** If true, show a pack filter row (Platformer Project, KayKit, etc.) */
	showPackFilter?: boolean;
}

// ===== Constants =====

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

// Known pack IDs for pack filter
const PACK_LABELS: Record<string, string> = {
	"platformer-project": "Platformer Project",
	"kaykit-platformer": "KayKit Platformer",
	"kaykit-city-builder": "KayKit City Builder",
	"kaykit-resource-bits": "KayKit Resources",
	"kaykit-skeletons": "KayKit Skeletons",
	"squad-shooter": "Squad Shooter",
};

// ===== Component =====

export function SharedAssetBrowser({
	onSelect,
	onDoubleClick,
	onDragStart,
	selectedItemId,
	columns = 2,
	highlightColor = "emerald",
	extraTabs,
	showPackFilter,
}: SharedAssetBrowserProps) {
	const [search, setSearch] = useState("");
	const [activeCategory, setActiveCategory] = useState<AssetCategory>("platforms");
	const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
	const [selectedColor, setSelectedColor] = useState("blue");
	const [activePack, setActivePack] = useState<string | null>(null);

	// Debounce single-click to prevent it racing with double-click
	const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Get items for current category
	const categoryItems = useMemo(() => getItemsByCategory(activeCategory), [activeCategory]);
	const subcategories = useMemo(() => getSubcategories(activeCategory), [activeCategory]);

	// Reset subcategory when category changes
	useEffect(() => {
		setActiveSubcategory(null);
	}, [activeCategory]);

	// Get unique packs across all items
	const availablePacks = useMemo(() => {
		const packs = new Set<string>();
		for (const cat of ASSET_CATEGORIES) {
			for (const item of getItemsByCategory(cat)) {
				packs.add(item.packId);
			}
		}
		return Array.from(packs).filter((p) => PACK_LABELS[p]);
	}, []);

	// Filter items by subcategory + pack
	const filteredItems = useMemo(() => {
		if (search) {
			let results = searchAssets(search);
			if (activePack) results = results.filter((item) => item.packId === activePack);
			return results;
		}
		let items = categoryItems;
		if (activeSubcategory) {
			items = items.filter((item) => item.subcategory === activeSubcategory);
		}
		if (activePack) {
			items = items.filter((item) => item.packId === activePack);
		}
		return items;
	}, [search, categoryItems, activeSubcategory, activePack]);

	// Check if current view has any color variant items
	const hasColorItems = useMemo(
		() => filteredItems.some((item) => item.hasColorVariants),
		[filteredItems],
	);

	// Categories with non-zero counts
	const categoriesWithCounts = useMemo(() => {
		return ASSET_CATEGORIES.map((cat) => {
			let items = getItemsByCategory(cat);
			if (activePack) items = items.filter((item) => item.packId === activePack);
			return { id: cat, label: CATEGORY_LABELS[cat], count: items.length };
		}).filter((c) => c.count > 0);
	}, [activePack]);

	const handleClick = useCallback(
		(item: AssetLibraryItem) => {
			if (onDoubleClick) {
				// Debounce for double-click support
				if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
				clickTimerRef.current = setTimeout(() => {
					onSelect(item, selectedColor);
					clickTimerRef.current = null;
				}, 250);
			} else {
				onSelect(item, selectedColor);
			}
		},
		[onSelect, onDoubleClick, selectedColor],
	);

	const handleDoubleClick = useCallback(
		(item: AssetLibraryItem) => {
			if (!onDoubleClick) return;
			if (clickTimerRef.current) {
				clearTimeout(clickTimerRef.current);
				clickTimerRef.current = null;
			}
			onDoubleClick(item, selectedColor);
		},
		[onDoubleClick, selectedColor],
	);

	const hl = highlightColor === "amber" ? {
		activeBg: "bg-amber-500/20",
		activeRing: "ring-amber-500/40",
		pillBg: "bg-amber-500/[0.15]",
		pillText: "text-amber-300",
	} : {
		activeBg: "bg-emerald-500/20",
		activeRing: "ring-emerald-500/40",
		pillBg: "bg-white/[0.12]",
		pillText: "text-white/80",
	};

	return (
		<div className="flex flex-col flex-1 min-h-0">
			{/* Pack filter */}
			{showPackFilter && (
				<div className="flex gap-0.5 px-2 pt-1.5 pb-0.5 overflow-x-auto scrollbar-none flex-shrink-0">
					<button
						type="button"
						onClick={() => setActivePack(null)}
						className={`px-2 py-0.5 text-[9px] rounded-full whitespace-nowrap transition-colors ${
							!activePack ? `${hl.pillBg} ${hl.pillText}` : "text-white/30 hover:text-white/50"
						}`}
					>
						All
					</button>
					{availablePacks.map((packId) => (
						<button
							key={packId}
							type="button"
							onClick={() => setActivePack(packId)}
							className={`px-2 py-0.5 text-[9px] rounded-full whitespace-nowrap transition-colors ${
								activePack === packId ? `${hl.pillBg} ${hl.pillText}` : "text-white/30 hover:text-white/50"
							}`}
						>
							{PACK_LABELS[packId]}
						</button>
					))}
				</div>
			)}

			{/* Search */}
			<div className="px-2 py-1 flex-shrink-0">
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

			{/* Category pills */}
			{!search && (
				<div className="flex-shrink-0 px-2 pb-1">
					<div className="flex gap-0.5 overflow-x-auto scrollbar-none">
						{extraTabs}
						{categoriesWithCounts.map((cat) => (
							<button
								key={cat.id}
								type="button"
								onClick={() => setActiveCategory(cat.id)}
								className={`px-2 py-0.5 text-[9px] rounded-full whitespace-nowrap transition-colors ${
									activeCategory === cat.id
										? `${hl.pillBg} ${hl.pillText}`
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

			{/* Color selector */}
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

			{/* Asset grid */}
			<div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2 min-h-0">
				{filteredItems.length > 0 ? (
					<div className={`grid gap-1 ${columns === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
						{filteredItems.map((item) => {
							const isActive = selectedItemId === item.id;
							const itemColor = item.hasColorVariants ? COLOR_MAP[selectedColor] : undefined;

							return (
								<button
									key={item.id}
									type="button"
									draggable={!!onDragStart}
									onClick={() => handleClick(item)}
									onDoubleClick={onDoubleClick ? () => handleDoubleClick(item) : undefined}
									onDragStart={onDragStart ? (e) => {
										const payload = onDragStart(item, selectedColor);
										if (payload) {
											e.dataTransfer.setData("application/vibexe-asset", payload);
											e.dataTransfer.effectAllowed = "copy";
										}
									} : undefined}
									className={`relative flex flex-col items-center gap-0.5 p-1.5 rounded transition-all ${
										isActive
											? `${hl.activeBg} ring-1 ${hl.activeRing}`
											: "bg-white/[0.03] hover:bg-white/[0.07]"
									} ${onDragStart ? "cursor-grab active:cursor-grabbing" : ""}`}
									title={`${item.displayName}\n${item.packId} / ${item.subcategory}\n${onDragStart ? "Drag to viewport to place" : ""}`}
								>
									<AssetThumbnailCard item={item} itemColor={itemColor} />
									<span className="text-[8px] text-white/50 truncate w-full text-center leading-tight mt-0.5">
										{item.displayName}
									</span>
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
		</div>
	);
}

// ===== Helpers =====

/** Build WB-compatible item from AssetLibraryItem (for world-builder bridge) */
export function toWBItem(item: AssetLibraryItem, selectedColor: string): {
	id: string;
	name: string;
	modelPath: string;
	pack: string;
	category: string;
} {
	// For color-variant items, build the color-specific path
	const colorArgs = item.hasColorVariants ? withColor(item, selectedColor) : item.factoryArgs;
	const modelPath = colorArgs.modelPath || item.modelPath;
	return {
		id: item.id,
		name: item.displayName,
		modelPath,
		pack: item.packId,
		category: item.category,
	};
}

// ===== Thumbnail Card =====

function AssetThumbnailCard({ item, itemColor }: { item: AssetLibraryItem; itemColor?: string }) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [isVisible, setIsVisible] = useState(false);
	const { canvasRef, hasRendered } = useAssetThumbnail(item.packId, item.modelPath, isVisible);

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
				backgroundColor: itemColor ? `${itemColor}30` : "rgba(255,255,255,0.03)",
			}}
		>
			<canvas
				ref={canvasRef}
				className={`w-full h-full ${hasRendered ? "" : "absolute opacity-0 pointer-events-none"}`}
				width={128}
				height={128}
			/>
			{!hasRendered && (
				itemColor ? (
					<div className="w-6 h-6 rounded" style={{ backgroundColor: itemColor, opacity: 0.7 }} />
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
		case "platforms": return "\u25a0";
		case "characters": return "\u265f";
		case "collectibles": return "\u2b50";
		case "hazards": return "\u26a0";
		case "decorations": return "\u2741";
		case "interactive": return "\u2699";
		case "buildings": return "\u2302";
		case "resources": return "\u2692";
		case "weapons": return "\u2694";
		case "environment": return "\u2600";
		default: return "\u25cb";
	}
}
