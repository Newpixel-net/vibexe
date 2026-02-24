"use client";

/**
 * AttachmentLightbox Component
 *
 * Full-screen overlay for previewing image attachments.
 * Click backdrop or press Escape to close.
 */

import { X } from "lucide-react";
import { useCallback, useEffect } from "react";

interface AttachmentLightboxProps {
	url: string;
	name: string;
	size: number;
	onClose: () => void;
}

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function AttachmentLightbox({ url, name, size, onClose }: AttachmentLightboxProps) {
	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		},
		[onClose],
	);

	useEffect(() => {
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [handleKeyDown]);

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
			onClick={onClose}
			onKeyDown={(e) => e.key === "Escape" && onClose()}
			role="dialog"
			aria-modal="true"
			aria-label={`Preview: ${name}`}
		>
			<div
				className="relative max-w-[90vw] max-h-[85vh] flex flex-col items-center"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={() => {}}
				role="presentation"
			>
				{/* Close button */}
				<button
					type="button"
					onClick={onClose}
					className="absolute -top-10 right-0 h-8 w-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
				>
					<X className="h-5 w-5" />
				</button>

				{/* Image */}
				{/* biome-ignore lint/performance/noImgElement: Dynamic blob/data URLs */}
				<img
					src={url}
					alt={name}
					className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg"
				/>

				{/* Caption */}
				<div className="mt-3 text-center text-white/80 text-sm">
					<span className="font-medium">{name}</span>
					{size > 0 && <span className="ml-2 text-white/50">{formatSize(size)}</span>}
				</div>
			</div>
		</div>
	);
}
