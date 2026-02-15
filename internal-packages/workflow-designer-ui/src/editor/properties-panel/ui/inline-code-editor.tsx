"use client";

import clsx from "clsx/lite";
import { CopyIcon, CheckIcon } from "lucide-react";
import {
	type KeyboardEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

interface InlineCodeEditorProps {
	value: string;
	onChange: (value: string) => void;
	language?: "javascript" | "json" | "text";
	readOnly?: boolean;
	className?: string;
	placeholder?: string;
	/** Min height in px (default: 120) */
	minHeight?: number;
	/** Max height in px (default: 400) */
	maxHeight?: number;
}

/**
 * Lightweight inline code editor with:
 * - Monospace font and code styling
 * - Tab key inserts tab/spaces (doesn't leave the field)
 * - Line numbers gutter
 * - Auto-height that grows with content
 * - Copy button
 * - Language label
 */
export function InlineCodeEditor({
	value,
	onChange,
	language = "javascript",
	readOnly = false,
	className,
	placeholder,
	minHeight = 120,
	maxHeight = 400,
}: InlineCodeEditorProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [copied, setCopied] = useState(false);
	const lineCount = (value.match(/\n/g) || []).length + 1;

	// Auto-resize
	useEffect(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = "auto";
		const scrollHeight = el.scrollHeight;
		el.style.height = `${Math.max(minHeight, Math.min(scrollHeight, maxHeight))}px`;
	}, [value, minHeight, maxHeight]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent<HTMLTextAreaElement>) => {
			if (readOnly) return;

			const el = e.currentTarget;
			const { selectionStart, selectionEnd } = el;

			// Tab key: insert 2 spaces
			if (e.key === "Tab") {
				e.preventDefault();
				const before = value.slice(0, selectionStart);
				const after = value.slice(selectionEnd);
				const newValue = `${before}  ${after}`;
				onChange(newValue);
				// Restore cursor position
				requestAnimationFrame(() => {
					el.selectionStart = selectionStart + 2;
					el.selectionEnd = selectionStart + 2;
				});
			}

			// Enter: auto-indent (match previous line's leading whitespace)
			if (e.key === "Enter") {
				e.preventDefault();
				const before = value.slice(0, selectionStart);
				const after = value.slice(selectionEnd);
				const currentLine = before.split("\n").pop() ?? "";
				const indent = currentLine.match(/^(\s*)/)?.[1] ?? "";

				// Add extra indent after { or (
				const lastChar = before.trimEnd().slice(-1);
				const extraIndent =
					lastChar === "{" || lastChar === "(" || lastChar === "["
						? "  "
						: "";

				const newValue = `${before}\n${indent}${extraIndent}${after}`;
				onChange(newValue);
				requestAnimationFrame(() => {
					const pos =
						selectionStart +
						1 +
						indent.length +
						extraIndent.length;
					el.selectionStart = pos;
					el.selectionEnd = pos;
				});
			}
		},
		[value, onChange, readOnly],
	);

	const handleCopy = useCallback(() => {
		navigator.clipboard.writeText(value);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	}, [value]);

	const languageLabel =
		language === "javascript"
			? "JS"
			: language === "json"
				? "JSON"
				: "TXT";

	return (
		<div
			className={clsx(
				"rounded-[8px] border border-border-muted bg-[#0d0b1a] overflow-hidden",
				className,
			)}
		>
			{/* Header bar */}
			<div className="flex items-center justify-between px-[10px] py-[4px] bg-[#161329] border-b border-border-muted">
				<span className="text-[10px] text-inverse/30 font-mono uppercase tracking-wider">
					{languageLabel}
				</span>
				<button
					type="button"
					className="text-inverse/30 hover:text-inverse/60 transition-colors"
					onClick={handleCopy}
					title="Copy code"
				>
					{copied ? (
						<CheckIcon className="size-[12px] text-green-400" />
					) : (
						<CopyIcon className="size-[12px]" />
					)}
				</button>
			</div>

			{/* Editor area */}
			<div className="flex">
				{/* Line numbers gutter */}
				<div className="flex flex-col items-end px-[8px] py-[8px] select-none border-r border-inverse/5 bg-[#0d0b1a]">
					{Array.from({ length: lineCount }, (_, i) => (
						<span
							key={i}
							className="text-[11px] leading-[18px] text-inverse/15 font-mono"
						>
							{i + 1}
						</span>
					))}
				</div>

				{/* Textarea */}
				<textarea
					ref={textareaRef}
					className={clsx(
						"flex-1 bg-transparent text-[12px] leading-[18px] text-inverse font-mono px-[10px] py-[8px] resize-none outline-none",
						"placeholder:text-inverse/20",
						readOnly && "opacity-70 cursor-default",
					)}
					value={value}
					onChange={(e) => {
						if (!readOnly) onChange(e.target.value);
					}}
					onKeyDown={handleKeyDown}
					readOnly={readOnly}
					spellCheck={false}
					autoCapitalize="off"
					autoCorrect="off"
					placeholder={placeholder}
					style={{
						minHeight: `${minHeight}px`,
						maxHeight: `${maxHeight}px`,
					}}
				/>
			</div>
		</div>
	);
}
