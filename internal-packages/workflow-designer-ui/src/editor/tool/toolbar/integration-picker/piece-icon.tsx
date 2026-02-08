"use client";

import { useState } from "react";

interface PieceIconProps {
	logoUrl?: string;
	displayName: string;
	className?: string;
}

/**
 * Renders a piece icon with graceful fallback.
 * 1. If logoUrl is provided, render an <img>
 * 2. If the image fails to load, render a letter avatar
 * 3. If no logoUrl, render a letter avatar
 */
export function PieceIcon({ logoUrl, displayName, className = "size-[20px]" }: PieceIconProps) {
	const [imgError, setImgError] = useState(false);

	if (logoUrl && !imgError) {
		return (
			<img
				src={logoUrl}
				alt={displayName}
				className={`${className} rounded-[4px] object-contain`}
				onError={() => setImgError(true)}
			/>
		);
	}

	// Letter avatar fallback
	const letter = displayName.charAt(0).toUpperCase();
	return (
		<div
			className={`${className} rounded-[4px] flex items-center justify-center bg-[rgba(222,233,242,0.15)] text-[10px] font-semibold text-inverse shrink-0`}
		>
			{letter}
		</div>
	);
}
