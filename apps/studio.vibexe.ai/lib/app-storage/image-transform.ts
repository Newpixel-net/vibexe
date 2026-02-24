/**
 * Image Transform Pipeline
 *
 * On-the-fly image resize/format conversion using sharp.
 * Transformed images are cached to S3 under `apps/{appId}/_transforms/` prefix.
 */

import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import {
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";

// ---- Lazy S3 Client (same as storage-manager) ----

let _client: S3Client | null = null;

function getS3Client(): S3Client {
	if (!_client) {
		const endpoint = process.env.S3_STORAGE_URL;
		const region = process.env.S3_STORAGE_REGION;
		const accessKeyId = process.env.S3_STORAGE_ACCESS_KEY_ID;
		const secretAccessKey = process.env.S3_STORAGE_SECRET_ACCESS_KEY;
		if (!endpoint || !region || !accessKeyId || !secretAccessKey) {
			throw new Error("Missing S3 storage configuration.");
		}
		_client = new S3Client({
			endpoint,
			region,
			credentials: { accessKeyId, secretAccessKey },
			forcePathStyle: true,
		});
	}
	return _client;
}

function getBucket(): string {
	return process.env.S3_STORAGE_BUCKET ?? "vibexe-storage";
}

// ---- Types ----

export interface TransformParams {
	width?: number;
	height?: number;
	format?: "webp" | "jpeg" | "png" | "avif";
	quality?: number;
}

interface TransformResult {
	data: Buffer;
	contentType: string;
}

const FORMAT_TO_CONTENT_TYPE: Record<string, string> = {
	webp: "image/webp",
	jpeg: "image/jpeg",
	png: "image/png",
	avif: "image/avif",
};

// ---- Transform ----

function getCacheKey(originalPath: string, params: TransformParams): string {
	const hash = createHash("md5")
		.update(`${originalPath}:${params.width ?? ""}:${params.height ?? ""}:${params.format ?? ""}:${params.quality ?? ""}`)
		.digest("hex");
	const ext = params.format ?? "webp";
	return `${hash}.${ext}`;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
	const chunks: Buffer[] = [];
	for await (const chunk of stream) {
		chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
	}
	return Buffer.concat(chunks);
}

/**
 * Check if a transformed image exists in cache.
 */
async function getCached(
	appId: string,
	cacheKey: string,
): Promise<TransformResult | null> {
	const bucket = getBucket();
	const key = `apps/${appId}/_transforms/${cacheKey}`;

	try {
		const res = await getS3Client().send(
			new GetObjectCommand({ Bucket: bucket, Key: key }),
		);
		if (!res.Body) return null;
		const data = await streamToBuffer(res.Body as Readable);
		return {
			data,
			contentType: res.ContentType ?? "image/webp",
		};
	} catch {
		return null;
	}
}

/**
 * Store a transformed image in cache.
 */
async function putCached(
	appId: string,
	cacheKey: string,
	data: Buffer,
	contentType: string,
): Promise<void> {
	const bucket = getBucket();
	const key = `apps/${appId}/_transforms/${cacheKey}`;

	await getS3Client().send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: data,
			ContentType: contentType,
		}),
	);
}

/**
 * Transform an image buffer with the given parameters.
 * Returns cached version if available, otherwise transforms and caches.
 */
export async function transformImage(
	appId: string,
	originalPath: string,
	buffer: Buffer,
	sourceContentType: string,
	params: TransformParams,
): Promise<TransformResult> {
	// Only transform images
	if (!sourceContentType.startsWith("image/")) {
		return { data: buffer, contentType: sourceContentType };
	}

	// No transform params = return original
	if (!params.width && !params.height && !params.format && !params.quality) {
		return { data: buffer, contentType: sourceContentType };
	}

	const cacheKey = getCacheKey(originalPath, params);

	// Check cache
	const cached = await getCached(appId, cacheKey);
	if (cached) return cached;

	// Dynamically import sharp (optional dependency)
	let sharp: typeof import("sharp");
	try {
		sharp = await import("sharp");
	} catch {
		// sharp not installed — return original
		console.warn("[ImageTransform] sharp not installed, returning original");
		return { data: buffer, contentType: sourceContentType };
	}

	// Apply transforms
	let pipeline = sharp.default(buffer);

	if (params.width || params.height) {
		pipeline = pipeline.resize(params.width, params.height, {
			fit: "inside",
			withoutEnlargement: true,
		});
	}

	const outputFormat = params.format ?? "webp";
	const quality = params.quality ?? 80;

	switch (outputFormat) {
		case "webp":
			pipeline = pipeline.webp({ quality });
			break;
		case "jpeg":
			pipeline = pipeline.jpeg({ quality });
			break;
		case "png":
			pipeline = pipeline.png({ quality });
			break;
		case "avif":
			pipeline = pipeline.avif({ quality });
			break;
	}

	const transformed = await pipeline.toBuffer();
	const contentType = FORMAT_TO_CONTENT_TYPE[outputFormat] ?? "image/webp";

	// Cache (fire-and-forget)
	putCached(appId, cacheKey, transformed, contentType).catch(() => {});

	return { data: transformed, contentType };
}

/**
 * Check if the content type is a transformable image.
 */
export function isTransformableImage(contentType: string): boolean {
	return ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"].includes(contentType);
}
