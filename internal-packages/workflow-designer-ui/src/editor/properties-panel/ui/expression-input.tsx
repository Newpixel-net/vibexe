"use client";

import { defaultName } from "@giselles-ai/node-registry";
import type { NodeId } from "@giselles-ai/protocol";
import clsx from "clsx/lite";
import { BracesIcon, TypeIcon } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useAppDesignerStore } from "../../../app-designer";
import { NodeIcon } from "../../../icons/node";

/**
 * ExpressionInput — a text field with an `fx` toggle.
 *
 * Fixed mode: plain text value.
 * Expression mode: shows expression syntax `{{nodeId:outputId.field}}` with
 * an autocomplete dropdown listing upstream nodes and their outputs.
 */
export function ExpressionInput({
	value,
	onChange,
	placeholder,
	className,
	nodeId,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	className?: string;
	/** Current node ID — used to find upstream nodes */
	nodeId?: NodeId;
}) {
	const [isExpressionMode, setIsExpressionMode] = useState(
		value.includes("{{"),
	);
	const [showSuggestions, setShowSuggestions] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	// Get upstream nodes for autocomplete
	const { nodes, connections } = useAppDesignerStore((s) => ({
		nodes: s.nodes,
		connections: s.connections ?? [],
	}));

	const upstreamSources = useMemo(() => {
		if (!nodeId) return [];

		// Find all nodes that connect TO this node
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
		// Delay to allow clicking suggestions
		setTimeout(() => setShowSuggestions(false), 200);
	}, []);

	return (
		<div className={clsx("relative", className)}>
			<div className="flex items-stretch">
				{/* fx toggle */}
				<button
					type="button"
					title={
						isExpressionMode
							? "Switch to fixed value"
							: "Switch to expression mode"
					}
					className={clsx(
						"flex items-center justify-center w-[28px] rounded-l-[6px] border border-r-0 border-border-muted transition-colors",
						isExpressionMode
							? "bg-blue-500/20 text-blue-400 border-blue-500/40"
							: "bg-transparent text-inverse/30 hover:text-inverse/50",
					)}
					onClick={() => {
						setIsExpressionMode(!isExpressionMode);
						if (!isExpressionMode) {
							setShowSuggestions(upstreamSources.length > 0);
						} else {
							setShowSuggestions(false);
						}
					}}
				>
					{isExpressionMode ? (
						<BracesIcon className="size-[12px]" />
					) : (
						<TypeIcon className="size-[12px]" />
					)}
				</button>

				{/* Input field */}
				<input
					ref={inputRef}
					type="text"
					className={clsx(
						"flex-1 rounded-r-[6px] border border-border-muted bg-transparent px-[8px] py-[6px] text-[12px] text-text",
						"focus:outline-none focus:ring-1 focus:ring-blue-500/30",
						isExpressionMode && "font-mono text-blue-300",
					)}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					onFocus={handleInputFocus}
					onBlur={handleInputBlur}
					placeholder={
						isExpressionMode
							? "{{node:output.field}}"
							: placeholder ?? "value"
					}
				/>
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
							<span className="text-[10px] text-inverse/30">/</span>
							<span className="text-[11px] text-blue-400 truncate">
								{source.outputLabel}
							</span>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
