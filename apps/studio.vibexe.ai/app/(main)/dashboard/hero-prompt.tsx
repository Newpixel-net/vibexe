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
				{/* ============================================================ */}
				{/* CONNECTED TABS + CARD                                        */}
				{/* ============================================================ */}
				<div className="dash-animate-fade-up" style={{ animationDelay: "0.05s" }}>
					{/* Tab row — tabs sit flush on top of the card */}
					<div className="flex items-end">
						{PROJECT_TYPES.map((type) => {
							const Icon = ICON_MAP[type.icon] ?? Layers;
							const isActive = selectedType === type.id;
							return (
								<button
									key={type.id}
									type="button"
									aria-pressed={isActive}
									onClick={() => setSelectedType(type.id)}
									className={`
										flex items-center gap-2.5 px-6 py-3 text-[14px] font-medium
										transition-all duration-200 relative
										${
											isActive
												? "bg-[rgba(28,28,32,0.9)] text-white/90 rounded-t-xl border-t border-l border-r border-white/[0.08] z-10"
												: "text-white/35 hover:text-white/55 border-b border-white/[0.08]"
										}
									`}
									style={isActive ? { marginBottom: "-1px" } : undefined}
								>
									<Icon className="h-4 w-4" />
									{type.label}
								</button>
							);
						})}
						{/* Fill remaining space with bottom border */}
						<div className="flex-1 border-b border-white/[0.08]" />
					</div>

					{/* Card body — connects to active tab above */}
					<div className="bg-[rgba(28,28,32,0.9)] border border-white/[0.08] border-t-0 rounded-b-xl rounded-tr-xl">
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
