"use client";

/**
 * SkillBadge Component
 *
 * Small pill showing a loaded skill name with category-based coloring.
 * Displayed below agent activity cards.
 */

import { cn } from "@/lib/utils";

interface SkillBadgeProps {
	skill: {
		id: string;
		name: string;
		category: string;
	};
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
	framework: { bg: "bg-blue-500/10", text: "text-blue-400" },
	database: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
	workflow: { bg: "bg-purple-500/10", text: "text-purple-400" },
	infrastructure: { bg: "bg-orange-500/10", text: "text-orange-400" },
	specialized: { bg: "bg-pink-500/10", text: "text-pink-400" },
};

export function SkillBadge({ skill }: SkillBadgeProps) {
	const colors = CATEGORY_COLORS[skill.category] || {
		bg: "bg-muted",
		text: "text-muted-foreground",
	};

	return (
		<span
			className={cn(
				"inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
				colors.bg,
				colors.text,
			)}
			title={`${skill.name} (${skill.category})`}
		>
			{skill.name}
		</span>
	);
}
