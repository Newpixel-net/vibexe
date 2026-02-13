"use client";

import clsx from "clsx/lite";

export type EditorTab = "editor" | "executions" | "sharing" | "settings";

interface V2HeaderTabsProps {
	activeTab: EditorTab;
	onTabChange: (tab: EditorTab) => void;
}

const tabs: { id: EditorTab; label: string }[] = [
	{ id: "editor", label: "Editor" },
	{ id: "executions", label: "Executions" },
	{ id: "settings", label: "Settings" },
	{ id: "sharing", label: "Sharing" },
];

export function V2HeaderTabs({ activeTab, onTabChange }: V2HeaderTabsProps) {
	return (
		<div className="flex items-center gap-[2px] rounded-[8px] bg-white/5 p-[2px]">
			{tabs.map((tab) => (
				<button
					key={tab.id}
					type="button"
					onClick={() => onTabChange(tab.id)}
					className={clsx(
						"px-[12px] py-[4px] rounded-[6px] text-[12px] font-medium transition-all duration-150",
						"outline-none",
						activeTab === tab.id
							? "bg-[#6B8FF0]/20 text-[#6B8FF0] shadow-[0_0_8px_rgba(107,143,240,0.15)]"
							: "text-inverse/50 hover:text-inverse/80 hover:bg-white/5",
					)}
				>
					{tab.label}
				</button>
			))}
		</div>
	);
}
