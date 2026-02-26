"use client";

import { ChevronDown, Minus, Plus, Settings2, X } from "lucide-react";
import { useState } from "react";
import { McpToolsModal } from "./mcp-tools-modal";
import { ModelPicker, type ModelOption } from "./model-picker";

interface AdvancedControlsProps {
	isOpen: boolean;
	onClose: () => void;
	modelId?: string;
	onModelChange?: (id: string) => void;
}

const TEMPLATE_OPTIONS = [
	{ id: "default", label: "Default (Auto-detect)" },
	{ id: "nextjs", label: "Next.js + TypeScript" },
	{ id: "react-vite", label: "React + Vite" },
	{ id: "node-express", label: "Node.js + Express" },
	{ id: "static", label: "Static HTML/CSS/JS" },
];

export function AdvancedControls({
	isOpen,
	onClose,
	modelId,
	onModelChange,
}: AdvancedControlsProps) {
	const [mcpOpen, setMcpOpen] = useState(false);
	const [template, setTemplate] = useState("default");
	const [budget, setBudget] = useState(25);
	const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);

	if (!isOpen) return null;

	return (
		<>
			<div className="mt-3 rounded-xl border border-white/[0.08] bg-[#1a1a2e]/60 backdrop-blur-sm overflow-hidden dash-animate-fade-up">
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
					<div className="flex items-center gap-2">
						<Settings2 className="h-3.5 w-3.5 text-white/30" />
						<span className="text-[13px] font-medium text-white/50">Advanced Controls</span>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="h-6 w-6 rounded-md flex items-center justify-center text-white/25 hover:text-white/50 hover:bg-white/[0.06] transition-colors"
					>
						<X className="h-3.5 w-3.5" />
					</button>
				</div>

				{/* Controls grid */}
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
					{/* MCP Tools */}
					<div>
						<label className="text-[11px] text-white/30 font-medium uppercase tracking-wider block mb-2">
							MCP Tools
						</label>
						<button
							type="button"
							onClick={() => setMcpOpen(true)}
							className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white/50 hover:text-white/70 hover:border-white/[0.12] transition-colors"
						>
							<span>3 tools active</span>
							<Settings2 className="h-3.5 w-3.5" />
						</button>
					</div>

					{/* Template */}
					<div>
						<label className="text-[11px] text-white/30 font-medium uppercase tracking-wider block mb-2">
							Template
						</label>
						<div className="relative">
							<button
								type="button"
								onClick={() => setTemplateDropdownOpen(!templateDropdownOpen)}
								className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white/50 hover:text-white/70 hover:border-white/[0.12] transition-colors"
							>
								<span className="truncate">
									{TEMPLATE_OPTIONS.find((t) => t.id === template)?.label}
								</span>
								<ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${templateDropdownOpen ? "rotate-180" : ""}`} />
							</button>
							{templateDropdownOpen && (
								<>
									<div className="fixed inset-0 z-30" onClick={() => setTemplateDropdownOpen(false)} />
									<div className="absolute top-full left-0 right-0 mt-1 z-40 rounded-lg border border-white/[0.1] bg-[#1a1a2e] shadow-xl p-1">
										{TEMPLATE_OPTIONS.map((opt) => (
											<button
												key={opt.id}
												type="button"
												onClick={() => { setTemplate(opt.id); setTemplateDropdownOpen(false); }}
												className={`w-full text-left px-3 py-2 rounded-md text-[12px] transition-colors ${
													template === opt.id
														? "bg-white/[0.08] text-white/80"
														: "text-white/50 hover:bg-white/[0.05] hover:text-white/70"
												}`}
											>
												{opt.label}
											</button>
										))}
									</div>
								</>
							)}
						</div>
					</div>

					{/* Budget */}
					<div>
						<label className="text-[11px] text-white/30 font-medium uppercase tracking-wider block mb-2">
							Budget (Credits)
						</label>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => setBudget((b) => Math.max(5, b - 5))}
								className="h-8 w-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white/40 hover:text-white/60 hover:bg-white/[0.08] transition-colors"
							>
								<Minus className="h-3 w-3" />
							</button>
							<div className="flex-1 text-center">
								<span className="text-[16px] font-semibold text-white/80 tabular-nums">{budget}</span>
								<span className="text-[11px] text-white/25 ml-1">credits</span>
							</div>
							<button
								type="button"
								onClick={() => setBudget((b) => Math.min(100, b + 5))}
								className="h-8 w-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white/40 hover:text-white/60 hover:bg-white/[0.08] transition-colors"
							>
								<Plus className="h-3 w-3" />
							</button>
						</div>
					</div>

					{/* Model */}
					<div>
						<label className="text-[11px] text-white/30 font-medium uppercase tracking-wider block mb-2">
							Model
						</label>
						<div className="rounded-lg bg-white/[0.04] border border-white/[0.08] px-1 py-0.5">
							<ModelPicker value={modelId} onChange={onModelChange} />
						</div>
					</div>
				</div>
			</div>

			<McpToolsModal isOpen={mcpOpen} onClose={() => setMcpOpen(false)} />
		</>
	);
}
