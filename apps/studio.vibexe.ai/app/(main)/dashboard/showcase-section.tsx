"use client";

import { Eye, Ghost, Layers, Shuffle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { SuggestedTemplate } from "@/lib/dashboard/get-dashboard-data";

const SHOWCASE_CATEGORIES = [
	{ id: "all", label: "All" },
	{ id: "landing", label: "Landing Pages" },
	{ id: "advanced", label: "Advanced Apps" },
	{ id: "business", label: "Business Tools" },
	{ id: "personal", label: "Personal Tools" },
	{ id: "mobile", label: "Mobile Apps" },
];

/** Map template category field to showcase filter categories */
function matchesCategory(template: SuggestedTemplate, categoryId: string): boolean {
	if (categoryId === "all") return true;
	const cat = template.category.toLowerCase();
	const tags = template.tags.map((t) => t.toLowerCase());
	const combined = [cat, ...tags].join(" ");

	switch (categoryId) {
		case "landing":
			return combined.includes("landing") || combined.includes("page") || combined.includes("website");
		case "advanced":
			return combined.includes("advanced") || combined.includes("fullstack") || combined.includes("full-stack") || combined.includes("saas");
		case "business":
			return combined.includes("business") || combined.includes("crm") || combined.includes("erp") || combined.includes("enterprise");
		case "personal":
			return combined.includes("personal") || combined.includes("productivity") || combined.includes("todo") || combined.includes("tracker");
		case "mobile":
			return combined.includes("mobile") || combined.includes("app") || combined.includes("pwa");
		default:
			return true;
	}
}

interface ShowcaseSectionProps {
	templates: SuggestedTemplate[];
}

export function ShowcaseSection({ templates }: ShowcaseSectionProps) {
	const [activeCategory, setActiveCategory] = useState("all");

	const filtered = useMemo(
		() => templates.filter((t) => matchesCategory(t, activeCategory)),
		[templates, activeCategory],
	);

	return (
		<section className="dash-animate-fade-up" style={{ animationDelay: "0.4s" }}>
			{/* Explore link */}
			<div className="flex items-center justify-center gap-2 mb-6">
				<div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/[0.06]" />
				<div className="flex items-center gap-2 px-4">
					<Layers className="h-3.5 w-3.5 text-white/20" />
					<span className="text-[13px] text-white/30 font-medium">Explore showcases</span>
				</div>
				<div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/[0.06]" />
			</div>

			{/* Category filter tabs */}
			<div className="flex items-center gap-1.5 mb-6 flex-wrap justify-center">
				{SHOWCASE_CATEGORIES.map((cat) => (
					<button
						key={cat.id}
						type="button"
						onClick={() => setActiveCategory(cat.id)}
						className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all ${
							activeCategory === cat.id
								? "bg-white/[0.08] text-white/70 border border-white/[0.1]"
								: "text-white/30 hover:text-white/50 hover:bg-white/[0.04] border border-transparent"
						}`}
					>
						{cat.label}
					</button>
				))}
			</div>

			{/* Template grid */}
			{filtered.length > 0 ? (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{filtered.map((template) => (
						<div
							key={template.id}
							className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden hover:border-white/[0.12] transition-all"
						>
							{/* Thumbnail */}
							<div className="aspect-[16/10] bg-gradient-to-br from-white/[0.04] to-white/[0.01] relative overflow-hidden">
								{template.thumbnailUrl ? (
									<img
										src={template.thumbnailUrl}
										alt={template.name}
										className="absolute inset-0 w-full h-full object-cover"
									/>
								) : (
									<div className="absolute inset-0 flex items-center justify-center">
										<Layers className="h-8 w-8 text-white/[0.06]" />
									</div>
								)}

								{/* Hover overlay */}
								<div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
									<Link
										href={`/preview/template/${template.id}`}
										className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/[0.15] backdrop-blur-sm text-[12px] font-medium text-white/80 hover:bg-white/[0.25] transition-colors"
									>
										<Eye className="h-3.5 w-3.5" />
										Preview
									</Link>
									<Link
										href={`/app-builder?template=${template.id}`}
										className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-500/30 backdrop-blur-sm text-[12px] font-medium text-blue-200 hover:bg-blue-500/40 transition-colors"
									>
										<Shuffle className="h-3.5 w-3.5" />
										Remix
									</Link>
								</div>
							</div>

							{/* Info */}
							<div className="px-3.5 py-3">
								<h4 className="text-[13px] font-medium text-white/65 group-hover:text-white/80 transition-colors truncate">
									{template.name}
								</h4>
								<div className="flex items-center gap-2 mt-1.5">
									<span className="px-2 py-0.5 rounded text-[10px] bg-white/[0.04] text-white/25 capitalize">
										{template.category}
									</span>
									{template.entityCount > 0 && (
										<span className="text-[10px] text-white/20">
											{template.entityCount} entities
										</span>
									)}
								</div>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="text-center py-12">
					<Ghost className="h-10 w-10 text-white/[0.06] mx-auto mb-3" />
					<p className="text-[14px] text-white/25">
						No showcases in this category yet
					</p>
					<p className="text-[12px] text-white/15 mt-1">
						Build something amazing and it could be featured here!
					</p>
				</div>
			)}
		</section>
	);
}
