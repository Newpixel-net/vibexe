"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
	PreviewImage,
	PREVIEW_CONTAINER_HEIGHT,
	injectPreviewScrollKeyframes,
} from "../components/app-preview-image";
import {
	ArrowRightIcon,
	ChevronRightIcon,
	DatabaseIcon,
	FileIcon,
	LayoutTemplateIcon,
	SearchIcon,
	SparklesIcon,
	StarIcon,
	UsersIcon,
} from "lucide-react";
import {
	type CategoryGroup,
	TEMPLATE_CATEGORY_TREE,
	MAIN_CATEGORIES,
	getMainCategory,
	getSubcategory,
	getCategoryGradient,
	getCategoryDisplayLabel,
	normalizeCategory,
} from "../lib/template-constants";

interface TemplateScreenshot {
	url: string;
	order: number;
	width: number;
	height: number;
	isMain: boolean;
}

interface GalleryTemplate {
	dbId: number;
	id: string;
	name: string;
	description: string | null;
	category: string;
	tags: string[];
	visibility: string;
	featured: boolean;
	status: string;
	useCount: number;
	fileCount: number;
	entityCount: number;
	authorUserDbId: number | null;
	createdAt: Date;
	thumbnailUrl: string | null;
	fullpageUrl: string | null;
	screenshots: TemplateScreenshot[] | null;
}

interface TemplateGalleryProps {
	templates: GalleryTemplate[];
	categories: string[];
	totalCount: number;
}

export function TemplateGallery({
	templates,
	categories,
	totalCount,
}: TemplateGalleryProps) {
	const router = useRouter();
	const [search, setSearch] = useState("");
	const [mainCategoryFilter, setMainCategoryFilter] = useState("");
	const [subCategoryFilter, setSubCategoryFilter] = useState("");
	const [cloning, setCloning] = useState<string | null>(null);

	// Get subcategories for selected main category
	const activeSubcategories = useMemo(() => {
		if (!mainCategoryFilter) return [];
		return TEMPLATE_CATEGORY_TREE[mainCategoryFilter]?.subcategories ?? [];
	}, [mainCategoryFilter]);

	const filtered = useMemo(() => {
		return templates.filter((t) => {
			if (search) {
				const q = search.toLowerCase();
				const nameMatch = t.name.toLowerCase().includes(q);
				const descMatch = t.description?.toLowerCase().includes(q);
				if (!nameMatch && !descMatch) return false;
			}
			if (mainCategoryFilter) {
				const normalized = normalizeCategory(t.category);
				const tMain = getMainCategory(normalized);
				if (tMain !== mainCategoryFilter) return false;
				if (subCategoryFilter) {
					const tSub = getSubcategory(normalized);
					if (tSub !== subCategoryFilter) return false;
				}
			}
			return true;
		});
	}, [templates, search, mainCategoryFilter, subCategoryFilter]);

	const handleUseTemplate = useCallback(
		async (t: GalleryTemplate) => {
			const name = prompt(
				"Enter a name for your new app:",
				t.name,
			);
			if (!name) return;

			setCloning(t.id);
			try {
				const res = await fetch(`/api/app-templates/${t.id}/clone`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name }),
				});
				const data = await res.json();
				if (res.ok) {
					router.push(data.redirectPath);
				} else {
					alert(data.error || "Failed to create app from template");
				}
			} catch {
				alert("Network error");
			} finally {
				setCloning(null);
			}
		},
		[router],
	);

	return (
		<div className="flex-1 min-h-0 overflow-y-auto">
			{/* Hero Section */}
			<div className="px-8 pt-8 pb-6">
				<div className="flex items-center gap-3 mb-2">
					<div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20">
						<LayoutTemplateIcon className="size-5 text-blue-400" />
					</div>
					<div>
						<h1 className="text-2xl font-bold text-white">Templates</h1>
						<p className="text-sm text-white/50">
							Start building faster with pre-built app templates
						</p>
					</div>
				</div>
			</div>

			{/* Search + Main Category Filters */}
			<div className="px-8 pb-3">
				<div className="flex items-center gap-3">
					<div className="relative flex-1 max-w-md">
						<SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-white/30" />
						<input
							type="text"
							placeholder="Search templates..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/40 focus:bg-white/[0.06] transition-all"
						/>
					</div>
					<div className="flex items-center gap-2 flex-wrap">
						<button
							type="button"
							onClick={() => {
								setMainCategoryFilter("");
								setSubCategoryFilter("");
							}}
							className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
								!mainCategoryFilter
									? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
									: "bg-white/[0.04] text-white/50 border border-white/10 hover:bg-white/[0.08] hover:text-white/70"
							}`}
						>
							All
						</button>
						{MAIN_CATEGORIES.map((cat) => (
							<button
								key={cat}
								type="button"
								onClick={() => {
									if (mainCategoryFilter === cat) {
										setMainCategoryFilter("");
										setSubCategoryFilter("");
									} else {
										setMainCategoryFilter(cat);
										setSubCategoryFilter("");
									}
								}}
								className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
									mainCategoryFilter === cat
										? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
										: "bg-white/[0.04] text-white/50 border border-white/10 hover:bg-white/[0.08] hover:text-white/70"
								}`}
							>
								{cat}
							</button>
						))}
					</div>
				</div>
			</div>

			{/* Subcategory Filter Row (shown when a main category is selected) */}
			{mainCategoryFilter && activeSubcategories.length > 0 && (
				<div className="px-8 pb-4">
					<div className="flex items-center gap-2 flex-wrap">
						<ChevronRightIcon className="size-3.5 text-white/20 mr-1" />
						<button
							type="button"
							onClick={() => setSubCategoryFilter("")}
							className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
								!subCategoryFilter
									? "bg-white/[0.1] text-white/80 border border-white/15"
									: "bg-white/[0.03] text-white/40 border border-white/[0.06] hover:bg-white/[0.06] hover:text-white/60"
							}`}
						>
							All {mainCategoryFilter}
						</button>
						{activeSubcategories.map((sub) => (
							<button
								key={sub}
								type="button"
								onClick={() =>
									setSubCategoryFilter(subCategoryFilter === sub ? "" : sub)
								}
								className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
									subCategoryFilter === sub
										? "bg-white/[0.1] text-white/80 border border-white/15"
										: "bg-white/[0.03] text-white/40 border border-white/[0.06] hover:bg-white/[0.06] hover:text-white/60"
								}`}
							>
								{sub}
							</button>
						))}
					</div>
				</div>
			)}

			{/* Template Grid */}
			<div className="px-8 pb-8">
				{filtered.length === 0 ? (
					<div className="text-center py-20">
						{templates.length === 0 ? (
							<div className="max-w-sm mx-auto">
								<div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 inline-block mb-4">
									<LayoutTemplateIcon className="size-10 text-white/20" />
								</div>
								<h3 className="text-lg font-semibold text-white/70 mb-2">
									No templates available yet
								</h3>
								<p className="text-sm text-white/40">
									Templates will appear here once they are published.
									Start building your app from scratch instead.
								</p>
							</div>
						) : (
							<div className="max-w-sm mx-auto">
								<SearchIcon className="size-10 text-white/20 mx-auto mb-4" />
								<h3 className="text-lg font-semibold text-white/70 mb-2">
									No matching templates
								</h3>
								<p className="text-sm text-white/40">
									Try adjusting your search or filter criteria.
								</p>
							</div>
						)}
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
						{filtered.map((t) => (
							<TemplateCard
								key={t.id}
								template={t}
								isCloning={cloning === t.id}
								onUse={() => handleUseTemplate(t)}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

// ============================================================================
// Template Card with Hover Preview
// ============================================================================

function TemplateCard({
	template: t,
	isCloning,
	onUse,
}: {
	template: GalleryTemplate;
	isCloning: boolean;
	onUse: () => void;
}) {
	const gradient = getCategoryGradient(t.category);
	const displayLabel = getCategoryDisplayLabel(t.category);

	// Hover preview state
	const [previewVisible, setPreviewVisible] = useState(false);
	const [previewPos, setPreviewPos] = useState({ top: 0, left: 0 });
	const cardRef = useRef<HTMLDivElement>(null);
	const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// The image to show in hover preview: fullpageUrl > thumbnailUrl
	const previewImageUrl = t.fullpageUrl || t.thumbnailUrl;

	const showPreview = useCallback(() => {
		if (!cardRef.current || !previewImageUrl) return;
		const rect = cardRef.current.getBoundingClientRect();
		const previewWidth = 400;
		const padding = 16;

		// Prefer placing to the right of the card
		let left = rect.right + padding;
		// If not enough space on right, place on left
		if (left + previewWidth > window.innerWidth - padding) {
			left = rect.left - previewWidth - padding;
		}
		// Clamp left
		left = Math.max(padding, Math.min(left, window.innerWidth - previewWidth - padding));

		// Vertical: align top of preview with top of card, but don't overflow bottom
		let top = rect.top;
		const previewApproxHeight = PREVIEW_CONTAINER_HEIGHT + 80; // image + caption
		if (top + previewApproxHeight > window.innerHeight - padding) {
			top = window.innerHeight - previewApproxHeight - padding;
		}
		top = Math.max(padding, top);

		setPreviewPos({ top, left });
		setPreviewVisible(true);
	}, [previewImageUrl]);

	const handleThumbEnter = useCallback(() => {
		if (exitTimerRef.current) {
			clearTimeout(exitTimerRef.current);
			exitTimerRef.current = null;
		}
		enterTimerRef.current = setTimeout(showPreview, 300);
	}, [showPreview]);

	const handleThumbLeave = useCallback(() => {
		if (enterTimerRef.current) {
			clearTimeout(enterTimerRef.current);
			enterTimerRef.current = null;
		}
		exitTimerRef.current = setTimeout(() => setPreviewVisible(false), 200);
	}, []);

	const handlePreviewEnter = useCallback(() => {
		if (exitTimerRef.current) {
			clearTimeout(exitTimerRef.current);
			exitTimerRef.current = null;
		}
	}, []);

	const handlePreviewLeave = useCallback(() => {
		exitTimerRef.current = setTimeout(() => setPreviewVisible(false), 200);
	}, []);

	// Cleanup timers
	useEffect(() => {
		return () => {
			if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
			if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
		};
	}, []);

	return (
		<div
			ref={cardRef}
			className="group relative bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 hover:bg-white/[0.05] transition-all duration-200"
		>
			{/* Category gradient header / Thumbnail */}
			<div
				className={`h-28 relative flex items-center justify-center overflow-hidden ${t.thumbnailUrl ? "" : `bg-gradient-to-br ${gradient}`}`}
				onMouseEnter={previewImageUrl ? handleThumbEnter : undefined}
				onMouseLeave={previewImageUrl ? handleThumbLeave : undefined}
			>
				{t.thumbnailUrl ? (
					<>
						<img
							src={t.thumbnailUrl}
							alt={t.name}
							className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
						/>
						<div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
					</>
				) : (
					<LayoutTemplateIcon className="size-10 text-white/10" />
				)}
				{t.featured && (
					<div className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 backdrop-blur-sm border border-amber-500/20">
						<StarIcon className="size-3 fill-amber-400 text-amber-400" />
						<span className="text-[10px] font-semibold text-amber-300 uppercase tracking-wide">
							Featured
						</span>
					</div>
				)}
				<div className="absolute bottom-3 left-4">
					<span className="px-2.5 py-1 rounded-lg bg-black/30 backdrop-blur-sm text-[11px] font-medium text-white/80">
						{displayLabel}
					</span>
				</div>
			</div>

			{/* Content */}
			<div className="p-5">
				<h3 className="text-[15px] font-semibold text-white mb-1.5 group-hover:text-blue-300 transition-colors">
					{t.name}
				</h3>
				{t.description && (
					<p className="text-[13px] text-white/45 mb-4 line-clamp-2 leading-relaxed">
						{t.description}
					</p>
				)}

				{/* Stats */}
				<div className="flex items-center gap-3 text-[11px] text-white/35 mb-4">
					<span className="inline-flex items-center gap-1">
						<FileIcon className="size-3" />
						{t.fileCount} files
					</span>
					{t.entityCount > 0 && (
						<span className="inline-flex items-center gap-1">
							<DatabaseIcon className="size-3" />
							{t.entityCount} entities
						</span>
					)}
					<span className="inline-flex items-center gap-1">
						<UsersIcon className="size-3" />
						{t.useCount} uses
					</span>
				</div>

				{/* Tags */}
				{t.tags.length > 0 && (
					<div className="flex flex-wrap gap-1.5 mb-4">
						{t.tags.slice(0, 4).map((tag) => (
							<span
								key={tag}
								className="px-2 py-0.5 rounded-md bg-white/[0.06] text-[10px] text-white/40"
							>
								{tag}
							</span>
						))}
						{t.tags.length > 4 && (
							<span className="px-2 py-0.5 text-[10px] text-white/30">
								+{t.tags.length - 4} more
							</span>
						)}
					</div>
				)}

				{/* Use Button */}
				<button
					type="button"
					onClick={onUse}
					disabled={isCloning}
					className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600/90 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all group/btn"
				>
					{isCloning ? (
						<>
							<SparklesIcon className="size-4 animate-pulse" />
							Creating app...
						</>
					) : (
						<>
							Use Template
							<ArrowRightIcon className="size-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
						</>
					)}
				</button>
			</div>

			{/* Hover Preview Portal */}
			{typeof document !== "undefined" &&
				createPortal(
					<AnimatePresence>
						{previewVisible && previewImageUrl && (
							<motion.div
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.95 }}
								transition={{ duration: 0.15 }}
								className="fixed z-50 w-[400px] rounded-2xl overflow-hidden border border-white/15 bg-[#0d0d1a]/95 backdrop-blur-xl shadow-2xl shadow-black/50"
								style={{ top: previewPos.top, left: previewPos.left }}
								onMouseEnter={handlePreviewEnter}
								onMouseLeave={handlePreviewLeave}
							>
								{/* Preview Image */}
								<div
									className="overflow-hidden bg-black/20"
									style={{ height: PREVIEW_CONTAINER_HEIGHT }}
								>
									<PreviewImage
										src={previewImageUrl}
										alt={t.name}
										containerHeight={PREVIEW_CONTAINER_HEIGHT}
									/>
								</div>
								{/* Caption */}
								<div className="px-4 py-3 border-t border-white/[0.06]">
									<p className="text-sm font-medium text-white/80 truncate">{t.name}</p>
									{t.description && (
										<p className="text-[11px] text-white/35 mt-0.5 line-clamp-2">{t.description}</p>
									)}
								</div>
							</motion.div>
						)}
					</AnimatePresence>,
					document.body,
				)}
		</div>
	);
}

// Inject auto-scroll keyframes into the document (once)
injectPreviewScrollKeyframes();
