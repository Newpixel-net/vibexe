"use client";

/**
 * AttachmentPreview Component
 *
 * Modern preview for attached files (images + documents) before sending.
 * Images show as thumbnails, documents as compact cards.
 * Includes file count indicator with model limit awareness.
 */

import { FileText, X } from "lucide-react";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import type { Attachment } from "../types/vibesdk";
import { AttachmentLightbox } from "./attachment-lightbox";

interface AttachmentPreviewProps {
	attachments: Attachment[];
	onRemove: (id: string) => void;
	maxFiles?: number;
	className?: string;
}

/** Format bytes to human-readable size */
function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** Get icon color for document type */
function getDocColor(mediaType: string): string {
	if (mediaType === "application/pdf") return "text-red-500";
	if (mediaType.includes("csv")) return "text-green-500";
	return "text-muted-foreground";
}

export function AttachmentPreview({
	attachments,
	onRemove,
	maxFiles = 20,
	className,
}: AttachmentPreviewProps) {
	const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
	const [lightboxName, setLightboxName] = useState("");
	const [lightboxSize, setLightboxSize] = useState(0);

	const images = attachments.filter((a) => a.category === "image");
	const documents = attachments.filter((a) => a.category === "document");

	const handleImageClick = useCallback((attachment: Attachment) => {
		setLightboxUrl(attachment.url);
		setLightboxName(attachment.name);
		setLightboxSize(attachment.size);
	}, []);

	const closeLightbox = useCallback(() => {
		setLightboxUrl(null);
	}, []);

	if (attachments.length === 0) return null;

	const ratio = attachments.length / maxFiles;
	const counterColor =
		ratio >= 1 ? "text-red-500" : ratio >= 0.8 ? "text-orange-500" : "text-muted-foreground";

	return (
		<>
			<div className={cn("space-y-2", className)}>
				{/* Image thumbnails */}
				{images.length > 0 && (
					<div className="flex flex-wrap gap-2">
						{images.map((att) => (
							<div
								key={att.id}
								className="relative group rounded-lg overflow-hidden border border-border bg-muted cursor-pointer transition-transform hover:scale-105"
							>
								{/* biome-ignore lint/a11y/useKeyWithClickEvents: Thumbnail click */}
								{/* biome-ignore lint/performance/noImgElement: Dynamic blob URLs */}
								<img
									src={att.url}
									alt={att.name}
									className="w-16 h-16 object-cover"
									onClick={() => handleImageClick(att)}
								/>
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										onRemove(att.id);
									}}
									className={cn(
										"absolute top-0.5 right-0.5 h-5 w-5 flex items-center justify-center rounded-full",
										"bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground",
										"opacity-0 group-hover:opacity-100 transition-opacity",
									)}
								>
									<X className="h-3 w-3" />
								</button>
								<div
									className={cn(
										"absolute bottom-0 left-0 right-0 px-1 py-0.5",
										"bg-background/80 text-[10px] text-muted-foreground truncate",
										"opacity-0 group-hover:opacity-100 transition-opacity",
									)}
								>
									{att.name}
								</div>
							</div>
						))}
					</div>
				)}

				{/* Document cards */}
				{documents.length > 0 && (
					<div className="flex flex-wrap gap-2">
						{documents.map((att) => (
							<div
								key={att.id}
								className="group flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border bg-muted/50 max-w-[200px]"
							>
								<FileText className={cn("h-4 w-4 flex-shrink-0", getDocColor(att.mediaType))} />
								<div className="flex-1 min-w-0">
									<div className="text-xs font-medium truncate">{att.name}</div>
									<div className="text-[10px] text-muted-foreground">{formatSize(att.size)}</div>
								</div>
								<button
									type="button"
									onClick={() => onRemove(att.id)}
									className={cn(
										"h-4 w-4 flex items-center justify-center rounded-full flex-shrink-0",
										"text-muted-foreground hover:text-foreground",
										"opacity-0 group-hover:opacity-100 transition-opacity",
									)}
								>
									<X className="h-3 w-3" />
								</button>
							</div>
						))}
					</div>
				)}

				{/* File counter */}
				{attachments.length > 1 && (
					<div className={cn("text-[11px] px-1", counterColor)}>
						{attachments.length} file{attachments.length !== 1 ? "s" : ""} attached (max {maxFiles})
					</div>
				)}
			</div>

			{/* Lightbox overlay */}
			{lightboxUrl && (
				<AttachmentLightbox
					url={lightboxUrl}
					name={lightboxName}
					size={lightboxSize}
					onClose={closeLightbox}
				/>
			)}
		</>
	);
}
