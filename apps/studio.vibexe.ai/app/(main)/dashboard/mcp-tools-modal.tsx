"use client";

import { Plus, Search, X } from "lucide-react";
import { useState } from "react";

const PLACEHOLDER_TOOLS = [
	{ id: "browser", name: "Browser", description: "Browse and interact with web pages", enabled: true },
	{ id: "filesystem", name: "File System", description: "Read and write files on the server", enabled: false },
	{ id: "database", name: "Database", description: "Query and modify databases directly", enabled: false },
	{ id: "api-client", name: "API Client", description: "Make HTTP requests to external APIs", enabled: true },
	{ id: "code-exec", name: "Code Execution", description: "Run code in a sandboxed environment", enabled: true },
	{ id: "image-gen", name: "Image Generation", description: "Generate images with AI models", enabled: false },
];

interface McpToolsModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export function McpToolsModal({ isOpen, onClose }: McpToolsModalProps) {
	const [tools, setTools] = useState(PLACEHOLDER_TOOLS);
	const [search, setSearch] = useState("");

	if (!isOpen) return null;

	const filtered = tools.filter((t) =>
		t.name.toLowerCase().includes(search.toLowerCase()) ||
		t.description.toLowerCase().includes(search.toLowerCase()),
	);

	const toggleTool = (id: string) => {
		setTools((prev) =>
			prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)),
		);
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<div className="w-full max-w-md mx-4 rounded-2xl border border-white/[0.1] bg-[#141422]/95 backdrop-blur-xl shadow-2xl">
				{/* Header */}
				<div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
					<h3 className="text-[15px] font-semibold text-white/80">MCP Tools</h3>
					<button
						type="button"
						onClick={onClose}
						className="h-7 w-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.08] transition-colors"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				{/* Search */}
				<div className="px-5 py-3 border-b border-white/[0.04]">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search tools..."
							className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-9 pr-3 py-2 text-[13px] text-white/80 placeholder:text-white/20 focus:outline-none focus:border-white/[0.15]"
						/>
					</div>
				</div>

				{/* Tools list */}
				<div className="px-3 py-2 max-h-[320px] overflow-y-auto workspace-scroll">
					{filtered.map((tool) => (
						<div
							key={tool.id}
							className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/[0.04] transition-colors"
						>
							<div className="flex-1 min-w-0">
								<p className="text-[13px] font-medium text-white/70">{tool.name}</p>
								<p className="text-[11px] text-white/30 mt-0.5">{tool.description}</p>
							</div>
							<button
								type="button"
								onClick={() => toggleTool(tool.id)}
								className={`relative h-5 w-9 rounded-full transition-colors flex-shrink-0 ${
									tool.enabled ? "bg-blue-500" : "bg-white/[0.1]"
								}`}
							>
								<div
									className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
										tool.enabled ? "translate-x-4" : "translate-x-0.5"
									}`}
								/>
							</button>
						</div>
					))}
				</div>

				{/* Footer */}
				<div className="px-5 py-3 border-t border-white/[0.06] flex items-center justify-between">
					<button
						type="button"
						className="flex items-center gap-1.5 text-[12px] text-blue-400/70 hover:text-blue-400 transition-colors"
					>
						<Plus className="h-3.5 w-3.5" />
						New MCP Server
					</button>
					<span className="text-[10px] text-white/20">
						{tools.filter((t) => t.enabled).length} active
					</span>
				</div>
			</div>
		</div>
	);
}
