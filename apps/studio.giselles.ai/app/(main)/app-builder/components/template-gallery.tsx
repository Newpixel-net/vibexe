"use client";

/**
 * TemplateGallery Component
 *
 * Modal that shows available templates when creating a new app.
 * Users can browse/search templates or start from scratch.
 */

import {
	Dialog,
	DialogBody,
	DialogClose,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@giselle-internal/ui/dialog";
import {
	FileCode2,
	Loader2,
	Plus,
	Search,
	Sparkles,
	X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

interface TemplateItem {
	id: string;
	name: string;
	description: string | null;
	category: string;
	tags: string[];
	useCount: number;
	fileCount: number;
	entityCount: number;
}

interface TemplateGalleryProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	createAppAction: () => Promise<void>;
}

const CATEGORY_ICONS: Record<string, string> = {
	"Project Management": "clipboard-list",
	"E-Commerce": "shopping-cart",
	Dashboard: "layout-dashboard",
	CRM: "users",
	Social: "message-circle",
	"Content Management": "file-text",
	Education: "book-open",
	Analytics: "bar-chart-2",
	Communication: "mail",
	Utility: "wrench",
	Other: "box",
};

export function TemplateGallery({
	open,
	onOpenChange,
	createAppAction,
}: TemplateGalleryProps) {
	const router = useRouter();
	const [templates, setTemplates] = useState<TemplateItem[]>([]);
	const [categories, setCategories] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
	const [cloning, setCloning] = useState<string | null>(null);
	const [isCreating, startCreating] = useTransition();

	const fetchTemplates = useCallback(async () => {
		setLoading(true);
		try {
			const params = new URLSearchParams();
			if (selectedCategory) params.set("category", selectedCategory);
			if (search.trim()) params.set("search", search.trim());
			params.set("limit", "50");

			const res = await fetch(`/api/app-templates?${params}`);
			const data = await res.json();
			setTemplates(data.templates ?? []);
			setCategories(data.categories ?? []);
		} catch {
			setTemplates([]);
		} finally {
			setLoading(false);
		}
	}, [selectedCategory, search]);

	useEffect(() => {
		if (open) fetchTemplates();
	}, [open, fetchTemplates]);

	// Debounced search
	const [searchInput, setSearchInput] = useState("");
	useEffect(() => {
		const timer = setTimeout(() => setSearch(searchInput), 300);
		return () => clearTimeout(timer);
	}, [searchInput]);

	const handleStartFromScratch = useCallback(() => {
		startCreating(async () => {
			await createAppAction();
			onOpenChange(false);
		});
	}, [createAppAction, onOpenChange]);

	const handleClone = useCallback(
		async (templateId: string, templateName: string) => {
			setCloning(templateId);
			try {
				const res = await fetch(`/api/app-templates/${templateId}/clone`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name: templateName }),
				});
				if (res.ok) {
					const data = await res.json();
					onOpenChange(false);
					router.push(data.redirectPath);
				}
			} finally {
				setCloning(null);
			}
		},
		[router, onOpenChange],
	);

	// Filter categories that have templates
	const availableCategories = useMemo(() => {
		const templateCategories = new Set(templates.map((t) => t.category));
		return categories.filter(
			(c) => !selectedCategory || templateCategories.has(c),
		);
	}, [categories, templates, selectedCategory]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent variant="glass" className="max-w-[800px] min-h-[500px]">
				<DialogHeader>
					<div className="flex items-center justify-between">
						<DialogTitle className="font-sans text-[20px] font-medium tracking-tight text-inverse">
							Create New App
						</DialogTitle>
						<DialogClose className="rounded-sm text-inverse opacity-70 hover:opacity-100 focus:outline-none">
							<X className="h-5 w-5" />
							<span className="sr-only">Close</span>
						</DialogClose>
					</div>
				</DialogHeader>

				<DialogBody>
					{/* Search */}
					<div className="relative mb-4">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
						<input
							type="text"
							value={searchInput}
							onChange={(e) => setSearchInput(e.target.value)}
							placeholder="Search templates..."
							className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm placeholder:text-white/20 focus:outline-none focus:border-white/20"
						/>
					</div>

					<div className="flex gap-4 min-h-[380px]">
						{/* Category Sidebar */}
						<div className="w-[160px] flex-shrink-0 space-y-1">
							<button
								type="button"
								onClick={() => setSelectedCategory(null)}
								className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
									!selectedCategory
										? "bg-white/[0.1] text-white/90 font-medium"
										: "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
								}`}
							>
								All
							</button>
							{categories.map((cat) => (
								<button
									key={cat}
									type="button"
									onClick={() =>
										setSelectedCategory(
											selectedCategory === cat ? null : cat,
										)
									}
									className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
										selectedCategory === cat
											? "bg-white/[0.1] text-white/90 font-medium"
											: "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
									}`}
								>
									{cat}
								</button>
							))}
						</div>

						{/* Template Grid */}
						<div className="flex-1 space-y-3 overflow-y-auto max-h-[400px] pr-1">
							{/* Start from Scratch - always first */}
							<button
								type="button"
								onClick={handleStartFromScratch}
								disabled={isCreating}
								className="w-full flex items-center gap-4 p-4 rounded-xl border border-dashed border-white/[0.12] hover:border-white/[0.2] bg-white/[0.02] hover:bg-white/[0.04] transition-all text-left group"
							>
								<div className="h-11 w-11 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-white/[0.08] flex items-center justify-center flex-shrink-0">
									{isCreating ? (
										<Loader2 className="h-5 w-5 text-white/60 animate-spin" />
									) : (
										<Sparkles className="h-5 w-5 text-white/60 group-hover:text-white/80 transition-colors" />
									)}
								</div>
								<div>
									<span className="text-sm font-medium text-white/80 group-hover:text-white/90">
										Start from Scratch
									</span>
									<p className="text-xs text-white/30 mt-0.5">
										Blank canvas — describe your app and AI will build it
									</p>
								</div>
							</button>

							{loading ? (
								<div className="flex items-center justify-center py-12">
									<Loader2 className="h-6 w-6 animate-spin text-white/30" />
								</div>
							) : templates.length === 0 ? (
								<div className="text-center py-12 text-white/30 text-sm">
									{search.trim()
										? "No templates match your search"
										: "No templates available yet"}
								</div>
							) : (
								templates.map((t) => (
									<div
										key={t.id}
										className="flex items-start gap-4 p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] transition-all group"
									>
										<div className="h-11 w-11 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
											<FileCode2 className="h-5 w-5 text-white/40" />
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-start justify-between gap-2">
												<div className="min-w-0">
													<h3 className="text-sm font-medium text-white/80 truncate">
														{t.name}
													</h3>
													{t.description && (
														<p className="text-xs text-white/30 mt-0.5 line-clamp-2">
															{t.description}
														</p>
													)}
													<div className="flex items-center gap-3 mt-2">
														<span className="text-xs text-white/20">
															{t.fileCount} files
														</span>
														{t.entityCount > 0 && (
															<span className="text-xs text-white/20">
																{t.entityCount} entities
															</span>
														)}
														{t.useCount > 0 && (
															<span className="text-xs text-white/20">
																{t.useCount} clones
															</span>
														)}
														<span className="text-xs text-white/15 px-1.5 py-0.5 rounded bg-white/[0.04]">
															{t.category}
														</span>
													</div>
												</div>
												<button
													type="button"
													onClick={() => handleClone(t.id, t.name)}
													disabled={cloning === t.id}
													className="flex-shrink-0 px-3 py-1.5 rounded-md bg-white/[0.08] border border-white/[0.08] text-white/70 text-xs font-medium hover:bg-white/[0.12] hover:text-white/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
												>
													{cloning === t.id ? (
														<>
															<Loader2 className="h-3 w-3 animate-spin" />
															Cloning...
														</>
													) : (
														<>
															<Plus className="h-3 w-3" />
															Use Template
														</>
													)}
												</button>
											</div>
										</div>
									</div>
								))
							)}
						</div>
					</div>
				</DialogBody>
			</DialogContent>
		</Dialog>
	);
}
