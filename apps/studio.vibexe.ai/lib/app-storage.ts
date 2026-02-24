import {
	downloadFile,
	getPublicUrl,
	removeFile,
	removeFiles,
	uploadFile,
} from "@/lib/s3-file-storage";

const storageBucketName = "public-assets";

/**
 * S3-backed storage helper for the public-assets bucket.
 * Provides the same upload/remove/getPublicUrl interface that callers expect.
 */
export function appStorage() {
	return {
		async upload(
			path: string,
			data: Buffer | Uint8Array,
			options?: { contentType?: string; upsert?: boolean },
		): Promise<{ data: { path: string }; error: null } | { data: null; error: Error }> {
			try {
				await uploadFile(storageBucketName, path, data, options);
				return { data: { path }, error: null };
			} catch (error) {
				return {
					data: null,
					error: error instanceof Error ? error : new Error(String(error)),
				};
			}
		},

		async remove(paths: string[]): Promise<void> {
			await removeFiles(storageBucketName, paths);
		},

		async download(key: string): Promise<Buffer> {
			return downloadFile(storageBucketName, key);
		},

		getPublicUrl(path: string): { data: { publicUrl: string } } {
			return {
				data: { publicUrl: getPublicUrl(storageBucketName, path) },
			};
		},
	};
}
