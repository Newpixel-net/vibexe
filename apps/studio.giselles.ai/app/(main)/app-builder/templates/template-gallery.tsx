"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
	ArrowRightIcon,
	DatabaseIcon,
	FileIcon,
	LayoutTemplateIcon,
	SearchIcon,
	SparklesIcon,
	StarIcon,
	UsersIcon,
} from "lucide-react";

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
	const [categoryFilter, setCategoryFilter] = useState("");
	const [cloning, setCloning] = useState<string | null>(null);

	const filtered = useMemo(() => {
		return templates.filter((t) => {
			if (search) {
				const q = search.toLowerCase();
				const nameMatch = t.name.toLowerCase().includes(q);
				const descMatch = t.description?.toLowerCase().includes(q);
				if (!nameMatch && !descMatch) return false;
			}
			if (categoryFilter && t.category !== categoryFilter) return false;
			return true;
		});
	}, [templates, search, categoryFilter]);

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

			{/* Filters */}
			<div className="px-8 pb-6">
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
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => setCategoryFilter("")}
							className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
								!categoryFilter
									? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
									: "bg-white/[0.04] text-white/50 border border-white/10 hover:bg-white/[0.08] hover:text-white/70"
							}`}
						>
							All
						</button>
						{categories.map((c) => (
							<button
								key={c}
								type="button"
								onClick={() =>
									setCategoryFilter(categoryFilter === c ? "" : c)
								}
								className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
									categoryFilter === c
										? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
										: "bg-white/[0.04] text-white/50 border border-white/10 hover:bg-white/[0.08] hover:text-white/70"
								}`}
							>
								{c}
							</button>
						))}
					</div>
				</div>
			</div>

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
// Template Card
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
	// Pick a gradient based on category
	const gradients: Record<string, string> = {
		"Project Management": "from-blue-500/10 to-cyan-500/10",
		"E-Commerce": "from-emerald-500/10 to-green-500/10",
		Dashboard: "from-purple-500/10 to-pink-500/10",
		CRM: "from-orange-500/10 to-amber-500/10",
		Social: "from-pink-500/10 to-rose-500/10",
		"Content Management": "from-teal-500/10 to-cyan-500/10",
		Education: "from-indigo-500/10 to-blue-500/10",
		Analytics: "from-violet-500/10 to-purple-500/10",
		Communication: "from-sky-500/10 to-blue-500/10",
		Utility: "from-gray-500/10 to-slate-500/10",
		Other: "from-gray-500/10 to-slate-500/10",
	};
	const gradient = gradients[t.category] || gradients.Other;

	return (
		<div className="group relative bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 hover:bg-white/[0.05] transition-all duration-200">
			{/* Category gradient header */}
			<div
				className={`h-28 bg-gradient-to-br ${gradient} flex items-center justify-center relative`}
			>
				<LayoutTemplateIcon className="size-10 text-white/10" />
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
						{t.category}
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
		</div>
	);
}
