"use client";

import { ChevronDown, Plus, Settings, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface ProjectSelectorProps {
	teamName: string;
	teamPlan: string;
}

export function ProjectSelector({ teamName, teamPlan }: ProjectSelectorProps) {
	const [isOpen, setIsOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isOpen) return;
		const handler = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [isOpen]);

	return (
		<div className="relative inline-block" ref={ref}>
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/[0.04] transition-colors group"
			>
				{/* Team avatar */}
				<div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500/30 to-cyan-400/30 flex items-center justify-center flex-shrink-0">
					<span className="text-[11px] font-bold text-white/60">
						{teamName.charAt(0).toUpperCase()}
					</span>
				</div>
				<div className="text-left">
					<span className="text-[14px] font-medium text-white/70 group-hover:text-white/90 transition-colors">
						{teamName}
					</span>
				</div>
				<ChevronDown className={`h-3.5 w-3.5 text-white/25 transition-transform ${isOpen ? "rotate-180" : ""}`} />
			</button>

			{isOpen && (
				<div className="absolute top-full left-0 mt-1 w-[250px] rounded-xl border border-white/[0.1] bg-[#1a1a2e]/95 backdrop-blur-xl shadow-2xl shadow-black/60 p-1.5 z-50">
					{/* Current team */}
					<div className="px-3 py-2.5 rounded-lg bg-white/[0.06]">
						<div className="flex items-center gap-2">
							<div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500/30 to-cyan-400/30 flex items-center justify-center">
								<span className="text-[12px] font-bold text-white/60">
									{teamName.charAt(0).toUpperCase()}
								</span>
							</div>
							<div className="flex-1 min-w-0">
								<p className="text-[13px] font-medium text-white/80 truncate">{teamName}</p>
								<div className="flex items-center gap-1.5 mt-0.5">
									<span className="text-[10px] text-white/30 capitalize">{teamPlan} plan</span>
								</div>
							</div>
						</div>
					</div>

					{/* Actions */}
					<div className="mt-1.5 pt-1.5 border-t border-white/[0.06]">
						<Link
							href="/settings/team"
							onClick={() => setIsOpen(false)}
							className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] text-white/40 hover:text-white/60 hover:bg-white/[0.05] transition-colors"
						>
							<Settings className="h-3.5 w-3.5" />
							Team Settings
						</Link>
						<Link
							href="/settings/team/members"
							onClick={() => setIsOpen(false)}
							className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] text-white/40 hover:text-white/60 hover:bg-white/[0.05] transition-colors"
						>
							<Users className="h-3.5 w-3.5" />
							Manage Members
						</Link>
						<button
							type="button"
							onClick={() => setIsOpen(false)}
							className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] text-blue-400/70 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
						>
							<Plus className="h-3.5 w-3.5" />
							Create New Project
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
