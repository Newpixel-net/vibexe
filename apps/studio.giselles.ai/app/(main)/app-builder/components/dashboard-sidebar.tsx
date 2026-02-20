"use client";

/**
 * DashboardSidebar Component
 *
 * Navigation sidebar for the Dashboard panel with expandable sections.
 * Settings has sub-items: App Settings, Authentication, App Template.
 * Data section shows entity sub-items when schema is available.
 */

import type { LucideIcon } from "lucide-react";
import {
	BarChart3,
	Bot,
	ChevronDown,
	Code2,
	Database,
	FileText,
	Globe,
	Home,
	Key,
	Puzzle,
	Settings,
	Shield,
	Users,
	Zap,
} from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/**
 * Available sections in the dashboard sidebar.
 * Settings sub-items use "settings-xxx" pattern.
 */
export type DashboardSection =
	| "overview"
	| "users"
	| "data"
	| "analytics"
	| "domains"
	| "integrations"
	| "security"
	| "code"
	| "agents"
	| "automations"
	| "logs"
	| "api"
	| "settings"
	| "settings-app"
	| "settings-auth"
	| "settings-backend"
	| "settings-export"
	| "settings-template";

interface NavItem {
	id: DashboardSection;
	label: string;
	icon: LucideIcon;
	children?: Array<{ id: DashboardSection; label: string }>;
}

const navItems: NavItem[] = [
	{ id: "overview", label: "Overview", icon: Home },
	{ id: "users", label: "Users", icon: Users },
	{ id: "data", label: "Data", icon: Database },
	{ id: "analytics", label: "Analytics", icon: BarChart3 },
	{ id: "domains", label: "Domains", icon: Globe },
	{ id: "integrations", label: "Integrations", icon: Puzzle },
	{ id: "security", label: "Security", icon: Shield },
	{ id: "code", label: "Code", icon: Code2 },
	{ id: "agents", label: "Agents", icon: Bot },
	{ id: "automations", label: "Automations", icon: Zap },
	{ id: "logs", label: "Logs", icon: FileText },
	{ id: "api", label: "API", icon: Key },
	{
		id: "settings",
		label: "Settings",
		icon: Settings,
		children: [
			{ id: "settings-app", label: "App Settings" },
			{ id: "settings-auth", label: "Authentication" },
			{ id: "settings-backend", label: "Backend" },
			{ id: "settings-export", label: "Export" },
			{ id: "settings-template", label: "App Template" },
		],
	},
];

interface DashboardSidebarProps {
	activeSection: DashboardSection;
	onSectionChange: (section: DashboardSection) => void;
}

export function DashboardSidebar({
	activeSection,
	onSectionChange,
}: DashboardSidebarProps) {
	const [expandedItems, setExpandedItems] = useState<Set<string>>(() => {
		// Auto-expand settings if a settings sub-item is active
		const initial = new Set<string>();
		if (activeSection.startsWith("settings")) initial.add("settings");
		return initial;
	});

	const toggleExpand = (id: string) => {
		setExpandedItems((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	return (
		<div className="w-[200px] border-r border-white/[0.06] backdrop-blur-xl bg-white/[0.02]">
			<ScrollArea className="h-full">
				<nav className="p-2 space-y-0.5">
					{navItems.map((item) => {
						const Icon = item.icon;
						const hasChildren = item.children && item.children.length > 0;
						const isExpanded = expandedItems.has(item.id);
						const isActive =
							activeSection === item.id ||
							(hasChildren &&
								item.children!.some((c) => c.id === activeSection));

						return (
							<div key={item.id}>
								<button
									type="button"
									onClick={() => {
										if (hasChildren) {
											toggleExpand(item.id);
											if (
												!item.children!.some(
													(c) => c.id === activeSection,
												)
											) {
												onSectionChange(item.children![0].id);
											}
										} else {
											onSectionChange(item.id);
										}
									}}
									className={cn(
										"w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150",
										isActive && !hasChildren
											? "bg-white/[0.08] text-white/90 font-medium border-l-2 border-violet-400 pl-[10px] shadow-[0_0_12px_rgba(124,58,237,0.08)]"
											: isActive && hasChildren
												? "text-white/90 font-medium"
												: "text-white/40 hover:text-white/70 hover:bg-white/[0.06]",
									)}
								>
									<Icon className="h-4 w-4 shrink-0" />
									<span className="truncate flex-1 text-left">
										{item.label}
									</span>
									{hasChildren && (
										<ChevronDown
											className={cn(
												"h-3.5 w-3.5 transition-transform",
												isExpanded && "rotate-180",
											)}
										/>
									)}
								</button>
								{hasChildren && isExpanded && (
									<div className="ml-4 mt-0.5 space-y-0.5">
										{item.children!.map((child) => (
											<button
												type="button"
												key={child.id}
												onClick={() => onSectionChange(child.id)}
												className={cn(
													"w-full flex items-center px-3 py-1.5 rounded-lg text-sm transition-all duration-150",
													activeSection === child.id
														? "bg-white/[0.08] text-white/90 font-medium border-l-2 border-violet-400 pl-[10px] shadow-[0_0_12px_rgba(124,58,237,0.08)]"
														: "text-white/40 hover:text-white/70 hover:bg-white/[0.06]",
												)}
											>
												<span className="truncate">
													{child.label}
												</span>
											</button>
										))}
									</div>
								)}
							</div>
						);
					})}
				</nav>
			</ScrollArea>
		</div>
	);
}
