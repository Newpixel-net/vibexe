"use client";

/**
 * HeroPrompt Component — Emergent-style chat input
 *
 * Connected tabs sitting on top of a dark card, multi-line textarea,
 * rich bottom toolbar, and recent project pills below.
 */

import {
	AlertCircle,
	ArrowRight,
	Github,
	Globe,
	Layers,
	Loader2,
	Mic,
	Paperclip,
	SlidersHorizontal,
	Smartphone,
	Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	useCallback,
	useMemo,
	useRef,
	useState,
} from "react";
import type { EnhancedApp } from "@/lib/dashboard/get-dashboard-data";
import { PROJECT_TYPES, getPlaceholdersForType } from "./prompt-data";
import { useTypewriter } from "./use-typewriter";
import { ModelPicker } from "./model-picker";
import { VisibilityToggle, type Visibility } from "./visibility-toggle";
import { AdvancedControls } from "./advanced-controls";
import { GitHubImportModal } from "./github-import-modal";

const ICON_MAP: Record<string, React.ElementType> = {
	Layers,
	Smartphone,
	Globe,
};

interface HeroPromptProps {
	recentApps?: EnhancedApp[];
}

export function HeroPrompt({ recentApps = [] }: HeroPromptProps) {
	const router = useRouter();
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [selectedType, setSelectedType] = useState("app");
	const [prompt, setPrompt] = useState("");
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [modelId, setModelId] = useState("claude-sonnet-4-5");
	const [visibility, setVisibility] = useState<Visibility>("public");
	const [advancedOpen, setAdvancedOpen] = useState(false);
	const [githubOpen, setGithubOpen] = useState(false);

	// Get relevant placeholders based on selected type
	const placeholders = useMemo(
		() => getPlaceholdersForType(selectedType),
		[selectedType],
	);

	const { text: typewriterText } = useTypewriter(placeholders);

	// Handle Generate click
	const handleGenerate = useCallback(async () => {
		const trimmed = prompt.trim();
		if (!trimmed || isGenerating) return;

		setIsGenerating(true);
		setError(null);
		try {
			if (selectedType === "workflow") {
				router.push(
					`/playground?prompt=${encodeURIComponent(trimmed)}&type=${selectedType}`,
				);
				setTimeout(() => setIsGenerating(false), 5000);
				return;
			}
			const res = await fetch("/api/app-builder/apps", { method: "POST" });
			if (res.ok) {
				const data = await res.json();
				if (data.redirectPath) {
					router.push(
						`${data.redirectPath}?prompt=${encodeURIComponent(trimmed)}&type=${selectedType}`,
					);
					setTimeout(() => setIsGenerating(false), 5000);
					return;
				}
			}
			setError("Failed to create app. Please try again.");
		} catch {
			setError("Network error. Please check your connection.");
		}
		setIsGenerating(false);
	}, [prompt, selectedType, isGenerating, router]);

	// Handle Enter key (without Shift)
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleGenerate();
			}
		},
		[handleGenerate],
	);

	// Auto-resize textarea
	const handleInput = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			setPrompt(e.target.value);
			setError(null);
			const el = e.target;
			el.style.height = "auto";
			el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
		},
		[],
	);

	// Toast for coming-soon features
	const showComingSoon = useCallback(() => {
		setError("Coming soon!");
		setTimeout(() => setError(null), 2000);
	}, []);

	// Check if app was created within last 24 hours
	const isNew = (createdAt: string) => {
		return Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000;
	};

	const visibleApps = recentApps.slice(0, 4);

	return (
		<section className="mb-8">
			<div className="max-w-3xl mx-auto">
				{/* Caption — gradient heading + subtitle */}
				<div className="text-center mb-8 dash-animate-fade-up">
					<h1
						className="text-[38px] font-bold tracking-tight leading-tight dash-animate-gradient bg-clip-text text-transparent"
						style={{
							backgroundImage: "linear-gradient(135deg, hsl(219, 90%, 72%), hsl(178, 94%, 60%), hsl(219, 90%, 72%))",
							backgroundSize: "200% 200%",
						}}
					>
						Describe it. Deploy it.
					</h1>
					<p className="text-white/40 text-[15px] mt-2.5 max-w-lg mx-auto">
						Tell us what you want to build — AI handles the rest
					</p>
				</div>

				{/* ============================================================ */}
				{/* CONNECTED TABS + CARD                                        */}
				{/* ============================================================ */}
				<div className="dash-animate-fade-up relative rounded-2xl" style={{ animationDelay: "0.05s" }}>
					{/* Tab row — segmented control style, connected to card below */}
					<div className="flex items-stretch rounded-t-2xl overflow-hidden border border-b-0 border-white/[0.08] bg-[rgba(20,20,24,0.6)]">
						{PROJECT_TYPES.map((type, idx) => {
							const Icon = ICON_MAP[type.icon] ?? Layers;
							const isActive = selectedType === type.id;
							return (
								<button
									key={type.id}
									type="button"
									aria-pressed={isActive}
									onClick={() => setSelectedType(type.id)}
									className={`
										flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 text-[14px] font-medium
										transition-all duration-300 relative
										${idx > 0 ? "border-l border-white/[0.06]" : ""}
										${
											isActive
												? "bg-[rgba(28,28,32,0.95)] text-white/95"
												: "text-white/35 hover:text-white/60 hover:bg-white/[0.03]"
										}
									`}
								>
									<Icon className={`h-4 w-4 transition-all duration-300 ${isActive ? "text-cyan-400/80" : ""}`} />
									{type.label}
									{/* Active indicator — glowing accent line at bottom */}
									{isActive && (
										<span
											className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
											style={{
												background: "linear-gradient(90deg, transparent, hsl(178, 80%, 55%), transparent)",
												boxShadow: "0 0 8px hsl(178, 80%, 55%, 0.4)",
											}}
										/>
									)}
								</button>
							);
						})}
					</div>

					{/* Card body — connects seamlessly to tab row above */}
					<div className="bg-[rgba(28,28,32,0.95)] border border-white/[0.08] border-t-0 rounded-b-2xl">
						{/* Textarea */}
						<div className="px-5 pt-4 pb-2">
							<textarea
								ref={textareaRef}
								value={prompt}
								onChange={handleInput}
								onKeyDown={handleKeyDown}
								placeholder={typewriterText || "Describe your project..."}
								aria-label="Describe your project"
								maxLength={2000}
								rows={3}
								className="w-full bg-transparent text-white/90 text-[15px] placeholder:text-white/25 resize-none focus:outline-none min-h-[80px] max-h-[200px] leading-relaxed"
								style={{ fontFamily: "var(--font-sans)" }}
							/>
						</div>

						{/* Bottom Toolbar */}
						<div className="flex items-center justify-between px-3 py-2.5 border-t border-white/[0.06]">
							{/* Left tools */}
							<div className="flex items-center gap-0.5">
								{/* Attach */}
								<button
									type="button"
									onClick={showComingSoon}
									className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] text-white/35 hover:text-white/55 hover:bg-white/[0.06] transition-all"
									title="Attach files"
								>
									<Paperclip className="h-3.5 w-3.5" />
								</button>

								{/* GitHub */}
								<button
									type="button"
									onClick={() => setGithubOpen(true)}
									className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] text-white/35 hover:text-white/55 hover:bg-white/[0.06] transition-all"
									title="Import from GitHub"
								>
									<Github className="h-3.5 w-3.5" />
								</button>

								{/* Divider */}
								<div className="h-4 w-px bg-white/[0.06] mx-1" />

								{/* Model Picker */}
								<ModelPicker value={modelId} onChange={setModelId} />
							</div>

							{/* Right tools */}
							<div className="flex items-center gap-0.5">
								{/* Visibility */}
								<VisibilityToggle value={visibility} onChange={setVisibility} />

								{/* Advanced Controls */}
								<button
									type="button"
									onClick={() => setAdvancedOpen(!advancedOpen)}
									className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] transition-all ${
										advancedOpen
											? "text-white/70 bg-white/[0.08]"
											: "text-white/35 hover:text-white/55 hover:bg-white/[0.06]"
									}`}
									title="Advanced controls"
								>
									<SlidersHorizontal className="h-3.5 w-3.5" />
								</button>

								{/* Voice Input */}
								<button
									type="button"
									onClick={showComingSoon}
									className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] text-white/35 hover:text-white/55 hover:bg-white/[0.06] transition-all"
									title="Voice input"
								>
									<Mic className="h-3.5 w-3.5" />
								</button>

								{/* Submit — right arrow, matching reference */}
								<button
									type="button"
									onClick={handleGenerate}
									disabled={!prompt.trim() || isGenerating}
									className={`
										h-8 w-8 rounded-full flex items-center justify-center ml-1
										transition-all duration-200
										${
											prompt.trim()
												? "bg-white text-black hover:bg-white/90 shadow-[0_0_16px_rgba(255,255,255,0.15)]"
												: "bg-white/[0.08] text-white/25 cursor-not-allowed"
										}
										disabled:opacity-50
									`}
								>
									{isGenerating ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<ArrowRight className="h-4 w-4" />
									)}
								</button>
							</div>
						</div>
					</div>

					{/* Border beam animation */}
					<div
						className="border-beam z-10"
						style={{
							'--beam-size': 150,
							'--beam-duration': 12,
							'--beam-anchor': 90,
							'--beam-border-width': 1.5,
							'--beam-color-from': '#80FFF9',
							'--beam-color-to': 'transparent',
							'--beam-delay': -9,
						} as React.CSSProperties}
					/>
				</div>

				{/* Advanced Controls Panel */}
				<AdvancedControls
					isOpen={advancedOpen}
					onClose={() => setAdvancedOpen(false)}
					modelId={modelId}
					onModelChange={setModelId}
				/>

				{/* Error / Toast feedback */}
				{error && (
					<div className="flex items-center justify-center gap-2 mt-3">
						<AlertCircle className="h-3.5 w-3.5 text-red-400/70 flex-shrink-0" />
						<p className="text-xs text-red-400/70">{error}</p>
					</div>
				)}

				{/* Hint */}
				<p className="text-center text-white/15 text-[11px] mt-3">
					Press Enter to generate &middot; Shift+Enter for new line
				</p>

				{/* Recent Projects Pills */}
				{visibleApps.length > 0 && (
					<div className="flex items-center gap-2 flex-wrap justify-center mt-5 dash-animate-fade-up" style={{ animationDelay: "0.15s" }}>
						{visibleApps.map((app) => {
							const TypeIcon = ICON_MAP[PROJECT_TYPES.find((t) => t.id === selectedType)?.icon ?? "Layers"] ?? Layers;
							return (
								<Link
									key={app.id}
									href={`/app-builder/${app.id}`}
									className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.04] border border-white/[0.06] text-[13px] text-white/50 hover:text-white/70 hover:bg-white/[0.08] hover:border-white/[0.1] transition-all group"
								>
									<TypeIcon className="h-3.5 w-3.5 text-white/25 group-hover:text-white/40 transition-colors" />
									<span className="truncate max-w-[140px]">{app.name}</span>
									{isNew(app.createdAt) && (
										<span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400">
											<Sparkles className="h-2 w-2" />
											New
										</span>
									)}
								</Link>
							);
						})}
					</div>
				)}
			</div>

			{/* GitHub Import Modal */}
			<GitHubImportModal isOpen={githubOpen} onClose={() => setGithubOpen(false)} />
		</section>
	);
}
