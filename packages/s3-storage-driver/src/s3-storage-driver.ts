import { Readable } from "node:stream";
import {
	CopyObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import type {
	BlobLike,
	GetJsonParams,
	VibexeStorage,
	SetJsonParams,
} from "@vibexe-ai/storage";
import type { z } from "zod/v4";

export interface S3StorageDriverConfig {
	endpoint: string;
	region: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
}

function isReadable(obj: unknown): obj is Readable {
	return obj instanceof Readable;
}

async function streamToUint8Array(stream: Readable): Promise<Uint8Array> {
	const chunks: Buffer[] = [];
	for await (const chunk of stream) {
		chunks.push(
			typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk),
		);
	}
	return new Uint8Array(Buffer.concat(chunks));
}

export function s3StorageDriver(
	config: S3StorageDriverConfig,
): VibexeStorage {
	let _client: S3Client | null = null;
	function getClient(): S3Client {
		if (!_client) {
			_client = new S3Client({
				endpoint: config.endpoint,
				region: config.region,
				credentials: {
					accessKeyId: config.accessKeyId,
					secretAccessKey: config.secretAccessKey,
				},
				forcePathStyle: true,
			});
		}
		return _client;
	}

	return {
		async getJson<T extends z.ZodType>(
			params: GetJsonParams<T>,
		): Promise<z.infer<T>> {
			const res = await getClient().send(
				new GetObjectCommand({ Bucket: config.bucket, Key: params.path }),
			);
			if (!res.Body || !isReadable(res.Body as Readable)) {
				throw new Error("Invalid body returned from storage");
			}
			const bytes = await streamToUint8Array(res.Body as Readable);
			const obj = JSON.parse(Buffer.from(bytes).toString("utf8"));
			return params.schema.parse(obj);
		},

		async setJson<T extends z.ZodType>(
			params: SetJsonParams<T>,
		): Promise<void> {
			const data = params.schema
				? params.schema.parse(params.data)
				: params.data;
			const body = JSON.stringify(data);
			await getClient().send(
				new PutObjectCommand({
					Bucket: config.bucket,
					Key: params.path,
					Body: body,
					ContentType: "application/json",
				}),
			);
		},

		async getBlob(
			path: string,
			options?: { range?: { start: number; end?: number } },
		) {
			const command = new GetObjectCommand({
				Bucket: config.bucket,
				Key: path,
				...(options?.range && {
					Range: `bytes=${options.range.start}-${options.range.end ?? ""}`,
				}),
			});

			const res = await getClient().send(command);
			if (!res.Body || !isReadable(res.Body as Readable)) {
				throw new Error("Invalid body returned from storage");
			}
			return await streamToUint8Array(res.Body as Readable);
		},

		async setBlob(path: string, data: BlobLike): Promise<void> {
			const uint8Array = new Uint8Array(data);
			await getClient().send(
				new PutObjectCommand({
					Bucket: config.bucket,
					Key: path,
					Body: uint8Array,
				}),
			);
		},

		async copy(source: string, destination: string): Promise<void> {
			await getClient().send(
				new CopyObjectCommand({
					Bucket: config.bucket,
					Key: destination,
					CopySource: `${config.bucket}/${source}`,
				}),
			);
		},

		async remove(path: string): Promise<void> {
			await getClient().send(
				new DeleteObjectCommand({ Bucket: config.bucket, Key: path }),
			);
		},

		async exists(path: string): Promise<boolean> {
			try {
				await getClient().send(
					new HeadObjectCommand({ Bucket: config.bucket, Key: path }),
				);
				return true;
			} catch (err) {
				if (err && typeof err === "object" && "$metadata" in err) {
					const metadata = err.$metadata as { httpStatusCode?: number };
					if (
						metadata.httpStatusCode === 404 ||
						metadata.httpStatusCode === 403
					) {
						return false;
					}
				}
				throw err;
			}
		},

		async contentLength(path: string): Promise<number> {
			const response = await getClient().send(
				new HeadObjectCommand({ Bucket: config.bucket, Key: path }),
			);
			return response.ContentLength ?? 0;
		},

		async listBlobs(params = {}) {
			const normalizedPrefix =
				typeof params.prefix === "string"
					? params.prefix.replace(/^\/+/, "")
					: undefined;

			const maxKeys =
				typeof params.limit === "number" && params.limit > 0
					? Math.min(params.limit, 1000)
					: undefined;

			const command = new ListObjectsV2Command({
				Bucket: config.bucket,
				Prefix:
					normalizedPrefix && normalizedPrefix.length > 0
						? normalizedPrefix
						: undefined,
				ContinuationToken:
					typeof params.cursor === "string" ? params.cursor : undefined,
				MaxKeys: maxKeys,
			});

			const response = await getClient().send(command);

			const blobs =
				response.Contents?.flatMap((item) => {
					if (!item.Key) {
						return [];
					}

					return [
						{
							pathname: item.Key,
							size: item.Size ?? 0,
							uploadedAt: item.LastModified ?? new Date(0),
							etag: item.ETag ?? undefined,
						},
					];
				}) ?? [];

			return {
				blobs,
				hasMore: response.IsTruncated ?? false,
				cursor: response.NextContinuationToken ?? undefined,
			};
		},
	};
}
