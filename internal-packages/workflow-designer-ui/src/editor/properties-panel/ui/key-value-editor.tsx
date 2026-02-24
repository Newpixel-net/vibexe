"use client";

import type { NodeId } from "@vibexe-ai/protocol";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useCallback } from "react";
import { FieldWrapper } from "./field-wrapper";

export interface KeyValuePair {
	key: string;
	value: string;
}

interface KeyValueEditorProps {
	pairs: KeyValuePair[];
	onChange: (pairs: KeyValuePair[]) => void;
	nodeId?: NodeId;
	keyPlaceholder?: string;
	valuePlaceholder?: string;
	keyLabel?: string;
	valueLabel?: string;
	addLabel?: string;
}

/**
 * Rich key-value pair editor for headers, query params, form fields, etc.
 * Each row has two FieldWrapper-wrapped inputs (key + value) with expression support.
 */
export function KeyValueEditor({
	pairs,
	onChange,
	nodeId,
	keyPlaceholder = "Key",
	valuePlaceholder = "Value",
	keyLabel = "Key",
	valueLabel = "Value",
	addLabel = "+ Add item",
}: KeyValueEditorProps) {
	const addPair = useCallback(() => {
		onChange([...pairs, { key: "", value: "" }]);
	}, [pairs, onChange]);

	const removePair = useCallback(
		(index: number) => {
			onChange(pairs.filter((_, i) => i !== index));
		},
		[pairs, onChange],
	);

	const updatePair = useCallback(
		(index: number, field: "key" | "value", val: string) => {
			const updated = [...pairs];
			updated[index] = { ...updated[index], [field]: val };
			onChange(updated);
		},
		[pairs, onChange],
	);

	return (
		<div className="flex flex-col gap-[6px]">
			{/* Header row */}
			{pairs.length > 0 && (
				<div className="flex gap-[4px] items-center px-[2px]">
					<span className="flex-1 text-[10px] text-text-muted/50 font-medium uppercase tracking-wider">
						{keyLabel}
					</span>
					<span className="flex-1 text-[10px] text-text-muted/50 font-medium uppercase tracking-wider">
						{valueLabel}
					</span>
					<span className="w-[28px]" />
				</div>
			)}

			{/* Rows */}
			{pairs.map((pair, i) => (
				<div key={`kv-${i}`} className="flex gap-[4px] items-start">
					<div className="flex-1">
						<FieldWrapper
							value={pair.key}
							onChange={(v) => updatePair(i, "key", v)}
							nodeId={nodeId}
							showContextMenu={false}
						>
							<input
								type="text"
								className="w-full rounded-r-[6px] border border-l-0 border-border-muted bg-transparent px-[8px] py-[6px] text-[12px] text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
								value={pair.key}
								onChange={(e) =>
									updatePair(i, "key", e.target.value)
								}
								placeholder={keyPlaceholder}
							/>
						</FieldWrapper>
					</div>
					<div className="flex-1">
						<FieldWrapper
							value={pair.value}
							onChange={(v) => updatePair(i, "value", v)}
							nodeId={nodeId}
							showContextMenu={false}
						>
							<input
								type="text"
								className="w-full rounded-r-[6px] border border-l-0 border-border-muted bg-transparent px-[8px] py-[6px] text-[12px] text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
								value={pair.value}
								onChange={(e) =>
									updatePair(i, "value", e.target.value)
								}
								placeholder={valuePlaceholder}
							/>
						</FieldWrapper>
					</div>
					<button
						type="button"
						className="shrink-0 mt-[6px] p-[6px] text-text-muted/50 hover:text-error-500 transition-colors rounded-[4px] hover:bg-error-500/10"
						onClick={() => removePair(i)}
						title="Remove"
					>
						<TrashIcon className="size-[12px]" />
					</button>
				</div>
			))}

			{/* Add button */}
			<button
				type="button"
				className="flex items-center gap-[6px] rounded-[6px] border border-dashed border-border-muted px-[10px] py-[6px] text-[11px] text-text-muted hover:border-text-muted/50 hover:text-inverse/60 transition-colors"
				onClick={addPair}
			>
				<PlusIcon className="size-[11px]" />
				{addLabel}
			</button>
		</div>
	);
}
