"use client";

import clsx from "clsx/lite";
import { useState, type ReactNode } from "react";

interface PanelTabsProps {
	defaultTab?: string;
	tabs: { id: string; label: string; content: ReactNode }[];
}

export function PanelTabs({ defaultTab, tabs }: PanelTabsProps) {
	const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id ?? "");

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<div className="flex shrink-0 border-b border-[hsla(0,0%,100%,0.08)] px-[8px]">
				{tabs.map((tab) => (
					<button
						key={tab.id}
						type="button"
						onClick={() => setActiveTab(tab.id)}
						className={clsx(
							"px-[12px] py-[6px] text-[13px] transition-colors relative",
							activeTab === tab.id
								? "text-inverse"
								: "text-[hsla(0,0%,100%,0.45)] hover:text-[hsla(0,0%,100%,0.7)]",
						)}
					>
						{tab.label}
						{activeTab === tab.id && (
							<div className="absolute bottom-0 left-[12px] right-[12px] h-[2px] bg-primary-900 rounded-full" />
						)}
					</button>
				))}
			</div>
			<div className="flex-1 overflow-y-auto">
				{tabs.find((t) => t.id === activeTab)?.content}
			</div>
		</div>
	);
}
