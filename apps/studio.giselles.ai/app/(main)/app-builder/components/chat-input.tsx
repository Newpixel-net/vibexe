"use client";

/**
 * ChatInput Component
 *
 * Auto-resizing textarea with Enter to submit, Shift+Enter for newlines.
 * Minimal UI: only image attachment button and send button.
 * Supports image attachments via file picker.
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

// Internal word limit (not visible to user)
const MAX_WORDS = 4000;

/** Count words in a string */
function countWords(text: string): number {
	return text.trim().split(/\s+/).filter(Boolean).length;
}

interface ChatInputProps {
	/** Current input value */
	value: string;
	/** Callback when value changes */
	onChange: (value: string) => void;
	/** Callback when form is submitted */
	onSubmit: () => void;
	/** Whether a message is being processed */
	isLoading?: boolean;
	/** Whether input is disabled */
	disabled?: boolean;
	/** Placeholder text */
	placeholder?: string;
	/** Additional className */
	className?: string;
	/** Whether AI is currently generating (shows stop button) */
	isGenerating?: boolean;
	/** Callback to stop generation */
	onStop?: () => void;
	/** Current attachments (images + documents) */
	attachments?: Attachment[];
	/** Callback when attachments change */
	onAttachmentsChange?: (attachments: Attachment[]) => void;
	/** Model capabilities for enforcing file limits */
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

	// Auto-resize textarea based on content (max 120px)
	useEffect(() => {
		const textarea = textareaRef.current;
		if (textarea) {
			textarea.style.height = "auto";
			textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
		}
	}, []);

	// Focus textarea on mount
	useEffect(() => {
		textareaRef.current?.focus();
	}, []);

	// Supported file types (images + documents)
	const supportedTypes = useMemo(() => {
		if (!modelCapabilities) return ["image/*"];
		const types = [...modelCapabilities.supportedImageTypes];
		if (modelCapabilities.documents) {
			types.push(...modelCapabilities.supportedDocTypes);
		}
		return types;
	}, [modelCapabilities]);

	const acceptString = useMemo(() => supportedTypes.join(","), [supportedTypes]);

	// Process files into unified Attachment format
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

			// Enforce max files limit
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

	// Handle file input change
	const handleFileChange = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => {
			if (e.target.files && e.target.files.length > 0) {
				processFiles(e.target.files);
				// Reset input so same file can be selected again
				e.target.value = "";
			}
		},
		[processFiles],
	);

	// Handle removing an attachment
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

	// Open file picker
	const handleImageClick = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	// Handle text change with internal word limit enforcement
	const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
		const newValue = e.target.value;
		// Enforce word limit internally (no visible counter)
		if (countWords(newValue) <= MAX_WORDS) {
			onChange(newValue);
		}
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		// Enter without Shift submits
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			if ((value.trim() || attachments.length > 0) && !isLoading && !disabled) {
				onSubmit();
			}
		}
	};

	// Drag and drop handlers
	const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);
	}, []);

	const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		// Only set isDragging false if leaving the container entirely
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
			{/* Hidden file input for attachments */}
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
			{/* biome-ignore lint/a11y/noStaticElementInteractions: Drop zone pattern requires drag events on container */}
			<div
				role="presentation"
				className="relative"
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
			>
				{/* Drag overlay - shows when dragging files over */}
				{isDragging && (
					<div className="absolute inset-0 flex items-center justify-center bg-accent/10 backdrop-blur-sm rounded-xl z-50 border-2 border-dashed border-accent">
						<span className="text-sm font-medium text-accent-foreground">
							Drop files here
						</span>
					</div>
				)}

				<div className="space-y-2">
					{/* Attachment previews (images + documents) */}
					{attachments.length > 0 && (
						<AttachmentPreview
							attachments={attachments}
							onRemove={handleRemoveAttachment}
							maxFiles={modelCapabilities?.maxFiles ?? 20}
						/>
					)}

					{/* Text input area with ALL buttons inline */}
					<div className="flex items-end gap-2 p-2 rounded-xl border border-input bg-muted focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent">
						<textarea
							ref={textareaRef}
							value={value}
							onChange={handleChange}
							onKeyDown={handleKeyDown}
							placeholder={placeholder}
							disabled={isDisabled}
							rows={1}
							className={cn(
								"flex-1 resize-none bg-transparent border-0 focus:ring-0 focus:outline-none",
								"text-foreground placeholder:text-muted-foreground",
								"min-h-[24px] max-h-[120px] py-1 px-1",
								isDisabled && "opacity-50 cursor-not-allowed",
							)}
						/>

						{/* Image button - INLINE */}
						<button
							type="button"
							className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
							onClick={handleImageClick}
							disabled={isDisabled}
							title="Attach files"
						>
							<ImageIcon className="h-4 w-4" />
						</button>

						{/* Stop button - INLINE, shows during generation */}
						{isGenerating && onStop && (
							<button
								type="button"
								className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-md text-destructive hover:bg-destructive/10 transition-colors"
								onClick={onStop}
								title="Stop generation"
							>
								<Square className="h-4 w-4 fill-current" />
							</button>
						)}

						{/* Send button - INLINE */}
						<button
							type="submit"
							disabled={!canSubmit}
							className={cn(
								"flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-md transition-colors disabled:opacity-50",
								canSubmit
									? "text-primary hover:bg-primary/10"
									: "text-muted-foreground",
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

			<div className="text-xs text-muted-foreground mt-1.5 px-1">
				Press Enter to send, Shift+Enter for new line
			</div>
		</form>
	);
}
