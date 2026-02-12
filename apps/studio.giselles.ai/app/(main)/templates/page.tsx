"use client";

import { SearchIcon, LayoutTemplateIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { TemplateCard } from "./components/template-card";

interface Template {
	dbId: number;
	name: string;
	description: string | null;
	category: string;
	tags: string[];
	useCount: number;
	createdAt: string;
	authorName: string | null;
	authorAvatar: string | null;
}

const CATEGORIES = [
	"All",
	"AI & ML",
	"Automation",
	"Data Processing",
	"Communication",
	"DevOps",
	"Marketing",
	"Sales",
	"Support",
	"Custom",
];

export default function TemplatesPage() {
	const router = useRouter();
	const [templates, setTemplates] = useState<Template[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [selectedCategory, setSelectedCategory] = useState("All");

	const fetchTemplates = useCallback(async () => {
		setLoading(true);
		try {
			const params = new URLSearchParams();
			if (selectedCategory !== "All") params.set("category", selectedCategory);
			if (search) params.set("search", search);

			const res = await fetch(`/api/templates?${params}`);
			if (res.ok) {
				const data = await res.json();
				setTemplates(data.templates ?? []);
			}
		} catch (err) {
			console.error("Failed to fetch templates:", err);
		} finally {
			setLoading(false);
		}
	}, [selectedCategory, search]);

	useEffect(() => {
		fetchTemplates();
	}, [fetchTemplates]);

	const handleUseTemplate = async (templateDbId: number) => {
		try {
			const res = await fetch(`/api/templates/${templateDbId}/instantiate`, {
				method: "POST",
			});
			if (res.ok) {
				const data = await res.json();
				router.push(`/workflows/${data.workspaceId}`);
			}
		} catch (err) {
			console.error("Failed to instantiate template:", err);
		}
	};

	return (
		<div className="w-full pt-2 pb-2">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-3">
					<LayoutTemplateIcon className="size-5 text-primary" />
					<h1 className="text-[18px] font-bold text-text/90">
						Workflow Templates
					</h1>
				</div>
				{/* Search */}
				<div className="flex items-center gap-2 bg-surface border border-border-muted rounded-lg px-3 py-1.5">
					<SearchIcon className="size-4 text-text/30" />
					<input
						type="text"
						placeholder="Search templates..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="bg-transparent text-sm text-text outline-none placeholder:text-text/30 w-[200px]"
					/>
				</div>
			</div>

			{/* Category sidebar + Grid */}
			<div className="flex gap-6">
				{/* Category sidebar */}
				<div className="w-[180px] shrink-0">
					<div className="space-y-1">
						{CATEGORIES.map((cat) => (
							<button
								key={cat}
								type="button"
								onClick={() => setSelectedCategory(cat)}
								className={`w-full text-left px-3 py-2 text-[13px] rounded-lg transition-colors ${
									selectedCategory === cat
										? "bg-primary/10 text-primary font-medium"
										: "text-text/50 hover:text-text/70 hover:bg-surface-variant"
								}`}
							>
								{cat}
							</button>
						))}
					</div>
				</div>

				{/* Template grid */}
				<div className="flex-1">
					{loading ? (
						<div className="flex items-center justify-center py-12">
							<p className="text-sm text-text/30">Loading templates...</p>
						</div>
					) : templates.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-12">
							<LayoutTemplateIcon className="size-10 text-text/10 mb-3" />
							<p className="text-sm text-text/40">No templates found.</p>
							<p className="text-xs text-text/25 mt-1">
								{search || selectedCategory !== "All"
									? "Try adjusting your filters."
									: "Be the first to publish a template from your workflow!"}
							</p>
						</div>
					) : (
						<div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
							{templates.map((template) => (
								<TemplateCard
									key={template.dbId}
									template={template}
									onUse={handleUseTemplate}
								/>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
