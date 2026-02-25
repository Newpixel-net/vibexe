"use client";

import clsx from "clsx";
import {
	Bot,
	Code,
	Database,
	FileText,
	Globe,
	Loader2,
	Mail,
	Megaphone,
	Search,
	Server,
	Sparkles,
	Users,
	Workflow,
	Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface WorkflowTemplate {
	dbId: number;
	name: string;
	description: string | null;
	category: string;
	tags: string[];
	nodeCount?: number;
	integrationCount?: number;
	useCount: number;
}

const CATEGORIES = [
	{ id: "all", label: "All", icon: Sparkles },
	{ id: "ai", label: "AI & ML", icon: Bot },
	{ id: "marketing", label: "Marketing", icon: Megaphone },
	{ id: "sales", label: "Sales & CRM", icon: Users },
	{ id: "support", label: "Support", icon: Mail },
	{ id: "devops", label: "DevOps", icon: Server },
	{ id: "data", label: "Data", icon: Database },
	{ id: "content", label: "Content", icon: FileText },
	{ id: "integration", label: "Integration", icon: Zap },
	{ id: "code", label: "Code", icon: Code },
	{ id: "web", label: "Web", icon: Globe },
] as const;

function getCategoryIcon(category: string) {
	const cat = CATEGORIES.find((c) => c.id === category);
	return cat?.icon ?? Workflow;
}

function TemplateCard({
	template,
	onUse,
	isLoading,
}: {
	template: WorkflowTemplate;
	onUse: (template: WorkflowTemplate) => void;
	isLoading: boolean;
}) {
	const Icon = getCategoryIcon(template.category);

	return (
		<button
			type="button"
			onClick={() => onUse(template)}
			disabled={isLoading}
			className={clsx(
				"relative rounded-xl border border-blue-muted/30 bg-[rgba(131,157,195,0.04)] px-4 py-3.5 flex flex-col gap-2 text-left transition-all duration-150 ease-out",
				"hover:bg-[rgba(131,157,195,0.08)] hover:border-blue-muted/40 hover:shadow-[0_0_20px_rgba(0,135,246,0.1)]",
				"outline-none group",
				isLoading && "opacity-60 pointer-events-none",
			)}
		>
			{/* Category badge */}
			<span className="pointer-events-none absolute right-3 top-0 -translate-y-[6px] shrink-0 rounded-full bg-[rgba(45,54,76,1)] px-2 py-[2px] text-[10px] text-text/70">
				{template.category}
			</span>

			{/* Icon + Title */}
			<div className="flex items-center gap-3">
				<div className="w-9 h-9 rounded-lg bg-[rgba(0,135,246,0.1)] border border-[rgba(0,135,246,0.15)] flex items-center justify-center shrink-0">
					<Icon className="h-4 w-4 text-[rgba(120,180,255,0.7)]" />
				</div>
				<span className="font-medium text-[13px] text-text/90 truncate group-hover:text-text">
					{template.name}
				</span>
			</div>

			{/* Description */}
			{template.description && (
				<p className="text-text-muted/60 text-[11px] leading-relaxed line-clamp-2 min-h-[30px]">
					{template.description}
				</p>
			)}

			{/* Tags */}
			<div className="flex items-center gap-1.5 flex-wrap mt-0.5">
				{template.tags.slice(0, 3).map((tag) => (
					<span
						key={tag}
						className="rounded-full bg-white/5 px-2 py-[1px] text-[10px] text-text-muted/50"
					>
						{tag}
					</span>
				))}
				{template.useCount > 0 && (
					<span className="text-[10px] text-text-muted/40 ml-auto">
						{template.useCount} uses
					</span>
				)}
			</div>
		</button>
	);
}

export function TemplateGallery({
	onSelectTemplate,
}: {
	onSelectTemplate: (prompt: string) => void;
}) {
	const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isUsing, setIsUsing] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedCategory, setSelectedCategory] = useState("all");
	const [error, setError] = useState<string | null>(null);

	// Fetch templates on mount
	useEffect(() => {
		let cancelled = false;
		async function fetchTemplates() {
			try {
				const params = new URLSearchParams();
				if (selectedCategory !== "all") {
					params.set("category", selectedCategory);
				}
				if (searchQuery.trim()) {
					params.set("search", searchQuery.trim());
				}
				params.set("limit", "60");

				const res = await fetch(`/api/workflow-templates?${params}`);
				if (!res.ok) throw new Error("Failed to fetch templates");
				const data = await res.json();
				if (!cancelled) {
					setTemplates(data.templates ?? []);
					setError(null);
				}
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : "Failed to load templates");
				}
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		}
		setIsLoading(true);
		fetchTemplates();
		return () => { cancelled = true; };
	}, [selectedCategory, searchQuery]);

	const handleUseTemplate = useCallback(
		async (template: WorkflowTemplate) => {
			setIsUsing(true);
			try {
				// Increment use count
				await fetch(`/api/workflow-templates/${template.dbId}/use`, {
					method: "POST",
				});

				// Send the template name as a prompt to the AI workflow builder
				const prompt = `Create a workflow based on this template: "${template.name}". ${template.description ?? ""}`;
				onSelectTemplate(prompt);
			} catch {
				// Still navigate even if use-count increment fails
				const prompt = `Create a workflow: ${template.name}. ${template.description ?? ""}`;
				onSelectTemplate(prompt);
			} finally {
				setIsUsing(false);
			}
		},
		[onSelectTemplate],
	);

	const filteredTemplates = useMemo(() => {
		if (!searchQuery.trim()) return templates;
		const q = searchQuery.toLowerCase();
		return templates.filter(
			(t) =>
				t.name.toLowerCase().includes(q) ||
				(t.description?.toLowerCase().includes(q) ?? false) ||
				t.tags.some((tag) => tag.toLowerCase().includes(q)),
		);
	}, [templates, searchQuery]);

	return (
		<div className="w-full max-w-[960px] mx-auto">
			{/* Header */}
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-[14px] font-medium text-text-muted/80">
					Template Gallery
				</h3>
				{/* Search */}
				<div className="relative">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted/40" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search templates..."
						className="w-[200px] rounded-lg border border-blue-muted/20 bg-[rgba(131,157,195,0.05)] pl-9 pr-3 py-1.5 text-[12px] text-text placeholder:text-text-muted/40 outline-none focus:border-blue-muted/40 transition-colors"
					/>
				</div>
			</div>

			{/* Category tabs */}
			<div className="flex gap-1 mb-5 overflow-x-auto pb-1 scrollbar-none">
				{CATEGORIES.map((cat) => {
					const CatIcon = cat.icon;
					const isSelected = selectedCategory === cat.id;
					return (
						<button
							key={cat.id}
							type="button"
							onClick={() => setSelectedCategory(cat.id)}
							className={clsx(
								"flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all whitespace-nowrap",
								isSelected
									? "bg-[rgba(0,135,246,0.15)] text-[rgba(120,180,255,0.9)] border border-[rgba(0,135,246,0.25)]"
									: "bg-transparent text-text-muted/50 hover:text-text-muted/70 hover:bg-white/5 border border-transparent",
							)}
						>
							<CatIcon className="h-3 w-3" />
							{cat.label}
						</button>
					);
				})}
			</div>

			{/* Template grid */}
			{isLoading ? (
				<div className="flex items-center justify-center py-12">
					<Loader2 className="h-5 w-5 animate-spin text-text-muted/40" />
					<span className="ml-2 text-[12px] text-text-muted/40">
						Loading templates...
					</span>
				</div>
			) : error ? (
				<div className="text-center py-12">
					<p className="text-[12px] text-red-400/70">{error}</p>
				</div>
			) : filteredTemplates.length === 0 ? (
				<div className="text-center py-12">
					<Workflow className="h-8 w-8 text-text-muted/20 mx-auto mb-3" />
					<p className="text-[13px] text-text-muted/50">
						{searchQuery ? "No templates match your search" : "No templates yet"}
					</p>
					<p className="text-[11px] text-text-muted/30 mt-1">
						Describe your workflow below to build one from scratch
					</p>
				</div>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
					{filteredTemplates.map((template) => (
						<TemplateCard
							key={template.dbId}
							template={template}
							onUse={handleUseTemplate}
							isLoading={isUsing}
						/>
					))}
				</div>
			)}
		</div>
	);
}
