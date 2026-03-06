"use client";

/**
 * DragNumberInput — Unity-style draggable number input.
 * Drag the label left/right to change the value.
 * Also supports direct typing.
 */

import { useCallback, useRef, useState } from "react";

interface DragNumberInputProps {
	label: string;
	value: number;
	step?: number;
	precision?: number;
	onChange: (value: number) => void;
	color?: string;
	/** Override label width class (default "w-3 text-center" for X/Y/Z axes) */
	labelClassName?: string;
}

export function DragNumberInput({
	label,
	value,
	step = 0.1,
	precision = 3,
	onChange,
	color = "#888",
	labelClassName,
}: DragNumberInputProps) {
	const safeValue = Number.isFinite(value) ? value : 0;
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState("");
	const isDragging = useRef(false);
	const startX = useRef(0);
	const startValue = useRef(0);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			if (isEditing) return;
			e.preventDefault();
			isDragging.current = true;
			startX.current = e.clientX;
			startValue.current = safeValue;
			(e.target as HTMLElement).setPointerCapture(e.pointerId);
		},
		[safeValue, isEditing],
	);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent) => {
			if (!isDragging.current) return;
			const dx = e.clientX - startX.current;
			const newVal = startValue.current + dx * step;
			onChange(Number(newVal.toFixed(precision)));
		},
		[step, precision, onChange],
	);

	const handlePointerUp = useCallback(() => {
		isDragging.current = false;
	}, []);

	const handleDoubleClick = useCallback(() => {
		setIsEditing(true);
		setEditValue(safeValue.toFixed(precision));
	}, [safeValue, precision]);

	const commitEdit = useCallback(() => {
		setIsEditing(false);
		const parsed = parseFloat(editValue);
		if (!isNaN(parsed)) {
			onChange(Number(parsed.toFixed(precision)));
		}
	}, [editValue, precision, onChange]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") commitEdit();
			if (e.key === "Escape") setIsEditing(false);
		},
		[commitEdit],
	);

	return (
		<div className="flex items-center gap-1 flex-1 min-w-0">
			<span
				className={`text-xs font-bold select-none cursor-ew-resize flex-shrink-0 ${labelClassName || "w-3 text-center"}`}
				style={{ color }}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onDoubleClick={handleDoubleClick}
			>
				{label}
			</span>
			{isEditing ? (
				<input
					type="text"
					value={editValue}
					onChange={(e) => setEditValue(e.target.value)}
					onBlur={commitEdit}
					onKeyDown={handleKeyDown}
					className="w-full bg-white/[0.15] border border-white/[0.2] rounded px-1 py-0.5 text-[11px] text-white/90 font-mono outline-none focus:border-violet-400"
					autoFocus
				/>
			) : (
				<div
					className="w-full bg-white/[0.06] rounded px-1.5 py-0.5 text-[11px] text-white/70 font-mono cursor-ew-resize select-none hover:bg-white/[0.1] transition-colors truncate"
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
					onDoubleClick={handleDoubleClick}
				>
					{safeValue.toFixed(precision)}
				</div>
			)}
		</div>
	);
}
