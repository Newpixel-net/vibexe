"use client";

import { LayoutTemplateIcon, ArrowRightIcon, TagIcon } from "lucide-react";
import { useState } from "react";

interface TemplateCardProps {
	template: {
		dbId: number;
		name: string;
		description: string | null;
		category: string;
		tags: string[];
		useCount: number;
		authorName: string | null;
	};
	onUse: (templateDbId: number) => Promise<void>;
}

export function TemplateCard({ template, onUse }: TemplateCardProps) {
	const [loading, setLoading] = useState(false);

	const handleUse = async () => {
		setLoading(true);
		try {
			await onUse(template.dbId);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="group relative rounded-xl border border-border-muted bg-surface hover:border-primary/30 transition-all overflow-hidden">
			{/* Thumbnail placeholder */}
			<div className="h-[120px] bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center">
				<LayoutTemplateIcon className="size-8 text-primary/30" />
			</div>

			{/* Content */}
			<div className="p-4">
				<div className="flex items-start justify-between gap-2">
					<h3 className="text-[14px] font-semibold text-text/90 line-clamp-1">
						{template.name}
					</h3>
					<span className="shrink-0 text-[10px] text-text/30 bg-surface-variant px-2 py-0.5 rounded-full">
						{template.category}
					</span>
				</div>

				{template.description && (
					<p className="text-[12px] text-text/50 mt-1 line-clamp-2">
						{template.description}
					</p>
				)}

				{/* Tags */}
				{template.tags.length > 0 && (
					<div className="flex flex-wrap gap-1 mt-2">
						{template.tags.slice(0, 3).map((tag) => (
							<span
								key={tag}
								className="inline-flex items-center gap-0.5 text-[10px] text-text/40 bg-surface-variant px-1.5 py-0.5 rounded"
							>
								<TagIcon className="size-2.5" />
								{tag}
							</span>
						))}
					</div>
				)}

				{/* Footer */}
				<div className="flex items-center justify-between mt-3 pt-3 border-t border-border-muted">
					<div className="flex items-center gap-2">
						{template.authorName && (
							<span className="text-[10px] text-text/30">
								by {template.authorName}
							</span>
						)}
						<span className="text-[10px] text-text/20">
							{template.useCount} uses
						</span>
					</div>
					<button
						type="button"
						onClick={handleUse}
						disabled={loading}
						className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary text-[11px] font-medium rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
					>
						{loading ? "Creating..." : "Use Template"}
						<ArrowRightIcon className="size-3" />
					</button>
				</div>
			</div>
		</div>
	);
}
