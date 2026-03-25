/**
 * Spritesheet Packer — Combines captured frames into a PIXI.Spritesheet atlas.
 *
 * Takes an array of captured PNG blobs (all same size from SpritesheetCapture)
 * and packs them into a single atlas PNG + PIXI-compatible JSON metadata.
 *
 * Uses simple grid layout (no complex bin-packing needed since all frames
 * are identical dimensions from the capture engine).
 */

import type { CapturedFrame } from "./spritesheet-capture";

/** PIXI.Spritesheet JSON format */
export interface SpritesheetJSON {
	frames: Record<
		string,
		{
			frame: { x: number; y: number; w: number; h: number };
			rotated: boolean;
			trimmed: boolean;
			spriteSourceSize: { x: number; y: number; w: number; h: number };
			sourceSize: { w: number; h: number };
		}
	>;
	animations: Record<string, string[]>;
	meta: {
		app: string;
		version: string;
		image: string;
		format: string;
		size: { w: number; h: number };
		scale: string;
	};
}

export interface PackResult {
	atlasBlob: Blob;
	metadata: SpritesheetJSON;
	atlasWidth: number;
	atlasHeight: number;
}

export interface PackConfig {
	padding?: number; // pixels between frames (default 0)
	maxWidth?: number; // max atlas width (default 4096)
	imageName?: string; // meta.image field (default 'sheet.png')
}

/**
 * Load a Blob as an HTMLImageElement.
 */
function blobToImage(blob: Blob): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(blob);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error("Failed to load frame as image"));
		};
		img.src = url;
	});
}

/**
 * Pack an array of captured frames into a single spritesheet atlas.
 * All frames must be the same dimensions.
 *
 * Groups frames by prefix (everything before the last _0000) into animations.
 */
export async function packFrames(
	frames: CapturedFrame[],
	config: Partial<PackConfig> = {},
): Promise<PackResult> {
	if (frames.length === 0) throw new Error("No frames to pack");

	const padding = config.padding ?? 0;
	const maxWidth = config.maxWidth ?? 4096;
	const imageName = config.imageName ?? "sheet.png";

	const fw = frames[0].width;
	const fh = frames[0].height;
	const cellW = fw + padding;
	const cellH = fh + padding;

	// Calculate grid dimensions
	const maxCols = Math.floor(maxWidth / cellW) || 1;
	const cols = Math.min(frames.length, maxCols);
	const rows = Math.ceil(frames.length / cols);
	const atlasWidth = cols * cellW - padding; // remove trailing padding
	const atlasHeight = rows * cellH - padding;

	// Create atlas canvas
	const canvas = document.createElement("canvas");
	canvas.width = atlasWidth;
	canvas.height = atlasHeight;
	const ctx = canvas.getContext("2d")!;

	// Frame metadata
	const frameMap: SpritesheetJSON["frames"] = {};

	// Draw each frame onto the atlas
	for (let i = 0; i < frames.length; i++) {
		const frame = frames[i];
		const col = i % cols;
		const row = Math.floor(i / cols);
		const x = col * cellW;
		const y = row * cellH;

		// Load blob as image and draw
		const img = await blobToImage(frame.blob);
		ctx.drawImage(img, x, y, fw, fh);

		// Record frame metadata
		frameMap[frame.name] = {
			frame: { x, y, w: fw, h: fh },
			rotated: false,
			trimmed: false,
			spriteSourceSize: { x: 0, y: 0, w: fw, h: fh },
			sourceSize: { w: fw, h: fh },
		};
	}

	// Group frames into animations by prefix
	const animations: Record<string, string[]> = {};
	for (const frame of frames) {
		// Extract prefix: "idle_front_0003" → "idle_front"
		const lastUnderscore = frame.name.lastIndexOf("_");
		const prefix =
			lastUnderscore > 0 ? frame.name.substring(0, lastUnderscore) : "default";
		if (!animations[prefix]) animations[prefix] = [];
		animations[prefix].push(frame.name);
	}

	const metadata: SpritesheetJSON = {
		frames: frameMap,
		animations,
		meta: {
			app: "https://vibexe.online",
			version: "1.0",
			image: imageName,
			format: "RGBA8888",
			size: { w: atlasWidth, h: atlasHeight },
			scale: "1",
		},
	};

	// Convert canvas to PNG blob
	const atlasBlob = await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) resolve(blob);
				else reject(new Error("Atlas canvas toBlob returned null"));
			},
			"image/png",
			1,
		);
	});

	return { atlasBlob, metadata, atlasWidth, atlasHeight };
}

/**
 * Pack multi-angle capture results into a single atlas.
 * Flattens the Map<angleName, CapturedFrame[]> into one array
 * while preserving animation grouping by angle.
 */
export async function packMultiAngle(
	angleMap: Map<string, CapturedFrame[]>,
	config: Partial<PackConfig> = {},
): Promise<PackResult> {
	// Flatten all frames from all angles into one array
	const allFrames: CapturedFrame[] = [];
	angleMap.forEach((frames) => {
		allFrames.push(...frames);
	});

	return packFrames(allFrames, config);
}

/**
 * Create a quick preview by sampling every Nth frame.
 * Returns a smaller set of frames for flipbook preview.
 */
export function sampleFrames(
	frames: CapturedFrame[],
	maxFrames = 8,
): CapturedFrame[] {
	if (frames.length <= maxFrames) return frames;
	const step = frames.length / maxFrames;
	const sampled: CapturedFrame[] = [];
	for (let i = 0; i < maxFrames; i++) {
		sampled.push(frames[Math.floor(i * step)]);
	}
	return sampled;
}
