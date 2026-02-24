"use client";

import { defaultName } from "@vibexe-ai/node-registry";
import type { NodeId } from "@vibexe-ai/protocol";
import clsx from "clsx/lite";
import { BracesIcon, CopyIcon, InfoIcon, RotateCcwIcon, TypeIcon } from "lucide-react";
import {
	type ReactNode,
	useCallback,
	useMemo,
	useRef,
	useState,
} from "react";
import { useAppDesignerStore } from "../../../app-designer";
import { NodeIcon } from "../../../icons/node";

/**
 * FieldWrapper — universal wrapper that adds an fx (expression) toggle to ANY form field.
 *
 * Fixed mode: renders the child input normally via render prop.
 * Expression mode: replaces child with a monospace expression input with autocomplete.
 *
 * Also includes an optional kebab context menu (reset, copy, toggle mode).
 */
export function FieldWrapper({
	value,
	onChange,
	nodeId,
	label,
	description,
	required,
	children,
	className,
	showContextMenu = true,
	defaultValue,
}: {
	value: string;
	onChange: (value: string) => void;
	nodeId?: NodeId;
	label?: string;
	description?: string;
	required?: boolean;
	/** Render prop for fixed-mode content. If omitted, renders a text input. */
	children?: ReactNode;
	className?: string;
	showContextMenu?: boolean;
	defaultValue?: string;
}) {
	const [isExpressionMode, setIsExpressionMode] = useState(
		typeof value === "string" && value.includes("{{"),
	);
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [showMenu, setShowMenu] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);

	// Get upstream nodes for autocomplete
	const { nodes, connections } = useAppDesignerStore((s) => ({
		nodes: s.nodes,
		connections: s.connections ?? [],
	}));

	const upstreamSources = useMemo(() => {
		if (!nodeId) return [];

		const incomingConnections = connections.filter(
			(c) => c.inputNode.id === nodeId && c.connectionType !== "subNode",
		);

		const sources: {
			nodeId: string;
			nodeName: string;
			outputId: string;
			outputAccessor: string;
			outputLabel: string;
			expression: string;
			node: (typeof nodes)[0];
		}[] = [];

		for (const conn of incomingConnections) {
			const sourceNode = nodes.find((n) => n.id === conn.outputNode.id);
			if (!sourceNode) continue;

			for (const output of sourceNode.outputs) {
				sources.push({
					nodeId: sourceNode.id,
					nodeName: defaultName(sourceNode),
					outputId: output.id,
					outputAccessor: output.accessor,
					outputLabel: output.label,
					expression: `{{${sourceNode.id}:${output.id}}}`,
					node: sourceNode,
				});
			}
		}
		return sources;
	}, [nodeId, nodes, connections]);

	const insertExpression = useCallback(
		(expression: string) => {
			onChange(expression);
			setShowSuggestions(false);
			inputRef.current?.focus();
		},
		[onChange],
	);

	const handleInputFocus = useCallback(() => {
		if (isExpressionMode && upstreamSources.length > 0) {
			setShowSuggestions(true);
		}
	}, [isExpressionMode, upstreamSources.length]);

	const handleInputBlur = useCallback(() => {
		setTimeout(() => setShowSuggestions(false), 200);
	}, []);

	const toggleMode = useCallback(() => {
		setIsExpressionMode((prev) => {
			const next = !prev;
			if (next) {
				setShowSuggestions(upstreamSources.length > 0);
			} else {
				setShowSuggestions(false);
			}
			return next;
		});
	}, [upstreamSources.length]);

	const handleReset = useCallback(() => {
		onChange(defaultValue ?? "");
		setShowMenu(false);
	}, [onChange, defaultValue]);

	const handleCopy = useCallback(() => {
		navigator.clipboard.writeText(value);
		setShowMenu(false);
	}, [value]);

	return (
		<div className={clsx("flex flex-col gap-[4px]", className)}>
			{/* Label row with context menu */}
			{label && (
				<div className="flex items-center justify-between group">
					<div className="flex items-center gap-[4px]">
						<label className="text-[12px] text-text-muted">
							{label}
							{required && (
								<span className="text-red-400 ml-[2px]">*</span>
							)}
						</label>
						{description && (
							<span
								className="cursor-help"
								title={description}
							>
								<InfoIcon className="size-[11px] text-text-muted/40 hover:text-text-muted" />
							</span>
						)}
					</div>
					{showContextMenu && (
						<div className="relative">
							<button
								type="button"
								className="opacity-0 group-hover:opacity-100 text-text-muted/50 hover:text-text-muted transition-opacity px-[4px] py-[1px] text-[14px]"
								onClick={() => setShowMenu(!showMenu)}
								onBlur={() =>
									setTimeout(() => setShowMenu(false), 150)
								}
							>
								&#8942;
							</button>
							{showMenu && (
								<div
									ref={menuRef}
									className="absolute right-0 top-full mt-[2px] z-50 min-w-[140px] rounded-[6px] border border-border-muted bg-[#1a1a2e] shadow-lg py-[4px]"
								>
									<button
										type="button"
										className="w-full flex items-center gap-[6px] px-[10px] py-[5px] text-[11px] text-inverse/70 hover:bg-inverse/10 transition-colors text-left"
										onMouseDown={(e) => {
											e.preventDefault();
											handleReset();
										}}
									>
										<RotateCcwIcon className="size-[11px]" />
										Reset to default
									</button>
									<button
										type="button"
										className="w-full flex items-center gap-[6px] px-[10px] py-[5px] text-[11px] text-inverse/70 hover:bg-inverse/10 transition-colors text-left"
										onMouseDown={(e) => {
											e.preventDefault();
											handleCopy();
										}}
									>
										<CopyIcon className="size-[11px]" />
										Copy value
									</button>
									<button
										type="button"
										className="w-full flex items-center gap-[6px] px-[10px] py-[5px] text-[11px] text-inverse/70 hover:bg-inverse/10 transition-colors text-left"
										onMouseDown={(e) => {
											e.preventDefault();
											toggleMode();
											setShowMenu(false);
										}}
									>
										{isExpressionMode ? (
											<TypeIcon className="size-[11px]" />
										) : (
											<BracesIcon className="size-[11px]" />
										)}
										{isExpressionMode
											? "Switch to Fixed"
											: "Switch to Expression"}
									</button>
								</div>
							)}
						</div>
					)}
				</div>
			)}
			{description && (
				<p className="text-[10px] text-text-muted/60 leading-tight">
					{description}
				</p>
			)}

			{/* Field with fx toggle */}
			<div className="relative">
				<div className="flex items-stretch">
					{/* fx toggle button */}
					<button
						type="button"
						title={
							isExpressionMode
								? "Switch to fixed value"
								: "Switch to expression mode"
						}
						className={clsx(
							"flex items-center justify-center w-[28px] rounded-l-[6px] border border-r-0 border-border-muted transition-colors shrink-0",
							isExpressionMode
								? "bg-blue-500/20 text-blue-400 border-blue-500/40"
								: "bg-transparent text-inverse/30 hover:text-inverse/50",
						)}
						onClick={toggleMode}
					>
						{isExpressionMode ? (
							<BracesIcon className="size-[12px]" />
						) : (
							<TypeIcon className="size-[12px]" />
						)}
					</button>

					{/* Content area */}
					{isExpressionMode ? (
						<input
							ref={inputRef}
							type="text"
							className="flex-1 rounded-r-[6px] border border-border-muted bg-transparent px-[8px] py-[6px] text-[12px] text-blue-300 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/30"
							value={value}
							onChange={(e) => onChange(e.target.value)}
							onFocus={handleInputFocus}
							onBlur={handleInputBlur}
							placeholder="{{node:output.field}}"
						/>
					) : (
						<div className="flex-1 min-w-0">{children}</div>
					)}
				</div>

				{/* Autocomplete dropdown */}
				{showSuggestions && upstreamSources.length > 0 && (
					<div className="absolute z-50 top-full left-0 right-0 mt-[2px] rounded-[6px] border border-border-muted bg-[#1a1a2e] shadow-lg max-h-[180px] overflow-y-auto">
						<div className="px-[8px] py-[4px] text-[10px] text-inverse/30 border-b border-inverse/5">
							Insert reference
						</div>
						{upstreamSources.map((source) => (
							<button
								key={`${source.nodeId}-${source.outputId}`}
								type="button"
								className="w-full flex items-center gap-[6px] px-[8px] py-[6px] text-left hover:bg-inverse/10 transition-colors"
								onMouseDown={(e) => {
									e.preventDefault();
									insertExpression(source.expression);
								}}
							>
								<NodeIcon
									node={source.node}
									className="size-[12px] text-inverse/50 shrink-0"
								/>
								<span className="text-[11px] text-inverse/70 truncate">
									{source.nodeName}
								</span>
								<span className="text-[10px] text-inverse/30">
									/
								</span>
								<span className="text-[11px] text-blue-400 truncate">
									{source.outputLabel}
								</span>
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
