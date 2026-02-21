"use client";

/**
 * ChatInput Component — Aurora Glass Design
 *
 * Floating glass pill input with focus glow ring.
 * Auto-resizing textarea with Enter to submit.
 */

import { Image as ImageIcon, Loader2, Send, Square } from "lucide-react";
import {
	type ChangeEvent,
	type DragEvent,
	type FormEvent,
	type KeyboardEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { cn } from "@/lib/utils";
import type { ModelCapabilities } from "../lib/model-resolver";
import type { Attachment } from "../types/vibesdk";
import { AttachmentPreview } from "./attachment-preview";

const MAX_WORDS = 4000;

function countWords(text: string): number {
	return text.trim().split(/\s+/).filter(Boolean).length;
}

interface ChatInputProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	isLoading?: boolean;
	disabled?: boolean;
	placeholder?: string;
	className?: string;
	isGenerating?: boolean;
	onStop?: () => void;
	attachments?: Attachment[];
	onAttachmentsChange?: (attachments: Attachment[]) => void;
	modelCapabilities?: ModelCapabilities;
}

export function ChatInput({
	value,
	onChange,
	onSubmit,
	isLoading = false,
	disabled = false,
	placeholder = "Chat with AI...",
	className,
	isGenerating = false,
	onStop,
	attachments = [],
	onAttachmentsChange,
	modelCapabilities,
}: ChatInputProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [isDragging, setIsDragging] = useState(false);

	useEffect(() => {
		const textarea = textareaRef.current;
		if (textarea) {
			textarea.style.height = "auto";
			const minH = 80; // ~3 lines
			textarea.style.height = `${Math.max(Math.min(textarea.scrollHeight, 200), minH)}px`;
		}
	}, [value]);

	useEffect(() => {
		textareaRef.current?.focus();
	}, []);

	const supportedTypes = useMemo(() => {
		if (!modelCapabilities) return ["image/*"];
		const types = [...modelCapabilities.supportedImageTypes];
		if (modelCapabilities.documents) {
			types.push(...modelCapabilities.supportedDocTypes);
		}
		return types;
	}, [modelCapabilities]);

	const acceptString = useMemo(() => supportedTypes.join(","), [supportedTypes]);

	const processFiles = useCallback(
		(files: FileList | File[]) => {
			if (!onAttachmentsChange) return;

			const maxFiles = modelCapabilities?.maxFiles ?? 20;
			const maxSizeBytes = (modelCapabilities?.maxFileSizeMB ?? 5) * 1024 * 1024;
			const imageTypes = new Set(modelCapabilities?.supportedImageTypes ?? ["image/jpeg", "image/png", "image/gif", "image/webp"]);
			const docTypes = new Set(modelCapabilities?.supportedDocTypes ?? []);

			const validFiles = Array.from(files).filter((file) => {
				const isImage = file.type.startsWith("image/") || imageTypes.has(file.type);
				const isDoc = docTypes.has(file.type);
				if (!isImage && !isDoc) return false;
				if (file.size > maxSizeBytes) return false;
				return true;
			});

			if (validFiles.length === 0) return;

			const remaining = maxFiles - attachments.length;
			const filesToAdd = validFiles.slice(0, remaining);

			const newAttachments: Attachment[] = filesToAdd.map((file) => ({
				id: crypto.randomUUID(),
				file,
				url: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
				name: file.name,
				mediaType: file.type,
				size: file.size,
				category: file.type.startsWith("image/") ? "image" as const : "document" as const,
			}));

			onAttachmentsChange([...attachments, ...newAttachments]);
		},
		[attachments, onAttachmentsChange, modelCapabilities],
	);

	const handleFileChange = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => {
			if (e.target.files && e.target.files.length > 0) {
				processFiles(e.target.files);
				e.target.value = "";
			}
		},
		[processFiles],
	);

	const handleRemoveAttachment = useCallback(
		(id: string) => {
			if (!onAttachmentsChange) return;
			const attachment = attachments.find((a) => a.id === id);
			if (attachment?.url) {
				URL.revokeObjectURL(attachment.url);
			}
			onAttachmentsChange(attachments.filter((a) => a.id !== id));
		},
		[attachments, onAttachmentsChange],
	);

	const handleImageClick = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
		const newValue = e.target.value;
		if (countWords(newValue) <= MAX_WORDS) {
			onChange(newValue);
		}
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			if ((value.trim() || attachments.length > 0) && !isLoading && !disabled) {
				onSubmit();
			}
		}
	};

	const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);
	}, []);

	const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX;
		const y = e.clientY;
		if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
			setIsDragging(false);
		}
	}, []);

	const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
	}, []);

	const handleDrop = useCallback(
		(e: DragEvent<HTMLDivElement>) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragging(false);
			const files = e.dataTransfer?.files;
			if (files && files.length > 0) {
				processFiles(files);
			}
		},
		[processFiles],
	);

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		if ((value.trim() || attachments.length > 0) && !isLoading && !disabled) {
			onSubmit();
		}
	};

	const isDisabled = disabled || isLoading;
	const canSubmit = (value.trim().length > 0 || attachments.length > 0) && !isDisabled;

	return (
		<form onSubmit={handleSubmit} className={cn("relative", className)}>
			{/* Hidden file input */}
			<input
				ref={fileInputRef}
				type="file"
				accept={acceptString}
				multiple
				className="hidden"
				onChange={handleFileChange}
				data-attachment-input=""
			/>

			{/* Drag wrapper */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: Drop zone */}
			<div
				role="presentation"
				className="relative"
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
			>
				{/* Drag overlay — glass with violet dashed border */}
				{isDragging && (
					<div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm bg-violet-500/[0.06] rounded-2xl z-50 border-2 border-dashed border-violet-500/40">
						<span className="text-sm font-medium text-violet-300/70">
							Drop files here
						</span>
					</div>
				)}

				<div className="space-y-2">
					{/* Attachment previews */}
					{attachments.length > 0 && (
						<AttachmentPreview
							attachments={attachments}
							onRemove={handleRemoveAttachment}
							maxFiles={modelCapabilities?.maxFiles ?? 20}
						/>
					)}

					{/* Glass pill input — large textarea with floating buttons */}
					<div className="glass-input relative rounded-2xl p-3 pb-11">
						<textarea
							ref={textareaRef}
							value={value}
							onChange={handleChange}
							onKeyDown={handleKeyDown}
							placeholder={placeholder}
							disabled={isDisabled}
							rows={3}
							className={cn(
								"w-full resize-none bg-transparent border-0 focus:ring-0 focus:outline-none",
								"text-white/90 placeholder:text-white/30",
								"min-h-[80px] max-h-[200px] py-1 px-1 text-sm leading-relaxed",
								isDisabled && "opacity-50 cursor-not-allowed",
							)}
						/>

						{/* Bottom-right action buttons */}
						<div className="absolute bottom-2.5 right-3 flex items-center gap-1.5">
							{/* Image button — glass icon */}
							<button
								type="button"
								className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.08] transition-all duration-200 disabled:opacity-50"
								onClick={handleImageClick}
								disabled={isDisabled}
								title="Attach files"
							>
								<ImageIcon className="h-4 w-4" />
							</button>

							{/* Stop button — glass red */}
							{isGenerating && onStop && (
								<button
									type="button"
									className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg bg-red-500/[0.1] border border-red-500/[0.2] text-red-400 hover:bg-red-500/[0.15] transition-all duration-200"
									onClick={onStop}
									title="Stop generation"
								>
									<Square className="h-4 w-4 fill-current" />
								</button>
							)}

							{/* Send button — gradient */}
							<button
								type="submit"
								disabled={!canSubmit}
								className={cn(
									"flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-xl transition-all duration-200 disabled:opacity-30",
									canSubmit
										? "bg-gradient-to-r from-violet-500 to-cyan-500 text-white hover:scale-105 shadow-[0_0_12px_rgba(124,58,237,0.2)]"
										: "text-white/30",
								)}
							>
								{isLoading ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Send className="h-4 w-4" />
								)}
								<span className="sr-only">Send message</span>
							</button>
						</div>
					</div>
				</div>
			</div>
		</form>
	);
}
