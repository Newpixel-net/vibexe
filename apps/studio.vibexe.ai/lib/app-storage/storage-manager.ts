/**
 * Per-App Storage Manager
 *
 * Wraps @aws-sdk/client-s3 for per-app file storage with namespace isolation.
 * All files are stored under `apps/{appId}/` prefix in a single S3 bucket.
 * Reuses the lazy singleton S3 client pattern from lib/s3-file-storage.ts.
 */

import { Readable } from "node:stream";
import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";

// ---- Lazy Singleton S3 Client ----

let _client: S3Client | null = null;

function getS3Client(): S3Client {
	if (!_client) {
		const endpoint = process.env.S3_STORAGE_URL;
		const region = process.env.S3_STORAGE_REGION;
		const accessKeyId = process.env.S3_STORAGE_ACCESS_KEY_ID;
		const secretAccessKey = process.env.S3_STORAGE_SECRET_ACCESS_KEY;
		if (!endpoint || !region || !accessKeyId || !secretAccessKey) {
			throw new Error(
				"Missing S3 storage configuration. Set S3_STORAGE_URL, S3_STORAGE_REGION, S3_STORAGE_ACCESS_KEY_ID, S3_STORAGE_SECRET_ACCESS_KEY.",
			);
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

function sanitizePath(path: string): string {
	// Normalize and strip path traversal sequences
	return path
		.replace(/\\/g, "/")           // normalize backslashes
		.replace(/\.{2,}\//g, "")       // strip ../
		.replace(/\/\.{2,}/g, "")       // strip /..
		.replace(/^\/+/, "")            // strip leading slashes
		.replace(/\0/g, "");            // strip null bytes
}

function appKey(appId: string, path: string): string {
	const safe = sanitizePath(path);
	if (!safe) throw new Error("Invalid file path");
	return `apps/${appId}/${safe}`;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
	const chunks: Buffer[] = [];
	for await (const chunk of stream) {
		chunks.push(
			typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk),
		);
	}
	return Buffer.concat(chunks);
}

// ---- Types ----

export interface FileInfo {
	path: string;
	size: number;
	contentType: string;
	lastModified: string;
	etag?: string;
	url: string;
}

export interface UploadResult {
	url: string;
	path: string;
	size: number;
	contentType: string;
}

export interface ListResult {
	files: FileInfo[];
	hasMore: boolean;
	cursor?: string;
}

export interface DownloadResult {
	data: Buffer;
	contentType: string;
	size: number;
	etag?: string;
	lastModified?: string;
}

// ---- Storage Manager Functions ----

export async function uploadFile(
	appId: string,
	path: string,
	data: Buffer | Uint8Array,
	contentType: string,
	metadata?: Record<string, string>,
): Promise<UploadResult> {
	const key = appKey(appId, path);
	const bucket = getBucket();

	await getS3Client().send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: data,
			ContentType: contentType,
			Metadata: metadata,
		}),
	);

	return {
		url: `/api/apps/${appId}/storage/${path}`,
		path,
		size: data.length,
		contentType,
	};
}

export async function downloadFile(
	appId: string,
	path: string,
): Promise<DownloadResult> {
	const key = appKey(appId, path);
	const bucket = getBucket();

	const res = await getS3Client().send(
		new GetObjectCommand({ Bucket: bucket, Key: key }),
	);

	if (!res.Body) {
		throw new Error(`File not found: ${path}`);
	}

	const buffer = await streamToBuffer(res.Body as Readable);

	return {
		data: buffer,
		contentType: res.ContentType ?? "application/octet-stream",
		size: buffer.length,
		etag: res.ETag ?? undefined,
		lastModified: res.LastModified?.toISOString(),
	};
}

export async function listFiles(
	appId: string,
	prefix?: string,
	limit = 50,
	cursor?: string,
): Promise<ListResult> {
	const bucket = getBucket();
	const safePrefix = prefix ? sanitizePath(prefix) : "";
	const fullPrefix = safePrefix
		? `apps/${appId}/${safePrefix}`
		: `apps/${appId}/`;

	// Exclude _transforms/ from listings
	const res = await getS3Client().send(
		new ListObjectsV2Command({
			Bucket: bucket,
			Prefix: fullPrefix,
			MaxKeys: limit + 1, // fetch one extra to detect hasMore
			ContinuationToken: cursor || undefined,
		}),
	);

	const contents = (res.Contents ?? [])
		.filter((obj) => !obj.Key?.includes("/_transforms/"));

	const hasMore = contents.length > limit;
	const items = hasMore ? contents.slice(0, limit) : contents;

	const files: FileInfo[] = items.map((obj) => {
		const relativePath = obj.Key!.replace(`apps/${appId}/`, "");
		return {
			path: relativePath,
			size: obj.Size ?? 0,
			contentType: "", // ListObjects doesn't return ContentType
			lastModified: obj.LastModified?.toISOString() ?? "",
			etag: obj.ETag ?? undefined,
			url: `/api/apps/${appId}/storage/${relativePath}`,
		};
	});

	return {
		files,
		hasMore,
		cursor: res.NextContinuationToken ?? undefined,
	};
}

export async function deleteFile(appId: string, path: string): Promise<void> {
	const key = appKey(appId, path);
	const bucket = getBucket();

	await getS3Client().send(
		new DeleteObjectCommand({ Bucket: bucket, Key: key }),
	);
}

export async function getFileInfo(
	appId: string,
	path: string,
): Promise<FileInfo | null> {
	const key = appKey(appId, path);
	const bucket = getBucket();

	try {
		const res = await getS3Client().send(
			new HeadObjectCommand({ Bucket: bucket, Key: key }),
		);

		return {
			path,
			size: res.ContentLength ?? 0,
			contentType: res.ContentType ?? "application/octet-stream",
			lastModified: res.LastModified?.toISOString() ?? "",
			etag: res.ETag ?? undefined,
			url: `/api/apps/${appId}/storage/${path}`,
		};
	} catch {
		return null;
	}
}

export function getPublicUrl(appId: string, path: string): string {
	return `/api/apps/${appId}/storage/${path}`;
}

/**
 * Calculate total storage used by an app (sum of all object sizes).
 */
export async function calculateUsedStorage(appId: string): Promise<number> {
	const bucket = getBucket();
	const prefix = `apps/${appId}/`;
	let totalBytes = 0;
	let continuationToken: string | undefined;

	do {
		const res = await getS3Client().send(
			new ListObjectsV2Command({
				Bucket: bucket,
				Prefix: prefix,
				ContinuationToken: continuationToken,
			}),
		);

		for (const obj of res.Contents ?? []) {
			totalBytes += obj.Size ?? 0;
		}

		continuationToken = res.NextContinuationToken;
	} while (continuationToken);

	return totalBytes;
}
