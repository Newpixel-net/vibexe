"use client";

import { Layers, Smartphone, Globe, Sparkles } from "lucide-react";
import Link from "next/link";
import type { EnhancedApp } from "@/lib/dashboard/get-dashboard-data";

const TYPE_ICONS: Record<string, React.ElementType> = {
	app: Layers,
	mobile: Smartphone,
	landing: Globe,
};

interface RecentProjectsProps {
	apps: EnhancedApp[];
	selectedType: string;
}

export function RecentProjects({ apps, selectedType }: RecentProjectsProps) {
	// Show up to 4 most recent apps
	const visible = apps.slice(0, 4);

	if (visible.length === 0) return null;

	const Icon = TYPE_ICONS[selectedType] ?? Layers;

	// Check if app was created within last 24 hours
	const isNew = (createdAt: string) => {
		return Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000;
	};

	return (
		<div className="flex items-center gap-2 flex-wrap justify-center mt-5 dash-animate-fade-up" style={{ animationDelay: "0.3s" }}>
			{visible.map((app) => (
				<Link
					key={app.id}
					href={`/app-builder/${app.id}`}
					className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.04] border border-white/[0.06] text-[13px] text-white/50 hover:text-white/70 hover:bg-white/[0.08] hover:border-white/[0.1] transition-all group"
				>
					<Icon className="h-3.5 w-3.5 text-white/25 group-hover:text-white/40 transition-colors" />
					<span className="truncate max-w-[140px]">{app.name}</span>
					{isNew(app.createdAt) && (
						<span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-400">
							<Sparkles className="h-2 w-2" />
							New
						</span>
					)}
				</Link>
			))}
		</div>
	);
}
