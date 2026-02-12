"use client";

import {
	CommandIcon,
	PlayIcon,
	SearchIcon,
	CopyIcon,
	DownloadIcon,
	HistoryIcon,
	LayoutGridIcon,
	MessageSquareIcon,
	NavigationIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/shallow";
import { useAppDesignerStore } from "../../app-designer";

interface CommandItem {
	id: string;
	label: string;
	section: "Nodes" | "Actions" | "Navigation";
	icon?: React.ReactNode;
	action: () => void;
	keywords?: string[];
	shortcut?: string;
}

function fuzzyMatch(text: string, query: string): boolean {
	const lower = text.toLowerCase();
	const q = query.toLowerCase();
	if (lower.includes(q)) return true;
	let qi = 0;
	for (let i = 0; i < lower.length && qi < q.length; i++) {
		if (lower[i] === q[qi]) qi++;
	}
	return qi === q.length;
}

export function CommandPalette() {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	const { nodes, workspaceId, setUiNodeState } = useAppDesignerStore(
		useShallow((s) => ({
			nodes: s.nodes,
			workspaceId: s.workspaceId,
			setUiNodeState: s.setUiNodeState,
		})),
	);

	const selectAndFocusNode = useCallback(
		(nodeId: string) => {
			// Deselect all nodes first
			for (const node of nodes) {
				setUiNodeState(node.id, { selected: false });
			}
			// Select the target node
			setUiNodeState(nodeId, { selected: true });
			setOpen(false);
		},
		[nodes, setUiNodeState],
	);

	// Build command items
	const commands = useMemo<CommandItem[]>(() => {
		const items: CommandItem[] = [];

		// Node navigation items
		for (const node of nodes) {
			if (node.type !== "operation") continue;
			items.push({
				id: `nav-${node.id}`,
				label: node.name || node.id,
				section: "Nodes",
				icon: <NavigationIcon className="size-4" />,
				action: () => selectAndFocusNode(node.id),
				keywords: [node.content?.type ?? ""],
			});
		}

		// Actions
		items.push({
			id: "action-export",
			label: "Export Workflow as JSON",
			section: "Actions",
			icon: <DownloadIcon className="size-4" />,
			action: () => {
				if (workspaceId) {
					window.location.href = `/api/workspaces/${workspaceId}/export`;
				}
				setOpen(false);
			},
			keywords: ["export", "download", "json", "save"],
		});

		items.push({
			id: "action-duplicate",
			label: "Duplicate Selected Node",
			section: "Actions",
			icon: <CopyIcon className="size-4" />,
			action: () => {
				setOpen(false);
				// Trigger Cmd+D via keyboard event
				window.dispatchEvent(
					new KeyboardEvent("keydown", {
						key: "d",
						metaKey: true,
						ctrlKey: navigator.platform.includes("Win"),
						bubbles: true,
					}),
				);
			},
			keywords: ["duplicate", "copy", "clone"],
			shortcut: "Ctrl+D",
		});

		items.push({
			id: "action-chat",
			label: "Open AI Workflow Builder",
			section: "Actions",
			icon: <MessageSquareIcon className="size-4" />,
			action: () => {
				setOpen(false);
			},
			keywords: ["chat", "ai", "builder", "assistant"],
		});

		items.push({
			id: "nav-executions",
			label: "View Execution History",
			section: "Navigation",
			icon: <HistoryIcon className="size-4" />,
			action: () => {
				setOpen(false);
			},
			keywords: ["executions", "history", "runs", "logs"],
		});

		items.push({
			id: "nav-workflows",
			label: "Back to Workflow List",
			section: "Navigation",
			icon: <LayoutGridIcon className="size-4" />,
			action: () => {
				window.location.href = "/workflows";
				setOpen(false);
			},
			keywords: ["workflows", "list", "dashboard", "home"],
		});

		return items;
	}, [nodes, workspaceId, selectAndFocusNode]);

	const filtered = useMemo(() => {
		if (!query) return commands;
		return commands.filter(
			(cmd) =>
				fuzzyMatch(cmd.label, query) ||
				cmd.keywords?.some((kw) => fuzzyMatch(kw, query)),
		);
	}, [commands, query]);

	// Group by section
	const grouped = useMemo(() => {
		const groups: Record<string, CommandItem[]> = {};
		for (const item of filtered) {
			if (!groups[item.section]) groups[item.section] = [];
			groups[item.section].push(item);
		}
		return groups;
	}, [filtered]);

	// Keyboard handler
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				setOpen((prev) => !prev);
				setQuery("");
				setSelectedIndex(0);
			}
			if (e.key === "Escape" && open) {
				e.preventDefault();
				setOpen(false);
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [open]);

	// Focus input when opened
	useEffect(() => {
		if (open) {
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [open]);

	// Keyboard navigation
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setSelectedIndex((i) => Math.max(i - 1, 0));
			} else if (e.key === "Enter") {
				e.preventDefault();
				if (filtered[selectedIndex]) {
					filtered[selectedIndex].action();
				}
			}
		},
		[filtered, selectedIndex],
	);

	// Scroll selected item into view
	useEffect(() => {
		const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
		el?.scrollIntoView({ block: "nearest" });
	}, [selectedIndex]);

	if (!open) return null;

	let flatIndex = -1;

	return (
		<div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]">
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/50 backdrop-blur-sm"
				onClick={() => setOpen(false)}
				onKeyDown={() => {}}
				role="button"
				tabIndex={-1}
			/>

			{/* Palette */}
			<div className="relative w-[520px] max-h-[400px] bg-[#1a1a2e] border border-inverse/20 rounded-xl shadow-2xl overflow-hidden flex flex-col">
				{/* Search input */}
				<div className="flex items-center gap-3 px-4 py-3 border-b border-inverse/10">
					<SearchIcon className="size-4 text-inverse/40 shrink-0" />
					<input
						ref={inputRef}
						type="text"
						placeholder="Type a command or search..."
						className="flex-1 bg-transparent text-sm text-inverse outline-none placeholder:text-inverse/30"
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setSelectedIndex(0);
						}}
						onKeyDown={handleKeyDown}
					/>
					<kbd className="text-[10px] text-inverse/30 border border-inverse/10 rounded px-1.5 py-0.5">
						ESC
					</kbd>
				</div>

				{/* Results */}
				<div ref={listRef} className="flex-1 overflow-y-auto py-2">
					{filtered.length === 0 ? (
						<div className="px-4 py-6 text-center text-sm text-inverse/30">
							No commands found.
						</div>
					) : (
						Object.entries(grouped).map(([section, items]) => (
							<div key={section}>
								<div className="px-4 py-1 text-[10px] text-inverse/30 uppercase tracking-wider font-medium">
									{section}
								</div>
								{items.map((item) => {
									flatIndex++;
									const idx = flatIndex;
									return (
										<button
											key={item.id}
											type="button"
											data-index={idx}
											className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
												idx === selectedIndex
													? "bg-inverse/10 text-inverse"
													: "text-inverse/70 hover:bg-inverse/5"
											}`}
											onClick={() => item.action()}
											onMouseEnter={() => setSelectedIndex(idx)}
										>
											{item.icon ?? (
												<CommandIcon className="size-4 text-inverse/30" />
											)}
											<span className="flex-1 truncate">{item.label}</span>
											{item.shortcut && (
												<kbd className="text-[10px] text-inverse/20 border border-inverse/10 rounded px-1.5 py-0.5 ml-2 shrink-0">
													{item.shortcut}
												</kbd>
											)}
										</button>
									);
								})}
							</div>
						))
					)}
				</div>

				{/* Footer */}
				<div className="flex items-center gap-4 px-4 py-2 border-t border-inverse/10 text-[10px] text-inverse/20">
					<span>
						<kbd className="border border-inverse/10 rounded px-1 py-0.5 mr-1">
							↑↓
						</kbd>
						Navigate
					</span>
					<span>
						<kbd className="border border-inverse/10 rounded px-1 py-0.5 mr-1">
							↵
						</kbd>
						Select
					</span>
					<span>
						<kbd className="border border-inverse/10 rounded px-1 py-0.5 mr-1">
							Esc
						</kbd>
						Close
					</span>
				</div>
			</div>
		</div>
	);
}
