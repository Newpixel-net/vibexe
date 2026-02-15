"use client";

import type { NodeProps } from "@xyflow/react";
import clsx from "clsx/lite";
import { useCallback, useRef, useState } from "react";

const colorMap: Record<string, { bg: string; border: string; text: string }> = {
	yellow: { bg: "bg-yellow-200/90", border: "border-yellow-400/50", text: "text-yellow-900" },
	blue: { bg: "bg-blue-200/90", border: "border-blue-400/50", text: "text-blue-900" },
	green: { bg: "bg-green-200/90", border: "border-green-400/50", text: "text-green-900" },
	pink: { bg: "bg-pink-200/90", border: "border-pink-400/50", text: "text-pink-900" },
	gray: { bg: "bg-gray-300/90", border: "border-gray-400/50", text: "text-gray-900" },
};

const colorOptions = ["yellow", "blue", "green", "pink", "gray"] as const;

export function StickyNoteNode({ id, data, selected }: NodeProps) {
	const noteData = data as {
		text?: string;
		color?: string;
		onUpdate?: (id: string, updates: Record<string, unknown>) => void;
	};

	const color = noteData.color ?? "yellow";
	const colors = colorMap[color] ?? colorMap.yellow;
	const [isEditing, setIsEditing] = useState(false);
	const [showColorPicker, setShowColorPicker] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleTextChange = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			noteData.onUpdate?.(id, { text: e.target.value });
		},
		[id, noteData],
	);

	const handleColorChange = useCallback(
		(newColor: string) => {
			noteData.onUpdate?.(id, { color: newColor });
			setShowColorPicker(false);
		},
		[id, noteData],
	);

	return (
		<div
			className={clsx(
				"relative rounded-[4px] border shadow-md min-w-[150px] min-h-[100px]",
				colors.bg,
				colors.border,
				selected && "ring-2 ring-blue-500/50",
			)}
			style={{ width: 200, minHeight: 150 }}
			onDoubleClick={(e) => {
				e.stopPropagation();
				setIsEditing(true);
				setTimeout(() => textareaRef.current?.focus(), 0);
			}}
		>
			{/* Color picker toggle */}
			<div className="absolute top-[4px] right-[4px] flex items-center gap-[2px]">
				<button
					type="button"
					className="w-[16px] h-[16px] rounded-full border border-black/20 opacity-0 hover:opacity-100 transition-opacity"
					style={{
						background:
							color === "yellow"
								? "#fde047"
								: color === "blue"
									? "#93c5fd"
									: color === "green"
										? "#86efac"
										: color === "pink"
											? "#f9a8d4"
											: "#d1d5db",
					}}
					onClick={(e) => {
						e.stopPropagation();
						setShowColorPicker(!showColorPicker);
					}}
					title="Change color"
				/>
			</div>

			{/* Color picker dropdown */}
			{showColorPicker && (
				<div className="absolute top-[24px] right-[4px] z-20 flex gap-[4px] p-[4px] bg-white rounded-[6px] shadow-lg border border-gray-200">
					{colorOptions.map((c) => (
						<button
							key={c}
							type="button"
							className={clsx(
								"w-[20px] h-[20px] rounded-full border-2",
								c === color ? "border-gray-800" : "border-transparent",
							)}
							style={{
								background:
									c === "yellow"
										? "#fde047"
										: c === "blue"
											? "#93c5fd"
											: c === "green"
												? "#86efac"
												: c === "pink"
													? "#f9a8d4"
													: "#d1d5db",
							}}
							onClick={(e) => {
								e.stopPropagation();
								handleColorChange(c);
							}}
						/>
					))}
				</div>
			)}

			{/* Text area */}
			<div className={clsx("p-[8px] h-full", colors.text)}>
				{isEditing ? (
					<textarea
						ref={textareaRef}
						className="w-full h-full min-h-[120px] bg-transparent resize-none outline-none text-[13px] leading-[1.4]"
						value={noteData.text ?? ""}
						onChange={handleTextChange}
						onBlur={() => setIsEditing(false)}
						placeholder="Type a note..."
					/>
				) : (
					<div className="text-[13px] leading-[1.4] whitespace-pre-wrap min-h-[120px]">
						{noteData.text || (
							<span className="opacity-40 italic">Double-click to edit...</span>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
