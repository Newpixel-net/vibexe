"use client";

import { ChevronDown, Check, Sparkles, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface ModelOption {
	id: string;
	name: string;
	provider: string;
	description: string;
	contextWindow: string;
	isPro?: boolean;
	isFast?: boolean;
	isDefault?: boolean;
}

const DEFAULT_MODELS: ModelOption[] = [
	{
		id: "claude-sonnet-4-5",
		name: "Claude 4.5 Sonnet",
		provider: "Anthropic",
		description: "Best for most tasks",
		contextWindow: "200K",
		isDefault: true,
	},
	{
		id: "claude-opus-4-6",
		name: "Claude 4.6 Opus",
		provider: "Anthropic",
		description: "Most capable, complex reasoning",
		contextWindow: "200K",
		isPro: true,
	},
	{
		id: "gpt-5-3-codex",
		name: "GPT 5.3 Codex",
		provider: "OpenAI",
		description: "Optimized for code generation",
		contextWindow: "128K",
	},
	{
		id: "gemini-3-pro",
		name: "Gemini 3 Pro",
		provider: "Google",
		description: "Multimodal with large context",
		contextWindow: "1M",
	},
	{
		id: "grok-4-fast",
		name: "Grok 4 Fast",
		provider: "xAI",
		description: "Fast inference, real-time data",
		contextWindow: "128K",
		isFast: true,
	},
];

const PROVIDER_COLORS: Record<string, string> = {
	Anthropic: "#D97706",
	OpenAI: "#10B981",
	Google: "#3B82F6",
	xAI: "#EF4444",
	NVIDIA: "#76B900",
};

interface ModelPickerProps {
	value?: string;
	onChange?: (modelId: string) => void;
	models?: ModelOption[];
}

export function ModelPicker({ value, onChange, models }: ModelPickerProps) {
	const available = models ?? DEFAULT_MODELS;
	const [isOpen, setIsOpen] = useState(false);
	const [selected, setSelected] = useState(
		value ?? available.find((m) => m.isDefault)?.id ?? available[0]?.id ?? "",
	);
	const ref = useRef<HTMLDivElement>(null);

	const selectedModel = available.find((m) => m.id === selected) ?? available[0];

	// Close on outside click
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

	const handleSelect = useCallback(
		(modelId: string) => {
			setSelected(modelId);
			onChange?.(modelId);
			setIsOpen(false);
		},
		[onChange],
	);

	return (
		<div className="relative" ref={ref}>
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] text-white/50 hover:text-white/70 hover:bg-white/[0.06] transition-all"
			>
				<div
					className="h-2.5 w-2.5 rounded-full flex-shrink-0"
					style={{ background: PROVIDER_COLORS[selectedModel?.provider ?? ""] ?? "#666" }}
				/>
				<span className="truncate max-w-[120px]">{selectedModel?.name ?? "Select model"}</span>
				<ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
			</button>

			{isOpen && (
				<div className="absolute bottom-full left-0 mb-2 w-[320px] rounded-xl border border-white/[0.1] bg-[#1a1a2e]/95 backdrop-blur-xl shadow-2xl shadow-black/60 p-1.5 z-50">
					<div className="px-2.5 py-2 text-[10px] font-medium text-white/25 uppercase tracking-wider">
						Select Model
					</div>
					<div className="max-h-[320px] overflow-y-auto workspace-scroll">
						{available.map((model) => {
							const isSelected = model.id === selected;
							const color = PROVIDER_COLORS[model.provider] ?? "#666";
							return (
								<button
									key={model.id}
									type="button"
									onClick={() => handleSelect(model.id)}
									className={`w-full flex items-start gap-3 px-2.5 py-2.5 rounded-lg text-left transition-colors ${
										isSelected
											? "bg-white/[0.08]"
											: "hover:bg-white/[0.05]"
									}`}
								>
									<div
										className="h-5 w-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
										style={{ background: `${color}20` }}
									>
										<Sparkles className="h-3 w-3" style={{ color }} />
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-1.5">
											<span className={`text-[13px] font-medium ${isSelected ? "text-white/90" : "text-white/70"}`}>
												{model.name}
											</span>
											{model.isPro && (
												<span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400">
													PRO
												</span>
											)}
											{model.isFast && (
												<span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/15 text-emerald-400">
													<Zap className="h-2 w-2" />
													Fast
												</span>
											)}
										</div>
										<p className="text-[11px] text-white/30 mt-0.5">{model.description}</p>
										<p className="text-[10px] text-white/20 mt-0.5">{model.contextWindow} context</p>
									</div>
									{isSelected && (
										<Check className="h-4 w-4 text-blue-400 flex-shrink-0 mt-1" />
									)}
								</button>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
