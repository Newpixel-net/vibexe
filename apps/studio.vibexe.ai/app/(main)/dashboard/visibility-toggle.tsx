"use client";

import { Globe, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type Visibility = "public" | "private";

interface VisibilityToggleProps {
	value: Visibility;
	onChange: (v: Visibility) => void;
}

export function VisibilityToggle({ value, onChange }: VisibilityToggleProps) {
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

	const isPublic = value === "public";
	const Icon = isPublic ? Globe : Lock;

	return (
		<div className="relative" ref={ref}>
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] text-white/50 hover:text-white/70 hover:bg-white/[0.06] transition-all"
			>
				<Icon className="h-3.5 w-3.5" />
				<span>{isPublic ? "Public" : "Private"}</span>
			</button>

			{isOpen && (
				<div className="absolute bottom-full right-0 mb-2 w-[260px] rounded-xl border border-white/[0.1] bg-[#1a1a2e]/95 backdrop-blur-xl shadow-2xl shadow-black/60 p-2 z-50">
					<div className="px-2 py-1.5 text-[10px] font-medium text-white/25 uppercase tracking-wider">
						Visibility
					</div>

					<button
						type="button"
						onClick={() => { onChange("public"); setIsOpen(false); }}
						className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
							isPublic ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"
						}`}
					>
						<Globe className={`h-4 w-4 mt-0.5 flex-shrink-0 ${isPublic ? "text-blue-400" : "text-white/30"}`} />
						<div>
							<p className={`text-[13px] font-medium ${isPublic ? "text-white/90" : "text-white/60"}`}>
								Public
							</p>
							<p className="text-[11px] text-white/30 mt-0.5">
								Anyone can view and explore your project
							</p>
						</div>
					</button>

					<button
						type="button"
						onClick={() => { onChange("private"); setIsOpen(false); }}
						className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
							!isPublic ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"
						}`}
					>
						<Lock className={`h-4 w-4 mt-0.5 flex-shrink-0 ${!isPublic ? "text-blue-400" : "text-white/30"}`} />
						<div>
							<p className={`text-[13px] font-medium ${!isPublic ? "text-white/90" : "text-white/60"}`}>
								Private
							</p>
							<p className="text-[11px] text-white/30 mt-0.5">
								Only visible to yourself, unless shared
							</p>
						</div>
					</button>
				</div>
			)}
		</div>
	);
}
