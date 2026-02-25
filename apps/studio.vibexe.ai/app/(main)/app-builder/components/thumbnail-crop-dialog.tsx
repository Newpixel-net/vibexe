"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Crop, X } from "lucide-react";

interface ThumbnailCropDialogProps {
	imageDataUrl: string;
	onCrop: (blob: Blob) => void;
	onSkip: () => void;
	onCancel: () => void;
}

const OUTPUT_WIDTH = 800;
const OUTPUT_HEIGHT = 450;
const ASPECT = OUTPUT_WIDTH / OUTPUT_HEIGHT; // 16:9

export function ThumbnailCropDialog({
	imageDataUrl,
	onCrop,
	onSkip,
	onCancel,
}: ThumbnailCropDialogProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const imgRef = useRef<HTMLImageElement | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	// Image natural dimensions
	const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
	// Display scale factor (fit image into viewport)
	const [scale, setScale] = useState(1);
	// Crop rect in image-space coordinates
	const [cropRect, setCropRect] = useState({ x: 0, y: 0, w: 0, h: 0 });
	// Drag state
	const [dragging, setDragging] = useState(false);
	const dragStart = useRef({ mx: 0, my: 0, cx: 0, cy: 0 });

	// Load image and compute initial crop
	useEffect(() => {
		const img = new Image();
		img.onload = () => {
			imgRef.current = img;
			const w = img.naturalWidth;
			const h = img.naturalHeight;
			setImgSize({ w, h });

			// Default crop: full width, top portion at 16:9
			const cropW = w;
			const cropH = Math.min(Math.round(w / ASPECT), h);
			setCropRect({ x: 0, y: 0, w: cropW, h: cropH });

			// Compute display scale to fit in viewport (max 90vw, 70vh)
			const maxDisplayW = window.innerWidth * 0.9;
			const maxDisplayH = window.innerHeight * 0.7;
			const s = Math.min(maxDisplayW / w, maxDisplayH / h, 1);
			setScale(s);
		};
		img.src = imageDataUrl;
	}, [imageDataUrl]);

	// Redraw canvas
	const draw = useCallback(() => {
		const canvas = canvasRef.current;
		const img = imgRef.current;
		if (!canvas || !img || imgSize.w === 0) return;

		const dw = Math.round(imgSize.w * scale);
		const dh = Math.round(imgSize.h * scale);
		canvas.width = dw;
		canvas.height = dh;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Draw full image dimmed
		ctx.drawImage(img, 0, 0, dw, dh);
		ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
		ctx.fillRect(0, 0, dw, dh);

		// Draw crop region bright
		const sx = cropRect.x * scale;
		const sy = cropRect.y * scale;
		const sw = cropRect.w * scale;
		const sh = cropRect.h * scale;
		ctx.save();
		ctx.beginPath();
		ctx.rect(sx, sy, sw, sh);
		ctx.clip();
		ctx.drawImage(img, 0, 0, dw, dh);
		ctx.restore();

		// Border around crop region
		ctx.strokeStyle = "#6366f1";
		ctx.lineWidth = 2;
		ctx.strokeRect(sx, sy, sw, sh);

		// Corner handles
		const handleSize = 8;
		ctx.fillStyle = "#6366f1";
		const corners = [
			[sx, sy],
			[sx + sw, sy],
			[sx, sy + sh],
			[sx + sw, sy + sh],
		];
		for (const [cx, cy] of corners) {
			ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
		}
	}, [imgSize, scale, cropRect]);

	useEffect(() => {
		draw();
	}, [draw]);

	// Mouse handlers for dragging crop region
	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			const canvas = canvasRef.current;
			if (!canvas) return;
			const rect = canvas.getBoundingClientRect();
			const mx = e.clientX - rect.left;
			const my = e.clientY - rect.top;

			// Check if click is inside crop rect (in display coords)
			const sx = cropRect.x * scale;
			const sy = cropRect.y * scale;
			const sw = cropRect.w * scale;
			const sh = cropRect.h * scale;

			if (mx >= sx && mx <= sx + sw && my >= sy && my <= sy + sh) {
				setDragging(true);
				dragStart.current = { mx, my, cx: cropRect.x, cy: cropRect.y };
			}
		},
		[cropRect, scale],
	);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			if (!dragging) return;
			const canvas = canvasRef.current;
			if (!canvas) return;
			const rect = canvas.getBoundingClientRect();
			const mx = e.clientX - rect.left;
			const my = e.clientY - rect.top;

			const dx = (mx - dragStart.current.mx) / scale;
			const dy = (my - dragStart.current.my) / scale;

			let newX = Math.round(dragStart.current.cx + dx);
			let newY = Math.round(dragStart.current.cy + dy);

			// Clamp to image bounds
			newX = Math.max(0, Math.min(newX, imgSize.w - cropRect.w));
			newY = Math.max(0, Math.min(newY, imgSize.h - cropRect.h));

			setCropRect((prev) => ({ ...prev, x: newX, y: newY }));
		},
		[dragging, scale, imgSize, cropRect.w, cropRect.h],
	);

	const handleMouseUp = useCallback(() => {
		setDragging(false);
	}, []);

	// Apply crop
	const handleApplyCrop = useCallback(() => {
		const img = imgRef.current;
		if (!img) return;

		const outCanvas = document.createElement("canvas");
		outCanvas.width = OUTPUT_WIDTH;
		outCanvas.height = OUTPUT_HEIGHT;
		const ctx = outCanvas.getContext("2d");
		if (!ctx) return;

		ctx.drawImage(
			img,
			cropRect.x,
			cropRect.y,
			cropRect.w,
			cropRect.h,
			0,
			0,
			OUTPUT_WIDTH,
			OUTPUT_HEIGHT,
		);

		outCanvas.toBlob(
			(blob) => {
				if (blob) onCrop(blob);
			},
			"image/png",
		);
	}, [cropRect, onCrop]);

	return (
		<div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
			{/* Header */}
			<div className="flex items-center gap-3 mb-4">
				<Crop className="h-5 w-5 text-violet-400" />
				<h2 className="text-lg font-semibold text-white">
					Crop Thumbnail Region
				</h2>
				<span className="text-xs text-white/40 ml-2">
					Drag the bright region to select the thumbnail area (16:9)
				</span>
			</div>

			{/* Canvas */}
			<div
				ref={containerRef}
				className="relative rounded-xl overflow-hidden border border-white/10 shadow-2xl"
			>
				<canvas
					ref={canvasRef}
					className="cursor-move"
					onMouseDown={handleMouseDown}
					onMouseMove={handleMouseMove}
					onMouseUp={handleMouseUp}
					onMouseLeave={handleMouseUp}
				/>
			</div>

			{/* Actions */}
			<div className="flex items-center gap-3 mt-5">
				<button
					type="button"
					onClick={onCancel}
					className="px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/60 text-sm font-medium hover:bg-white/[0.1] transition-colors flex items-center gap-2"
				>
					<X className="h-4 w-4" />
					Cancel
				</button>
				<button
					type="button"
					onClick={onSkip}
					className="px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/70 text-sm font-medium hover:bg-white/[0.1] transition-colors flex items-center gap-2"
				>
					Use Top (Auto)
				</button>
				<button
					type="button"
					onClick={handleApplyCrop}
					className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-500/80 to-cyan-500/80 text-white text-sm font-medium hover:from-violet-500 hover:to-cyan-500 transition-colors flex items-center gap-2"
				>
					<Check className="h-4 w-4" />
					Use Selection
				</button>
			</div>
		</div>
	);
}
