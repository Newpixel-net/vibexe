"use client";

import { Sparkles, X } from "lucide-react";
import { useState } from "react";

export function PromoBanner() {
	const [dismissed, setDismissed] = useState(false);

	if (dismissed) return null;

	return (
		<div className="relative flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500/10 via-violet-500/10 to-cyan-500/10 border border-white/[0.06] mb-6 dash-animate-fade-up">
			<Sparkles className="h-3.5 w-3.5 text-blue-400/60 flex-shrink-0" />
			<p className="text-[12px] text-white/50">
				<span className="text-white/70 font-medium">New:</span>{" "}
				Multi-agent pipeline, GitHub sync, and 600+ integrations are now live!
			</p>
			<button
				type="button"
				onClick={() => setDismissed(true)}
				className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded flex items-center justify-center text-white/20 hover:text-white/40 transition-colors"
			>
				<X className="h-3 w-3" />
			</button>
		</div>
	);
}
