import { Readable } from "node:stream";
import {
	DeleteObjectCommand,
	DeleteObjectsCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";

let _client: S3Client | null = null;

function getS3Client(): S3Client {
	if (!_client) {
		const endpoint = process.env.S3_STORAGE_URL;
		const region = process.env.S3_STORAGE_REGION;
		const accessKeyId = process.env.S3_STORAGE_ACCESS_KEY_ID;
		const secretAccessKey = process.env.S3_STORAGE_SECRET_ACCESS_KEY;
		if (!endpoint || !region || !accessKeyId || !secretAccessKey) {
			throw new Error(
				"Missing S3 storage configuration. Please set S3_STORAGE_URL, S3_STORAGE_REGION, S3_STORAGE_ACCESS_KEY_ID, S3_STORAGE_SECRET_ACCESS_KEY.",
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

async function streamToBuffer(stream: Readable): Promise<Buffer> {
	const chunks: Buffer[] = [];
	for await (const chunk of stream) {
		chunks.push(
			typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk),
		);
	}
	return Buffer.concat(chunks);
}

export async function downloadFile(
	bucket: string,
	key: string,
): Promise<Buffer> {
	const res = await getS3Client().send(
		new GetObjectCommand({ Bucket: bucket, Key: key }),
	);
	if (!res.Body) {
		throw new Error(`Failed to download file: ${key}`);
	}
	return await streamToBuffer(res.Body as Readable);
}

export async function uploadFile(
	bucket: string,
	key: string,
	data: Buffer | Uint8Array,
	options?: { contentType?: string; upsert?: boolean },
): Promise<void> {
	await getS3Client().send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: data,
			ContentType: options?.contentType,
		}),
	);
}

export async function removeFile(bucket: string, key: string): Promise<void> {
	await getS3Client().send(
		new DeleteObjectCommand({ Bucket: bucket, Key: key }),
	);
}

export async function removeFiles(
	bucket: string,
	keys: string[],
): Promise<void> {
	if (keys.length === 0) return;
	if (keys.length === 1) {
		await removeFile(bucket, keys[0]);
		return;
	}
	await getS3Client().send(
		new DeleteObjectsCommand({
			Bucket: bucket,
			Delete: { Objects: keys.map((Key) => ({ Key })) },
		}),
	);
}

export function getPublicUrl(bucket: string, path: string): string {
	const endpoint = process.env.S3_STORAGE_URL ?? "";
	return `${endpoint}/${bucket}/${path}`;
}
