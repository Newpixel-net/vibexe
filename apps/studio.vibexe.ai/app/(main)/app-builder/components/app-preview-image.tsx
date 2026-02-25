"use client";

import { useCallback, useRef, useState } from "react";

export const PREVIEW_CONTAINER_HEIGHT = 300;

/**
 * Preview image component with auto-scroll for tall captures.
 * Shared between template gallery and app cards.
 */
export function PreviewImage({
	src,
	alt,
	containerHeight = PREVIEW_CONTAINER_HEIGHT,
}: {
	src: string;
	alt: string;
	containerHeight?: number;
}) {
	const imgRef = useRef<HTMLImageElement>(null);
	const [isTall, setIsTall] = useState(false);
	const [animDuration, setAnimDuration] = useState(6);

	const handleLoad = useCallback(() => {
		const img = imgRef.current;
		if (!img) return;
		const displayWidth = 400;
		const displayHeight = (img.naturalHeight / img.naturalWidth) * displayWidth;
		if (displayHeight > containerHeight * 1.3) {
			setIsTall(true);
			const scrollDistance = displayHeight - containerHeight;
			const dur = Math.max(4, Math.min(15, scrollDistance / 50));
			setAnimDuration(dur);
		}
	}, [containerHeight]);

	if (isTall) {
		return (
			<div className="w-full" style={{ height: containerHeight, overflow: "hidden" }}>
				<img
					ref={imgRef}
					src={src}
					alt={alt}
					onLoad={handleLoad}
					className="w-full"
					style={{
						animation: `previewAutoScroll ${animDuration}s ease-in-out 0.5s infinite alternate`,
					}}
				/>
			</div>
		);
	}

	return (
		<img
			ref={imgRef}
			src={src}
			alt={alt}
			onLoad={handleLoad}
			className="w-full object-cover"
			style={{ height: containerHeight }}
		/>
	);
}

/** Inject auto-scroll keyframes into the document (once, client-side only) */
export function injectPreviewScrollKeyframes() {
	if (typeof document === "undefined") return;
	const styleId = "vibexe-preview-scroll-keyframes";
	if (!document.getElementById(styleId)) {
		const style = document.createElement("style");
		style.id = styleId;
		style.textContent = `
			@keyframes previewAutoScroll {
				0% { transform: translateY(0); }
				100% { transform: translateY(calc(-100% + ${PREVIEW_CONTAINER_HEIGHT}px)); }
			}
		`;
		document.head.appendChild(style);
	}
}
