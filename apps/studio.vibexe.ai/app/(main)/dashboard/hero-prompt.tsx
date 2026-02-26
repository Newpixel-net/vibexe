"use client";

/**
 * HeroPrompt Component — Emergent-style
 *
 * Dark card container with multi-line textarea, typewriter placeholder,
 * and rich bottom toolbar (Attach, GitHub, Model Picker, Visibility,
 * Advanced Controls, Voice, Submit).
 */

import {
	AlertCircle,
	ArrowUp,
	Github,
	Globe,
	Layers,
	Loader2,
	Mic,
	Paperclip,
	SlidersHorizontal,
	Smartphone,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
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
	onTypeChange?: (typeId: string) => void;
}

export function HeroPrompt({ onTypeChange }: HeroPromptProps) {
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

	// Handle tab change
	const handleTypeChange = useCallback(
		(typeId: string) => {
			setSelectedType(typeId);
			onTypeChange?.(typeId);
		},
		[onTypeChange],
	);

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

	return (
		<div className="max-w-3xl mx-auto">
			{/* Project Type Tabs */}
			<div
				className="flex justify-center gap-2 mb-5 dash-animate-fade-up"
				style={{ animationDelay: "0.1s" }}
			>
				{PROJECT_TYPES.map((type) => {
					const Icon = ICON_MAP[type.icon] ?? Layers;
					const isActive = selectedType === type.id;
					return (
						<button
							key={type.id}
							type="button"
							aria-pressed={isActive}
							onClick={() => handleTypeChange(type.id)}
							className={`
								flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium
								transition-all duration-200
								${
									isActive
										? "text-white/90 bg-white/[0.08] border border-white/[0.12] shadow-[0_0_16px_rgba(59,130,246,0.08)]"
										: "text-white/35 border border-transparent hover:text-white/55 hover:bg-white/[0.04]"
								}
							`}
						>
							<Icon className="h-4 w-4" />
							{type.label}
						</button>
					);
				})}
			</div>

			{/* Chat Input Card */}
			<div
				className="dash-animate-fade-up"
				style={{ animationDelay: "0.15s" }}
			>
				<div className="hero-chat-card group">
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
							className="w-full bg-transparent text-white/90 text-[15px] placeholder:text-white/20 resize-none focus:outline-none min-h-[80px] max-h-[200px] leading-relaxed"
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

							{/* Submit */}
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
									<ArrowUp className="h-4 w-4" />
								)}
							</button>
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
			</div>

			{/* GitHub Import Modal */}
			<GitHubImportModal isOpen={githubOpen} onClose={() => setGithubOpen(false)} />
		</div>
	);
}
