"use client";

/**
 * ChatInput Component — Aurora Glass Design
 *
 * Floating glass pill input with focus glow ring.
 * Auto-resizing textarea with Enter to submit.
 */

import { Camera, Image as ImageIcon, Loader2, Send, Square } from "lucide-react";
import {
	type ChangeEvent,
	type ClipboardEvent,
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
import { ScreenshotEditor } from "./screenshot-editor";
import {
	SlashCommandMenu,
	type SlashCommandMenuHandle,
} from "./slash-command-menu";
import type { SlashCommand } from "../lib/slash-commands";

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
	const slashMenuRef = useRef<SlashCommandMenuHandle>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [isCapturing, setIsCapturing] = useState(false);
	const [editingImage, setEditingImage] = useState<File | null>(null);
	const [editingAttachmentId, setEditingAttachmentId] = useState<string | null>(null);
	const [slashMenuOpen, setSlashMenuOpen] = useState(false);
	const [slashQuery, setSlashQuery] = useState("");
	const [slashStartIndex, setSlashStartIndex] = useState(-1);

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

	const handleScreenshot = useCallback(async () => {
		if (!onAttachmentsChange || isCapturing) return;
		setIsCapturing(true);

		try {
			// Use getDisplayMedia to capture the screen
			const stream = await navigator.mediaDevices.getDisplayMedia({
				video: { displaySurface: "browser" } as MediaTrackConstraints,
				audio: false,
				// @ts-expect-error -- preferCurrentTab is a Chromium-only hint
				preferCurrentTab: true,
			});

			// Grab a single frame from the video track
			const track = stream.getVideoTracks()[0];
			const canvas = document.createElement("canvas");
			const video = document.createElement("video");
			video.srcObject = stream;
			video.muted = true;

			await new Promise<void>((resolve) => {
				video.onloadedmetadata = () => {
					video.play();
					// Small delay ensures the frame is rendered
					requestAnimationFrame(() => {
						canvas.width = video.videoWidth;
						canvas.height = video.videoHeight;
						const ctx = canvas.getContext("2d");
						if (ctx) ctx.drawImage(video, 0, 0);
						resolve();
					});
				};
			});

			// Stop all tracks immediately
			for (const t of stream.getTracks()) t.stop();

			// Convert canvas to File and open in editor
			const blob = await new Promise<Blob | null>((resolve) =>
				canvas.toBlob(resolve, "image/png"),
			);

			if (blob) {
				const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
				const file = new File([blob], `screenshot-${timestamp}.png`, { type: "image/png" });
				setEditingImage(file);
				setEditingAttachmentId(null);
			}
		} catch {
			// User cancelled the picker or API not supported — silently ignore
		} finally {
			setIsCapturing(false);
		}
	}, [onAttachmentsChange, isCapturing]);

	// Paste handler — intercept clipboard images and open editor
	const handlePaste = useCallback(
		(e: ClipboardEvent<HTMLTextAreaElement>) => {
			if (!onAttachmentsChange) return;
			const items = e.clipboardData?.items;
			if (!items) return;

			for (const item of Array.from(items)) {
				if (item.type.startsWith("image/")) {
					e.preventDefault();
					const file = item.getAsFile();
					if (file) {
						setEditingImage(file);
						setEditingAttachmentId(null);
					}
					return;
				}
			}
		},
		[onAttachmentsChange],
	);

	// Editor save — add annotated file as attachment (or replace existing)
	const handleEditorSave = useCallback(
		(file: File) => {
			if (!onAttachmentsChange) return;

			const url = URL.createObjectURL(file);
			const newAttachment: Attachment = {
				id: editingAttachmentId ?? crypto.randomUUID(),
				file,
				url,
				name: file.name,
				mediaType: "image/png",
				size: file.size,
				category: "image" as const,
			};

			if (editingAttachmentId) {
				// Replace existing attachment
				const old = attachments.find((a) => a.id === editingAttachmentId);
				if (old?.url) URL.revokeObjectURL(old.url);
				onAttachmentsChange(
					attachments.map((a) => (a.id === editingAttachmentId ? newAttachment : a)),
				);
			} else {
				const maxFiles = modelCapabilities?.maxFiles ?? 20;
				if (attachments.length < maxFiles) {
					onAttachmentsChange([...attachments, newAttachment]);
				}
			}

			setEditingImage(null);
			setEditingAttachmentId(null);
		},
		[attachments, onAttachmentsChange, modelCapabilities, editingAttachmentId],
	);

	const handleEditorCancel = useCallback(() => {
		setEditingImage(null);
		setEditingAttachmentId(null);
	}, []);

	// Edit existing attachment — reopen in editor
	const handleEditAttachment = useCallback(
		(id: string) => {
			const attachment = attachments.find((a) => a.id === id);
			if (attachment?.file && attachment.category === "image") {
				setEditingImage(attachment.file);
				setEditingAttachmentId(id);
			}
		},
		[attachments],
	);

	const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
		const newValue = e.target.value;
		if (countWords(newValue) > MAX_WORDS) return;
		onChange(newValue);

		// Slash command detection — check if current word starts with /
		const cursorPos = e.target.selectionStart;
		let wordStart = cursorPos - 1;
		while (wordStart >= 0 && !/\s/.test(newValue[wordStart])) {
			wordStart--;
		}
		wordStart++; // move past the whitespace or to 0

		const currentWord = newValue.slice(wordStart, cursorPos);
		if (currentWord.startsWith("/")) {
			setSlashMenuOpen(true);
			setSlashQuery(currentWord.slice(1));
			setSlashStartIndex(wordStart);
		} else {
			setSlashMenuOpen(false);
		}
	};

	const handleSlashSelect = useCallback(
		(command: SlashCommand) => {
			// Replace /query with the command's insertText
			const before = value.slice(0, slashStartIndex);
			const after = value.slice(
				slashStartIndex + slashQuery.length + 1, // +1 for the /
			);
			const newValue = before + command.insertText + after;
			onChange(newValue);
			setSlashMenuOpen(false);
			setSlashQuery("");
			setSlashStartIndex(-1);

			// Set cursor after inserted text
			const cursorPos = before.length + command.insertText.length;
			requestAnimationFrame(() => {
				const ta = textareaRef.current;
				if (ta) {
					ta.selectionStart = cursorPos;
					ta.selectionEnd = cursorPos;
					ta.focus();
				}
			});
		},
		[value, onChange, slashStartIndex, slashQuery],
	);

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		// Forward keyboard events to slash menu when open
		if (slashMenuOpen) {
			if (["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(e.key)) {
				e.preventDefault();
				slashMenuRef.current?.handleKeyDown(e.key);
				return;
			}
		}

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

				{/* Slash command menu — floats above input */}
				{slashMenuOpen && (
					<SlashCommandMenu
						ref={slashMenuRef}
						query={slashQuery}
						onSelect={handleSlashSelect}
						onClose={() => setSlashMenuOpen(false)}
					/>
				)}

				<div className="space-y-2">
					{/* Attachment previews */}
					{attachments.length > 0 && (
						<AttachmentPreview
							attachments={attachments}
							onRemove={handleRemoveAttachment}
							onEdit={handleEditAttachment}
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
							onPaste={handlePaste}
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

							{/* Screenshot button — camera icon */}
							<button
								type="button"
								className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.08] transition-all duration-200 disabled:opacity-50"
								onClick={handleScreenshot}
								disabled={isDisabled || isCapturing}
								title="Take screenshot"
							>
								{isCapturing ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Camera className="h-4 w-4" />
								)}
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

			{/* Screenshot annotation editor overlay */}
			{editingImage && (
				<ScreenshotEditor
					image={editingImage}
					onSave={handleEditorSave}
					onCancel={handleEditorCancel}
				/>
			)}
		</form>
	);
}
