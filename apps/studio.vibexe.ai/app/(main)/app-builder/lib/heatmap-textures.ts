/**
 * Predefined heatmap textures from SuperiorWorlds WorldBuilder
 *
 * These PNG masks are grayscale images where white = spawn, black = no spawn.
 * They provide manually-painted heatmaps for natural-looking population
 * distribution (forest coverage, grass areas, riverbanks, etc.).
 */

export interface PredefinedHeatmap {
	id: string;
	name: string;
	description: string;
	/** URL path (served from public/heatmaps/) */
	url: string;
	/** Preview thumbnail (same as url for these PNGs) */
	thumbnailUrl: string;
}

export const PREDEFINED_HEATMAPS: PredefinedHeatmap[] = [
	{
		id: "forest",
		name: "Forest",
		description: "Dense forest coverage mask — white areas are forested",
		url: "/heatmaps/ForestMask.png",
		thumbnailUrl: "/heatmaps/ForestMask.png",
	},
	{
		id: "grass-1",
		name: "Grass (Dense)",
		description: "Dense grass coverage — broad meadow areas",
		url: "/heatmaps/GrassMask1.png",
		thumbnailUrl: "/heatmaps/GrassMask1.png",
	},
	{
		id: "grass-2",
		name: "Grass (Sparse)",
		description: "Sparse grass patches — scattered ground cover",
		url: "/heatmaps/GrassMask2.png",
		thumbnailUrl: "/heatmaps/GrassMask2.png",
	},
	{
		id: "riparian",
		name: "Riparian (Riverside)",
		description: "Vegetation along riverbanks and water edges",
		url: "/heatmaps/RiparianMask.png",
		thumbnailUrl: "/heatmaps/RiparianMask.png",
	},
	{
		id: "riverbed",
		name: "Riverbed",
		description: "River channel and bed areas — rocks and water features",
		url: "/heatmaps/RiverbedMask.png",
		thumbnailUrl: "/heatmaps/RiverbedMask.png",
	},
];

/**
 * Load a PNG image URL and convert to HeatmapData (Float32Array of grayscale 0-1 values).
 * Uses canvas to decode the image and read pixel data.
 */
export async function loadTextureAsHeatmap(
	url: string,
	targetResolution = 128,
): Promise<{ data: Float32Array; width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => {
			const canvas = document.createElement("canvas");
			canvas.width = targetResolution;
			canvas.height = targetResolution;
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				reject(new Error("Failed to get canvas 2d context"));
				return;
			}

			// Draw image scaled to target resolution
			ctx.drawImage(img, 0, 0, targetResolution, targetResolution);
			const imageData = ctx.getImageData(0, 0, targetResolution, targetResolution);
			const pixels = imageData.data; // RGBA

			// Convert to grayscale Float32Array (0-1)
			const heatmap = new Float32Array(targetResolution * targetResolution);
			for (let i = 0; i < heatmap.length; i++) {
				const r = pixels[i * 4];
				const g = pixels[i * 4 + 1];
				const b = pixels[i * 4 + 2];
				// Standard luminance weights
				heatmap[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
			}

			resolve({ data: heatmap, width: targetResolution, height: targetResolution });
		};
		img.onerror = () => reject(new Error(`Failed to load heatmap image: ${url}`));
		img.src = url;
	});
}
