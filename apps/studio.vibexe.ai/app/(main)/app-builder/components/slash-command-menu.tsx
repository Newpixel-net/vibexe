"use client";

import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	Accessibility,
	Blocks,
	Copy,
	Database,
	DatabaseBackup,
	Download,
	FileText,
	GitBranch,
	KeyRound,
	Layout,
	ListTodo,
	Lock,
	Map,
	Moon,
	RefreshCw,
	Rocket,
	Server,
	ShieldCheck,
	Smartphone,
	Sparkles,
	TestTube,
	Wrench,
	Zap,
} from "lucide-react";
import type { SlashCommand } from "../lib/slash-commands";
import {
	SLASH_COMMAND_CATEGORIES,
	filterCommands,
	groupByCategory,
} from "../lib/slash-commands";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
	ShieldCheck,
	Wrench,
	Rocket,
	DatabaseBackup,
	GitBranch,
	Download,
	Map,
	Blocks,
	Layout,
	Server,
	Lock,
	TestTube,
	RefreshCw,
	FileText,
	Copy,
	ListTodo,
	Sparkles,
	Smartphone,
	Moon,
	KeyRound,
	Database,
	Zap,
	Accessibility,
};

export interface SlashCommandMenuHandle {
	handleKeyDown: (key: string) => void;
}

interface SlashCommandMenuProps {
	query: string;
	onSelect: (command: SlashCommand) => void;
	onClose: () => void;
}

export const SlashCommandMenu = forwardRef<
	SlashCommandMenuHandle,
	SlashCommandMenuProps
>(function SlashCommandMenu({ query, onSelect, onClose }, ref) {
	const [focusIndex, setFocusIndex] = useState(0);
	const listRef = useRef<HTMLDivElement>(null);

	const filtered = useMemo(() => filterCommands(query), [query]);
	const grouped = useMemo(() => groupByCategory(filtered), [filtered]);

	// Build a flat list of items for keyboard nav (skip category headers)
	const flatItems = useMemo(() => filtered, [filtered]);

	// Reset focus when query changes
	useEffect(() => {
		setFocusIndex(0);
	}, [query]);

	// Scroll focused item into view
	useEffect(() => {
		const el = listRef.current?.querySelector(`[data-index="${focusIndex}"]`);
		el?.scrollIntoView({ block: "nearest" });
	}, [focusIndex]);

	// Close on outside click
	useEffect(() => {
		const handleClick = (e: MouseEvent) => {
			if (listRef.current && !listRef.current.contains(e.target as Node)) {
				onClose();
			}
		};
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [onClose]);

	const handleKey = useCallback(
		(key: string) => {
			switch (key) {
				case "ArrowDown":
					setFocusIndex((prev) =>
						Math.min(prev + 1, flatItems.length - 1),
					);
					break;
				case "ArrowUp":
					setFocusIndex((prev) => Math.max(prev - 1, 0));
					break;
				case "Enter":
					if (flatItems[focusIndex]) {
						onSelect(flatItems[focusIndex]);
					}
					break;
				case "Escape":
					onClose();
					break;
			}
		},
		[flatItems, focusIndex, onSelect, onClose],
	);

	useImperativeHandle(
		ref,
		() => ({
			handleKeyDown: handleKey,
		}),
		[handleKey],
	);

	if (flatItems.length === 0) {
		return (
			<div className="absolute bottom-full left-0 mb-2 z-50 w-80 rounded-xl backdrop-blur-xl bg-[#1a1a2e]/95 border border-white/[0.1] shadow-2xl p-4">
				<p className="text-xs text-white/40 text-center">
					No commands matching{" "}
					<span className="text-white/60 font-mono">/{query}</span>
				</p>
			</div>
		);
	}

	// Track global item index across groups
	let globalIndex = 0;

	return (
		<div
			ref={listRef}
			className="absolute bottom-full left-0 mb-2 z-50 w-80 max-h-[320px] overflow-y-auto rounded-xl backdrop-blur-xl bg-[#1a1a2e]/95 border border-white/[0.1] shadow-2xl"
			role="listbox"
		>
			{Array.from(grouped.entries()).map(([category, commands]) => (
				<div key={category}>
					{/* Category header */}
					<div className="sticky top-0 z-10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30 bg-[#1a1a2e]/95 backdrop-blur-xl">
						{SLASH_COMMAND_CATEGORIES[category]}
					</div>

					{/* Command items */}
					{commands.map((cmd) => {
						const idx = globalIndex++;
						const Icon = ICON_MAP[cmd.icon];
						const isFocused = idx === focusIndex;

						return (
							<button
								key={cmd.id}
								type="button"
								role="option"
								aria-selected={isFocused}
								data-index={idx}
								onClick={() => onSelect(cmd)}
								onMouseEnter={() => setFocusIndex(idx)}
								className={`flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors ${
									isFocused
										? "bg-violet-500/[0.12] text-white/90"
										: "text-white/60 hover:bg-white/[0.04]"
								}`}
							>
								{Icon && (
									<Icon
										className={`h-4 w-4 shrink-0 ${
											isFocused
												? "text-violet-400"
												: "text-white/30"
										}`}
									/>
								)}
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<span className="text-xs font-mono text-white/40">
											{cmd.command}
										</span>
										<span className="text-xs font-medium truncate">
											{cmd.label}
										</span>
										{cmd.type === "agent" && (
											<span className="text-[9px] px-1 py-0.5 rounded bg-violet-500/[0.12] text-violet-300/70 font-medium leading-none">
												Agent
											</span>
										)}
									</div>
									<p className="text-[11px] text-white/35 truncate">
										{cmd.description}
									</p>
								</div>
							</button>
						);
					})}
				</div>
			))}
		</div>
	);
});
