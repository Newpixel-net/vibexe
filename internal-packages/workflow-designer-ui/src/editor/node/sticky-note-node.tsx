"use client";

import type { NodeProps } from "@xyflow/react";
import clsx from "clsx/lite";
import { useCallback, useRef, useState } from "react";
import { Streamdown } from "streamdown";

/** Preserve blank lines the user typed by converting empty lines to &nbsp; lines */
function preserveBlankLines(text: string): string {
	return text.replace(/\n[ \t]*\n/g, "\n\n&nbsp;\n\n");
}

// Sticky note colors — bumped lightness from N8N _primitives.scss (10-17%)
// to 25-30% so colors are clearly distinguishable on the dark canvas.
const N8N_NOTE_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
	yellow: { bg: "hsl(46, 100%, 25%)",  border: "hsl(46, 100%, 38%)",  dot: "#fbbf24" },
	orange: { bg: "hsl(36, 77%, 25%)",   border: "hsl(36, 77%, 38%)",   dot: "#e67e22" },
	red:    { bg: "hsl(355, 83%, 28%)",  border: "hsl(355, 83%, 40%)",  dot: "#ef4444" },
	green:  { bg: "hsl(151, 60%, 25%)",  border: "hsl(151, 60%, 36%)",  dot: "#34d399" },
	blue:   { bg: "hsl(210, 67%, 25%)",  border: "hsl(210, 67%, 38%)",  dot: "#60a5fa" },
	purple: { bg: "hsl(247, 49%, 30%)",  border: "hsl(247, 49%, 44%)",  dot: "#a78bfa" },
	gray:   { bg: "hsl(0, 0%, 25%)",     border: "hsl(0, 0%, 36%)",     dot: "#9ca3af" },
};
const colorOptions = ["yellow", "orange", "red", "green", "blue", "purple", "gray"] as const;

export function StickyNoteNode({ id, data, selected }: NodeProps) {
	const noteData = data as {
		text?: string;
		color?: string;
		size?: { width: number; height: number };
		onUpdate?: (id: string, updates: Record<string, unknown>) => void;
	};

	const color = noteData.color ?? "yellow";
	const theme = N8N_NOTE_COLORS[color] ?? N8N_NOTE_COLORS.yellow;
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
				"relative rounded-[6px] shadow-lg",
				selected && "ring-2 ring-blue-500/50",
			)}
			style={{
				backgroundColor: theme.bg,
				border: `1px solid ${theme.border}`,
			}}
			onDoubleClick={(e) => {
				e.stopPropagation();
				setIsEditing(true);
				setTimeout(() => textareaRef.current?.focus(), 0);
			}}
		>
			{/* Color picker toggle */}
			<div className="absolute top-[6px] right-[6px] flex items-center gap-[2px] z-10">
				<button
					type="button"
					className="w-[16px] h-[16px] rounded-full border border-white/20 opacity-0 hover:opacity-100 transition-opacity"
					style={{ background: theme.dot }}
					onClick={(e) => {
						e.stopPropagation();
						setShowColorPicker(!showColorPicker);
					}}
					title="Change color"
				/>
			</div>

			{/* Color picker dropdown */}
			{showColorPicker && (
				<div className="absolute top-[26px] right-[6px] z-20 flex gap-[4px] p-[6px] rounded-[6px] shadow-lg border border-white/10"
					style={{ backgroundColor: "rgba(30, 30, 50, 0.95)" }}
				>
					{colorOptions.map((c) => (
						<button
							key={c}
							type="button"
							className={clsx(
								"w-[20px] h-[20px] rounded-full border-2",
								c === color ? "border-white" : "border-transparent",
							)}
							style={{ background: N8N_NOTE_COLORS[c]?.dot }}
							onClick={(e) => {
								e.stopPropagation();
								handleColorChange(c);
							}}
						/>
					))}
				</div>
			)}

			{/* Content area */}
			<div className="p-[12px] h-full" style={{ color: "hsl(0,0%,96%)" }}>
				{isEditing ? (
					<textarea
						ref={textareaRef}
						className="w-full h-full min-h-[120px] bg-transparent resize-none outline-none text-[13px] leading-[1.5] text-gray-200 placeholder-gray-500"
						value={noteData.text ?? ""}
						onChange={handleTextChange}
						onBlur={() => setIsEditing(false)}
						placeholder="Type a note... (supports markdown)"
					/>
				) : (
					<div className="sticky-note-markdown min-h-[40px]">
						{noteData.text ? (
							<Streamdown className="sticky-note-markdown">
								{preserveBlankLines(noteData.text)}
							</Streamdown>
						) : (
							<span className="opacity-40 italic text-[13px]">
								Double-click to edit...
							</span>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
