"use client";

/**
 * ScreenshotEditor Component — Canvas-based annotation editor
 *
 * Full-screen overlay with two-layer canvas (base image + annotations).
 * Tools: Crop, Rectangle, Arrow, Mask.
 * Glass-styled toolbar with Aurora aesthetic.
 */

import {
	Crop,
	EyeOff,
	MoveUpRight,
	RectangleHorizontal,
	Redo2,
	Undo2,
	X,
} from "lucide-react";
import {
	type MouseEvent as ReactMouseEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────

type Tool = "crop" | "rectangle" | "arrow" | "mask";

interface Point {
	x: number;
	y: number;
}

interface Annotation {
	type: "rectangle" | "arrow" | "mask";
	color: string;
	strokeWidth: number;
	/** Rectangle / Arrow / Mask: start + end points in image-space */
	start?: Point;
	end?: Point;
}

interface CropRect {
	x: number;
	y: number;
	w: number;
	h: number;
}

interface ScreenshotEditorProps {
	image: File;
	onSave: (annotatedFile: File) => void;
	onCancel: () => void;
}

// ── Constants ──────────────────────────────────────────────────────

const COLORS = [
	{ value: "#EF4444", label: "Red" },
	{ value: "#EAB308", label: "Yellow" },
	{ value: "#22C55E", label: "Green" },
	{ value: "#3B82F6", label: "Blue" },
	{ value: "#FFFFFF", label: "White" },
];

const STROKE_WIDTHS = [
	{ value: 2, label: "Thin" },
	{ value: 4, label: "Medium" },
	{ value: 6, label: "Thick" },
];

const TOOLS: { id: Tool; icon: typeof Crop; label: string }[] = [
	{ id: "crop", icon: Crop, label: "Crop" },
	{ id: "rectangle", icon: RectangleHorizontal, label: "Rectangle" },
	{ id: "arrow", icon: MoveUpRight, label: "Arrow" },
	{ id: "mask", icon: EyeOff, label: "Mask" },
];

const MAX_UNDO = 50;

// ── Helpers ────────────────────────────────────────────────────────

/** Convert mouse event coords to image-space coords.
 *  getBoundingClientRect() already includes the margin offset,
 *  so we only need to subtract rect.left/top and divide by scale. */
function toImageCoords(
	e: ReactMouseEvent | MouseEvent,
	canvas: HTMLCanvasElement,
	scale: number,
): Point {
	const rect = canvas.getBoundingClientRect();
	return {
		x: (e.clientX - rect.left) / scale,
		y: (e.clientY - rect.top) / scale,
	};
}

/** Draw an arrowhead at the tip of an arrow */
function drawArrowhead(
	ctx: CanvasRenderingContext2D,
	from: Point,
	to: Point,
	size: number,
) {
	const angle = Math.atan2(to.y - from.y, to.x - from.x);
	ctx.beginPath();
	ctx.moveTo(to.x, to.y);
	ctx.lineTo(
		to.x - size * Math.cos(angle - Math.PI / 6),
		to.y - size * Math.sin(angle - Math.PI / 6),
	);
	ctx.lineTo(
		to.x - size * Math.cos(angle + Math.PI / 6),
		to.y - size * Math.sin(angle + Math.PI / 6),
	);
	ctx.closePath();
	ctx.fill();
}

// ── Component ──────────────────────────────────────────────────────

export function ScreenshotEditor({
	image,
	onSave,
	onCancel,
}: ScreenshotEditorProps) {
	// Canvases
	const baseCanvasRef = useRef<HTMLCanvasElement>(null);
	const annoCanvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	// Image state
	const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);
	const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
	const [scale, setScale] = useState(1);
	const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

	// Cropped source region (in original image coords)
	const [cropApplied, setCropApplied] = useState<CropRect | null>(null);

	// Tool state
	const [activeTool, setActiveTool] = useState<Tool>("crop");
	const [color, setColor] = useState("#EF4444");
	const [strokeWidth, setStrokeWidth] = useState(4);

	// Crop state
	const [cropRect, setCropRect] = useState<CropRect | null>(null);
	const [cropDragging, setCropDragging] = useState<string | null>(null);
	const [cropDragStart, setCropDragStart] = useState<Point | null>(null);
	const [cropRectStart, setCropRectStart] = useState<CropRect | null>(null);

	// Drawing state
	const [isDrawing, setIsDrawing] = useState(false);
	const [drawStart, setDrawStart] = useState<Point | null>(null);
	const [drawCurrent, setDrawCurrent] = useState<Point | null>(null);

	// Annotations (undo/redo stacks)
	const [annotations, setAnnotations] = useState<Annotation[]>([]);
	const [redoStack, setRedoStack] = useState<Annotation[]>([]);

	// ── Load image ──────────────────────────────────────────────

	useEffect(() => {
		const url = URL.createObjectURL(image);
		const img = new Image();
		img.onload = () => {
			setImgElement(img);
			setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
		};
		img.src = url;
		return () => URL.revokeObjectURL(url);
	}, [image]);

	// ── Compute scale + offset to fit viewport ─────────────────

	useEffect(() => {
		if (!imgElement || !containerRef.current) return;

		const cw = imgSize.w;
		const ch = imgSize.h;
		if (cw === 0 || ch === 0) return;

		const containerRect = containerRef.current.getBoundingClientRect();
		const maxW = containerRect.width;
		const maxH = containerRect.height;

		// Fit image to viewport — allow scaling up for small captures
		const s = Math.min(maxW / cw, maxH / ch);
		setScale(s);
		setOffset({
			x: (maxW - cw * s) / 2,
			y: (maxH - ch * s) / 2,
		});
	}, [imgElement, imgSize]);

	// Effective image size (after crop)
	const effectiveW = cropApplied ? cropApplied.w : imgSize.w;
	const effectiveH = cropApplied ? cropApplied.h : imgSize.h;

	// Recalc scale when crop changes
	useEffect(() => {
		if (!containerRef.current || effectiveW === 0 || effectiveH === 0) return;
		const containerRect = containerRef.current.getBoundingClientRect();
		const maxW = containerRect.width;
		const maxH = containerRect.height;
		const s = Math.min(maxW / effectiveW, maxH / effectiveH);
		setScale(s);
		setOffset({
			x: (maxW - effectiveW * s) / 2,
			y: (maxH - effectiveH * s) / 2,
		});
	}, [effectiveW, effectiveH]);

	// ── Draw base canvas ────────────────────────────────────────

	useEffect(() => {
		const canvas = baseCanvasRef.current;
		if (!canvas || !imgElement) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		canvas.width = effectiveW;
		canvas.height = effectiveH;

		if (cropApplied) {
			ctx.drawImage(
				imgElement,
				cropApplied.x,
				cropApplied.y,
				cropApplied.w,
				cropApplied.h,
				0,
				0,
				cropApplied.w,
				cropApplied.h,
			);
		} else {
			ctx.drawImage(imgElement, 0, 0);
		}
	}, [imgElement, effectiveW, effectiveH, cropApplied]);

	// ── Render annotations onto the annotation canvas ──────────

	const renderAnnotations = useCallback(
		(list: Annotation[]) => {
			const canvas = annoCanvasRef.current;
			if (!canvas) return;
			const ctx = canvas.getContext("2d");
			if (!ctx) return;

			canvas.width = effectiveW;
			canvas.height = effectiveH;
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			for (const ann of list) {
				ctx.strokeStyle = ann.color;
				ctx.fillStyle = ann.color;
				ctx.lineWidth = ann.strokeWidth;
				ctx.lineCap = "round";
				ctx.lineJoin = "round";

				switch (ann.type) {
					case "rectangle":
						if (ann.start && ann.end) {
							const rx = Math.min(ann.start.x, ann.end.x);
							const ry = Math.min(ann.start.y, ann.end.y);
							const rw = Math.abs(ann.end.x - ann.start.x);
							const rh = Math.abs(ann.end.y - ann.start.y);
							ctx.strokeRect(rx, ry, rw, rh);
						}
						break;
					case "arrow":
						if (ann.start && ann.end) {
							ctx.beginPath();
							ctx.moveTo(ann.start.x, ann.start.y);
							ctx.lineTo(ann.end.x, ann.end.y);
							ctx.stroke();
							drawArrowhead(ctx, ann.start, ann.end, ann.strokeWidth * 4);
						}
						break;
					case "mask":
						if (ann.start && ann.end) {
							ctx.fillStyle = "rgba(0,0,0,0.95)";
							const rx = Math.min(ann.start.x, ann.end.x);
							const ry = Math.min(ann.start.y, ann.end.y);
							const rw = Math.abs(ann.end.x - ann.start.x);
							const rh = Math.abs(ann.end.y - ann.start.y);
							ctx.fillRect(rx, ry, rw, rh);
						}
						break;
				}
			}
		},
		[effectiveW, effectiveH],
	);

	useEffect(() => {
		renderAnnotations(annotations);
	}, [annotations, renderAnnotations]);

	// ── Crop overlay rendering ──────────────────────────────────

	const initCrop = useCallback(() => {
		const margin = Math.min(effectiveW, effectiveH) * 0.1;
		setCropRect({
			x: margin,
			y: margin,
			w: effectiveW - margin * 2,
			h: effectiveH - margin * 2,
		});
	}, [effectiveW, effectiveH]);

	useEffect(() => {
		if (activeTool === "crop" && !cropRect) {
			initCrop();
		}
		if (activeTool !== "crop") {
			setCropRect(null);
		}
	}, [activeTool, cropRect, initCrop]);

	// ── Crop handle hit-testing ────────────────────────────────

	const getCropHandle = useCallback(
		(p: Point): string | null => {
			if (!cropRect) return null;
			const hs = 8 / scale; // handle size in image coords
			const { x, y, w, h } = cropRect;

			const handles: Record<string, Point> = {
				tl: { x, y },
				tc: { x: x + w / 2, y },
				tr: { x: x + w, y },
				ml: { x, y: y + h / 2 },
				mr: { x: x + w, y: y + h / 2 },
				bl: { x, y: y + h },
				bc: { x: x + w / 2, y: y + h },
				br: { x: x + w, y: y + h },
			};

			for (const [key, hp] of Object.entries(handles)) {
				if (Math.abs(p.x - hp.x) < hs && Math.abs(p.y - hp.y) < hs) {
					return key;
				}
			}

			// Check if inside crop rect for move
			if (p.x > x && p.x < x + w && p.y > y && p.y < y + h) {
				return "move";
			}

			return null;
		},
		[cropRect, scale],
	);

	// ── Mouse handlers ─────────────────────────────────────────

	const handleMouseDown = useCallback(
		(e: ReactMouseEvent<HTMLCanvasElement>) => {
			const canvas = annoCanvasRef.current;
			if (!canvas) return;
			const p = toImageCoords(e, canvas, scale);

			if (activeTool === "crop") {
				const handle = getCropHandle(p);
				if (handle) {
					setCropDragging(handle);
					setCropDragStart(p);
					setCropRectStart(cropRect ? { ...cropRect } : null);
				}
				return;
			}

			setIsDrawing(true);
			setDrawStart(p);
			setDrawCurrent(p);
		},
		[activeTool, scale, getCropHandle, cropRect],
	);

	const handleMouseMove = useCallback(
		(e: ReactMouseEvent<HTMLCanvasElement>) => {
			const canvas = annoCanvasRef.current;
			if (!canvas) return;
			const p = toImageCoords(e, canvas, scale);

			// Crop dragging
			if (activeTool === "crop" && cropDragging && cropDragStart && cropRectStart) {
				const dx = p.x - cropDragStart.x;
				const dy = p.y - cropDragStart.y;
				const newRect = { ...cropRectStart };

				switch (cropDragging) {
					case "move":
						newRect.x = Math.max(0, Math.min(effectiveW - newRect.w, cropRectStart.x + dx));
						newRect.y = Math.max(0, Math.min(effectiveH - newRect.h, cropRectStart.y + dy));
						break;
					case "tl":
						newRect.x = cropRectStart.x + dx;
						newRect.y = cropRectStart.y + dy;
						newRect.w = cropRectStart.w - dx;
						newRect.h = cropRectStart.h - dy;
						break;
					case "tr":
						newRect.y = cropRectStart.y + dy;
						newRect.w = cropRectStart.w + dx;
						newRect.h = cropRectStart.h - dy;
						break;
					case "bl":
						newRect.x = cropRectStart.x + dx;
						newRect.w = cropRectStart.w - dx;
						newRect.h = cropRectStart.h + dy;
						break;
					case "br":
						newRect.w = cropRectStart.w + dx;
						newRect.h = cropRectStart.h + dy;
						break;
					case "tc":
						newRect.y = cropRectStart.y + dy;
						newRect.h = cropRectStart.h - dy;
						break;
					case "bc":
						newRect.h = cropRectStart.h + dy;
						break;
					case "ml":
						newRect.x = cropRectStart.x + dx;
						newRect.w = cropRectStart.w - dx;
						break;
					case "mr":
						newRect.w = cropRectStart.w + dx;
						break;
				}

				// Enforce minimum size
				if (newRect.w > 20 && newRect.h > 20) {
					setCropRect(newRect);
				}
				return;
			}

			if (!isDrawing) return;

			setDrawCurrent(p);

			// Live preview of current drawing
			const ctx = canvas.getContext("2d");
			if (!ctx) return;

			// Re-render existing annotations first
			renderAnnotations(annotations);

			ctx.strokeStyle = color;
			ctx.fillStyle = color;
			ctx.lineWidth = strokeWidth;
			ctx.lineCap = "round";
			ctx.lineJoin = "round";

			if (activeTool === "rectangle" && drawStart) {
				const rx = Math.min(drawStart.x, p.x);
				const ry = Math.min(drawStart.y, p.y);
				const rw = Math.abs(p.x - drawStart.x);
				const rh = Math.abs(p.y - drawStart.y);
				ctx.strokeRect(rx, ry, rw, rh);
			} else if (activeTool === "arrow" && drawStart) {
				ctx.beginPath();
				ctx.moveTo(drawStart.x, drawStart.y);
				ctx.lineTo(p.x, p.y);
				ctx.stroke();
				drawArrowhead(ctx, drawStart, p, strokeWidth * 4);
			} else if (activeTool === "mask" && drawStart) {
				ctx.fillStyle = "rgba(0,0,0,0.85)";
				const rx = Math.min(drawStart.x, p.x);
				const ry = Math.min(drawStart.y, p.y);
				const rw = Math.abs(p.x - drawStart.x);
				const rh = Math.abs(p.y - drawStart.y);
				ctx.fillRect(rx, ry, rw, rh);
			}
		},
		[
			activeTool,
			isDrawing,
			drawStart,
			scale,
			color,
			strokeWidth,
			annotations,
			renderAnnotations,
			cropDragging,
			cropDragStart,
			cropRectStart,
			effectiveW,
			effectiveH,
		],
	);

	const handleMouseUp = useCallback(() => {
		// Crop
		if (activeTool === "crop" && cropDragging) {
			setCropDragging(null);
			setCropDragStart(null);
			setCropRectStart(null);
			return;
		}

		if (!isDrawing || !drawStart) return;

		const end = drawCurrent ?? drawStart;

		if (activeTool === "rectangle" || activeTool === "arrow") {
			const dist = Math.sqrt((end.x - drawStart.x) ** 2 + (end.y - drawStart.y) ** 2);
			if (dist > 3) {
				const ann: Annotation = {
					type: activeTool,
					color,
					strokeWidth,
					start: drawStart,
					end,
				};
				setAnnotations((prev) => [...prev.slice(-MAX_UNDO + 1), ann]);
				setRedoStack([]);
			}
		} else if (activeTool === "mask") {
			const rx = Math.min(drawStart.x, end.x);
			const ry = Math.min(drawStart.y, end.y);
			const rw = Math.abs(end.x - drawStart.x);
			const rh = Math.abs(end.y - drawStart.y);
			if (rw > 4 && rh > 4) {
				const ann: Annotation = {
					type: "mask",
					color: "#000000",
					strokeWidth: 0,
					start: drawStart,
					end,
				};
				setAnnotations((prev) => [...prev.slice(-MAX_UNDO + 1), ann]);
				setRedoStack([]);
			}
		}

		setIsDrawing(false);
		setDrawStart(null);
		setDrawCurrent(null);
	}, [
		activeTool,
		isDrawing,
		drawStart,
		drawCurrent,
		color,
		strokeWidth,
		cropDragging,
	]);

	// ── Undo / Redo ────────────────────────────────────────────

	const undo = useCallback(() => {
		setAnnotations((prev) => {
			if (prev.length === 0) return prev;
			const last = prev[prev.length - 1];
			setRedoStack((r) => [...r, last]);
			return prev.slice(0, -1);
		});
	}, []);

	const redo = useCallback(() => {
		setRedoStack((prev) => {
			if (prev.length === 0) return prev;
			const last = prev[prev.length - 1];
			setAnnotations((a) => [...a, last]);
			return prev.slice(0, -1);
		});
	}, []);

	// ── Crop apply ──────────────────────────────────────────────

	const applyCrop = useCallback(() => {
		if (!cropRect) return;

		// Calculate the crop in original image coordinates
		const prevCrop = cropApplied;
		const newCrop: CropRect = {
			x: (prevCrop?.x ?? 0) + cropRect.x,
			y: (prevCrop?.y ?? 0) + cropRect.y,
			w: cropRect.w,
			h: cropRect.h,
		};

		setCropApplied(newCrop);
		setImgSize({ w: newCrop.w, h: newCrop.h });
		setAnnotations([]);
		setRedoStack([]);
		setCropRect(null);
		setActiveTool("rectangle");
	}, [cropRect, cropApplied]);

	// ── Save ────────────────────────────────────────────────────

	const handleSave = useCallback(async () => {
		const baseCanvas = baseCanvasRef.current;
		const annoCanvas = annoCanvasRef.current;
		if (!baseCanvas || !annoCanvas) return;

		// Compose onto offscreen canvas at original resolution
		const outCanvas = document.createElement("canvas");
		outCanvas.width = effectiveW;
		outCanvas.height = effectiveH;
		const ctx = outCanvas.getContext("2d");
		if (!ctx) return;

		ctx.drawImage(baseCanvas, 0, 0);
		ctx.drawImage(annoCanvas, 0, 0);

		const blob = await new Promise<Blob | null>((resolve) =>
			outCanvas.toBlob(resolve, "image/png"),
		);

		if (blob) {
			const timestamp = new Date()
				.toISOString()
				.replace(/[:.]/g, "-")
				.slice(0, 19);
			const file = new File([blob], `screenshot-${timestamp}.png`, {
				type: "image/png",
			});
			onSave(file);
		}
	}, [effectiveW, effectiveH, onSave]);

	// ── Keyboard shortcuts ──────────────────────────────────────

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				if (activeTool === "crop") {
					setCropRect(null);
					setActiveTool("rectangle");
				} else {
					onCancel();
				}
				return;
			}

			if ((e.ctrlKey || e.metaKey) && e.key === "z") {
				e.preventDefault();
				if (e.shiftKey) {
					redo();
				} else {
					undo();
				}
			}
		};

		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [onCancel, undo, redo, activeTool]);

	// ── Render ──────────────────────────────────────────────────

	if (!imgElement) {
		return (
			<div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center">
				<div className="text-white/50 text-sm">Loading image...</div>
			</div>
		);
	}

	const canvasStyle = {
		width: effectiveW * scale,
		height: effectiveH * scale,
		marginLeft: offset.x,
		marginTop: offset.y,
	};

	return (
		<div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col">
			{/* Header bar */}
			<div className="flex items-center justify-between px-4 py-2 shrink-0">
				<button
					type="button"
					onClick={onCancel}
					className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/60 hover:text-white/90 hover:bg-white/[0.08] transition-all text-sm"
				>
					<X className="h-4 w-4" />
					Cancel
				</button>

				<button
					type="button"
					onClick={handleSave}
					className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white text-sm font-medium hover:scale-105 transition-transform shadow-[0_0_12px_rgba(124,58,237,0.3)]"
				>
					Attach
				</button>
			</div>

			{/* Toolbar */}
			<div className="flex items-center justify-center px-4 py-2 shrink-0">
				<div className="flex items-center gap-1 bg-white/[0.06] border border-white/[0.1] backdrop-blur-sm rounded-xl px-2 py-1.5">
					{/* Tool buttons */}
					{TOOLS.map(({ id, icon: Icon, label }) => (
						<button
							key={id}
							type="button"
							onClick={() => setActiveTool(id)}
							className={cn(
								"h-8 w-8 flex items-center justify-center rounded-lg transition-all text-sm",
								activeTool === id
									? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
									: "text-white/50 hover:text-white/80 hover:bg-white/[0.06] border border-transparent",
							)}
							title={label}
						>
							<Icon className="h-4 w-4" />
						</button>
					))}

					{/* Separator */}
					<div className="w-px h-6 bg-white/[0.1] mx-1" />

					{/* Crop apply button */}
					{activeTool === "crop" && cropRect && (
						<>
							<button
								type="button"
								onClick={applyCrop}
								className="px-2.5 py-1 rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/30 text-xs font-medium hover:bg-violet-500/30 transition-all"
							>
								Apply Crop
							</button>
							<div className="w-px h-6 bg-white/[0.1] mx-1" />
						</>
					)}

					{/* Color dots + stroke (hide during crop/mask) */}
					{activeTool !== "crop" && activeTool !== "mask" && (
						<>
							{COLORS.map(({ value, label }) => (
								<button
									key={value}
									type="button"
									onClick={() => setColor(value)}
									className={cn(
										"h-5 w-5 rounded-full border-2 transition-all mx-0.5",
										color === value
											? "border-white scale-110"
											: "border-white/20 hover:border-white/50",
									)}
									style={{ backgroundColor: value }}
									title={label}
								/>
							))}

							<div className="w-px h-6 bg-white/[0.1] mx-1" />

							{/* Stroke width dots */}
							{STROKE_WIDTHS.map(({ value, label }) => (
								<button
									key={value}
									type="button"
									onClick={() => setStrokeWidth(value)}
									className={cn(
										"flex items-center justify-center h-7 w-7 rounded-lg transition-all",
										strokeWidth === value
											? "bg-white/[0.1] border border-white/20"
											: "hover:bg-white/[0.06] border border-transparent",
									)}
									title={label}
								>
									<div
										className="rounded-full bg-white/70"
										style={{
											width: value + 2,
											height: value + 2,
										}}
									/>
								</button>
							))}

							<div className="w-px h-6 bg-white/[0.1] mx-1" />
						</>
					)}

					{/* Undo / Redo */}
					<button
						type="button"
						onClick={undo}
						disabled={annotations.length === 0}
						className="h-8 w-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-all disabled:opacity-25 disabled:cursor-not-allowed"
						title="Undo (Ctrl+Z)"
					>
						<Undo2 className="h-4 w-4" />
					</button>
					<button
						type="button"
						onClick={redo}
						disabled={redoStack.length === 0}
						className="h-8 w-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-all disabled:opacity-25 disabled:cursor-not-allowed"
						title="Redo (Ctrl+Shift+Z)"
					>
						<Redo2 className="h-4 w-4" />
					</button>
				</div>
			</div>

			{/* Canvas area */}
			<div ref={containerRef} className="flex-1 relative overflow-hidden min-h-0">
				{/* Base canvas (image only) */}
				<canvas
					ref={baseCanvasRef}
					className="absolute top-0 left-0 pointer-events-none"
					style={canvasStyle}
				/>

				{/* Annotation canvas (drawings overlay) */}
				<canvas
					ref={annoCanvasRef}
					className="absolute top-0 left-0"
					style={{ ...canvasStyle, cursor: "crosshair" }}
					onMouseDown={handleMouseDown}
					onMouseMove={handleMouseMove}
					onMouseUp={handleMouseUp}
					onMouseLeave={handleMouseUp}
				/>

				{/* Crop overlay */}
				{activeTool === "crop" && cropRect && (
					<div
						className="absolute top-0 left-0 pointer-events-none"
						style={canvasStyle}
					>
						{/* Dark mask with cutout */}
						<svg
							width={effectiveW * scale}
							height={effectiveH * scale}
							className="absolute inset-0"
						>
							<defs>
								<mask id="crop-mask">
									<rect width="100%" height="100%" fill="white" />
									<rect
										x={cropRect.x * scale}
										y={cropRect.y * scale}
										width={cropRect.w * scale}
										height={cropRect.h * scale}
										fill="black"
									/>
								</mask>
							</defs>
							<rect
								width="100%"
								height="100%"
								fill="rgba(0,0,0,0.6)"
								mask="url(#crop-mask)"
							/>
							{/* Bright border around crop region */}
							<rect
								x={cropRect.x * scale}
								y={cropRect.y * scale}
								width={cropRect.w * scale}
								height={cropRect.h * scale}
								fill="none"
								stroke="white"
								strokeWidth="2"
							/>
							{/* Rule-of-thirds grid */}
							{[1 / 3, 2 / 3].map((frac) => (
								<g key={frac}>
									<line
										x1={cropRect.x * scale + cropRect.w * scale * frac}
										y1={cropRect.y * scale}
										x2={cropRect.x * scale + cropRect.w * scale * frac}
										y2={(cropRect.y + cropRect.h) * scale}
										stroke="rgba(255,255,255,0.3)"
										strokeWidth="0.5"
									/>
									<line
										x1={cropRect.x * scale}
										y1={cropRect.y * scale + cropRect.h * scale * frac}
										x2={(cropRect.x + cropRect.w) * scale}
										y2={cropRect.y * scale + cropRect.h * scale * frac}
										stroke="rgba(255,255,255,0.3)"
										strokeWidth="0.5"
									/>
								</g>
							))}
							{/* 8 resize handles */}
							{[
								{ cx: cropRect.x, cy: cropRect.y },
								{ cx: cropRect.x + cropRect.w / 2, cy: cropRect.y },
								{ cx: cropRect.x + cropRect.w, cy: cropRect.y },
								{ cx: cropRect.x, cy: cropRect.y + cropRect.h / 2 },
								{ cx: cropRect.x + cropRect.w, cy: cropRect.y + cropRect.h / 2 },
								{ cx: cropRect.x, cy: cropRect.y + cropRect.h },
								{ cx: cropRect.x + cropRect.w / 2, cy: cropRect.y + cropRect.h },
								{ cx: cropRect.x + cropRect.w, cy: cropRect.y + cropRect.h },
							].map((h, i) => (
								<rect
									key={i}
									x={h.cx * scale - 4}
									y={h.cy * scale - 4}
									width={8}
									height={8}
									fill="white"
									stroke="rgba(0,0,0,0.3)"
									strokeWidth="1"
									rx="1"
								/>
							))}
						</svg>
					</div>
				)}

			</div>
		</div>
	);
}
