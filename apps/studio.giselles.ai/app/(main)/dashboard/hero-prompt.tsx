"use client";

/**
 * HeroPrompt Component
 *
 * The centerpiece of the dashboard — a "Describe it. Deploy it." hero section
 * with project type pills, category tags, typewriter placeholder, and
 * a gradient Generate button that creates an app and redirects to the builder.
 */

import {
	AlertCircle,
	GitBranch,
	Globe,
	Layers,
	LayoutDashboard,
	Loader2,
	Sparkles,
	Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	PROJECT_TYPES,
	getCategoriesForType,
	getPlaceholdersForType,
} from "./prompt-data";
import { useTypewriter } from "./use-typewriter";

const ICON_MAP: Record<string, React.ElementType> = {
	Layers,
	GitBranch,
	Globe,
	Zap,
	LayoutDashboard,
};

export function HeroPrompt() {
	const router = useRouter();
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const measureRef = useRef<HTMLSpanElement>(null);
	const [selectedType, setSelectedType] = useState("app");
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
	const [prompt, setPrompt] = useState("");
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [cursorOffset, setCursorOffset] = useState(0);

	// Get relevant placeholders + categories based on selected type
	const placeholders = useMemo(
		() => getPlaceholdersForType(selectedType),
		[selectedType],
	);
	const categories = useMemo(
		() => getCategoriesForType(selectedType),
		[selectedType],
	);

	const { text: typewriterText, showCursor } = useTypewriter(placeholders);

	// Measure typewriter text width for cursor alignment
	useEffect(() => {
		if (measureRef.current) {
			setCursorOffset(measureRef.current.offsetWidth);
		}
	}, [typewriterText]);

	// Handle Generate click
	const handleGenerate = useCallback(async () => {
		const trimmed = prompt.trim();
		if (!trimmed || isGenerating) return;

		setIsGenerating(true);
		setError(null);
		try {
			if (selectedType === "workflow") {
				// Redirect to the Playground AI builder — it creates its own workspace via create_workflow tool
				router.push(`/playground?prompt=${encodeURIComponent(trimmed)}&type=${selectedType}${selectedCategory ? `&category=${selectedCategory}` : ""}`);
				setTimeout(() => setIsGenerating(false), 5000);
				return;
			} else {
				const res = await fetch("/api/app-builder/apps", { method: "POST" });
				if (res.ok) {
					const data = await res.json();
					if (data.redirectPath) {
						router.push(`${data.redirectPath}?prompt=${encodeURIComponent(trimmed)}&type=${selectedType}${selectedCategory ? `&category=${selectedCategory}` : ""}`);
						// Safety: reset after 5s in case navigation stalls
						setTimeout(() => setIsGenerating(false), 5000);
						return;
					}
				}
				setError("Failed to create app. Please try again.");
			}
		} catch {
			setError("Network error. Please check your connection.");
		}
		setIsGenerating(false);
	}, [prompt, selectedType, selectedCategory, isGenerating, router]);

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
			el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
		},
		[],
	);

	return (
		<section className="relative overflow-hidden rounded-2xl mb-8">
			{/* Background aurora blobs */}
			<div className="absolute inset-0 overflow-hidden pointer-events-none">
				<div
					className="aurora-blob opacity-[0.07]"
					style={{
						background: "radial-gradient(circle, hsl(219, 90%, 52%) 0%, transparent 70%)",
						top: "-200px",
						left: "-100px",
						animation: "aurora-drift-1 20s ease-in-out infinite",
					}}
				/>
				<div
					className="aurora-blob opacity-[0.05]"
					style={{
						background: "radial-gradient(circle, hsl(178, 94%, 49%) 0%, transparent 70%)",
						bottom: "-250px",
						right: "-150px",
						width: "500px",
						height: "500px",
						animation: "aurora-drift-2 25s ease-in-out infinite",
					}}
				/>
			</div>

			{/* Content */}
			<div className="relative z-10 px-8 pt-10 pb-8">
				{/* Heading */}
				<div className="text-center mb-8 dash-animate-fade-up">
					<h1
						className="text-[32px] font-bold tracking-tight leading-tight dash-animate-gradient bg-clip-text text-transparent"
						style={{
							backgroundImage:
								"linear-gradient(135deg, hsl(219, 90%, 72%), hsl(178, 94%, 60%), hsl(219, 90%, 72%))",
							backgroundSize: "200% 200%",
						}}
					>
						Describe it. Deploy it.
					</h1>
					<p className="text-white/40 text-sm mt-2 max-w-md mx-auto">
						Tell us what you want to build — AI handles the rest
					</p>
				</div>

				{/* Project Type Pills */}
				<div className="flex justify-center gap-2 mb-5 flex-wrap dash-animate-fade-up" style={{ animationDelay: "0.1s" }}>
					{PROJECT_TYPES.map((type) => {
						const Icon = ICON_MAP[type.icon] ?? Layers;
						const isActive = selectedType === type.id;
						return (
							<button
								key={type.id}
								type="button"
								aria-pressed={isActive}
								onClick={() => {
									setSelectedType(type.id);
									setSelectedCategory(null);
								}}
								className={`
									relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium
									transition-all duration-200
									${
										isActive
											? "text-white/90 bg-white/[0.1] border border-white/[0.15] shadow-[0_0_12px_rgba(59,130,246,0.12)]"
											: "text-white/40 border border-transparent hover:text-white/60 hover:bg-white/[0.04]"
									}
								`}
							>
								<Icon className="h-3.5 w-3.5" />
								{type.label}
							</button>
						);
					})}
				</div>

				{/* Category Tags */}
				{categories.length > 0 && (
					<div
						className="flex justify-center gap-1.5 mb-6 flex-wrap max-w-xl mx-auto dash-animate-fade-up"
						style={{ animationDelay: "0.15s" }}
					>
						{categories.map((cat) => (
							<button
								key={cat.id}
								type="button"
								aria-pressed={selectedCategory === cat.id}
								onClick={() =>
									setSelectedCategory(
										selectedCategory === cat.id ? null : cat.id,
									)
								}
								className={`
									px-2.5 py-0.5 rounded-md text-[11px] transition-all duration-150
									${
										selectedCategory === cat.id
											? "bg-white/[0.1] text-white/70 border border-white/[0.12]"
											: "text-white/25 hover:text-white/40 hover:bg-white/[0.03] border border-transparent"
									}
								`}
							>
								{cat.label}
							</button>
						))}
					</div>
				)}

				{/* Prompt Input */}
				<div
					className="max-w-2xl mx-auto dash-animate-fade-up"
					style={{ animationDelay: "0.2s" }}
				>
					<div className="relative glass-input group">
						<textarea
							ref={textareaRef}
							value={prompt}
							onChange={handleInput}
							onKeyDown={handleKeyDown}
							placeholder={typewriterText || "Describe your project..."}
							aria-label="Describe your project"
							maxLength={500}
							rows={1}
							className="w-full bg-transparent text-white/90 text-sm placeholder:text-white/20 px-5 py-4 pr-28 resize-none focus:outline-none min-h-[52px] max-h-[120px]"
							style={{ fontFamily: "var(--font-sans)" }}
						/>

						{/* Hidden measurement span for cursor alignment */}
						<span
							ref={measureRef}
							className="absolute left-5 top-4 pointer-events-none text-sm opacity-0"
							style={{ fontFamily: "var(--font-sans)" }}
							aria-hidden="true"
						>
							{typewriterText}
						</span>

						{/* Cursor overlay when empty */}
						{!prompt && showCursor && (
							<span
								className="absolute left-5 top-4 pointer-events-none text-white/30 dash-animate-cursor"
								style={{ marginLeft: `${cursorOffset}px` }}
							>
								|
							</span>
						)}

						{/* Character counter near limit */}
						{prompt.length > 400 && (
							<span className="absolute right-3 bottom-1.5 text-[10px] text-white/20">
								{prompt.length}/500
							</span>
						)}

						{/* Generate Button */}
						<button
							type="button"
							onClick={handleGenerate}
							disabled={!prompt.trim() || isGenerating}
							className={`
								absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5
								px-4 py-2 rounded-lg text-xs font-semibold
								transition-all duration-200
								${
									prompt.trim()
										? "bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-[0_0_16px_rgba(59,130,246,0.25)] hover:shadow-[0_0_24px_rgba(59,130,246,0.35)]"
										: "bg-white/[0.06] text-white/20 cursor-not-allowed"
								}
								disabled:opacity-50
							`}
						>
							{isGenerating ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : (
								<Sparkles className="h-3.5 w-3.5" />
							)}
							Generate
						</button>
					</div>

					{/* Error feedback */}
					{error && (
						<div className="flex items-center gap-2 mt-2 px-1">
							<AlertCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
							<p className="text-xs text-red-400">{error}</p>
						</div>
					)}

					{/* Hint */}
					<p className="text-center text-white/15 text-[11px] mt-2.5">
						Press Enter to generate &middot; Shift+Enter for new line
					</p>
				</div>
			</div>
		</section>
	);
}
