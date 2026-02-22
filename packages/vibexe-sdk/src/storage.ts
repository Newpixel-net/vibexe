/**
 * Vibexe Storage Client
 *
 * File upload, download, list, and delete operations via the Vibexe REST API.
 * Supports image URL transforms for on-the-fly resize/format conversion.
 */

export interface FileInfo {
	path: string;
	size: number;
	contentType: string;
	uploadedAt: string;
	url: string;
}

export interface UploadResult {
	url: string;
	path: string;
	size: number;
	contentType: string;
}

export interface ListFilesResult {
	files: FileInfo[];
	hasMore: boolean;
	cursor?: string;
}

export interface ImageTransformOptions {
	width?: number;
	height?: number;
	format?: "webp" | "jpeg" | "png" | "avif";
	quality?: number;
}

export class StorageClient {
	private baseUrl: string;
	private headers: Record<string, string>;

	constructor(baseUrl: string, headers: Record<string, string>) {
		this.baseUrl = baseUrl;
		this.headers = headers;
	}

	/**
	 * Upload a file.
	 *
	 * @param file - File or Blob to upload
	 * @param path - Optional custom path (defaults to file name)
	 */
	async upload(file: File | Blob, path?: string): Promise<UploadResult> {
		const formData = new FormData();
		formData.append("file", file);
		if (path) {
			formData.append("path", path);
		}

		// Don't set Content-Type header — let browser set multipart boundary
		const headers: Record<string, string> = {};
		for (const [key, value] of Object.entries(this.headers)) {
			if (key.toLowerCase() !== "content-type") {
				headers[key] = value;
			}
		}

		// Include auth token
		const token =
			typeof window !== "undefined"
				? localStorage.getItem("vibexe_session")
				: null;
		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}

		const res = await fetch(`${this.baseUrl}/storage`, {
			method: "POST",
			headers,
			body: formData,
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(
				(err as Record<string, string>).error || `Upload failed: ${res.status}`,
			);
		}

		return await res.json();
	}

	/**
	 * Download a file as a Blob.
	 */
	async download(path: string): Promise<Blob> {
		const headers: Record<string, string> = { ...this.headers };
		const token =
			typeof window !== "undefined"
				? localStorage.getItem("vibexe_session")
				: null;
		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}

		const res = await fetch(`${this.baseUrl}/storage/${path}`, { headers });

		if (!res.ok) {
			throw new Error(`Download failed: ${res.status}`);
		}

		return await res.blob();
	}

	/**
	 * List files with optional prefix filter and pagination.
	 */
	async list(
		prefix?: string,
		options?: { limit?: number; cursor?: string },
	): Promise<ListFilesResult> {
		const params = new URLSearchParams();
		if (prefix) params.set("prefix", prefix);
		if (options?.limit) params.set("limit", String(options.limit));
		if (options?.cursor) params.set("cursor", options.cursor);

		const qs = params.toString();
		const url = `${this.baseUrl}/storage${qs ? `?${qs}` : ""}`;

		const headers: Record<string, string> = { ...this.headers };
		const token =
			typeof window !== "undefined"
				? localStorage.getItem("vibexe_session")
				: null;
		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}

		const res = await fetch(url, { headers });

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(
				(err as Record<string, string>).error || `List failed: ${res.status}`,
			);
		}

		return await res.json();
	}

	/**
	 * Delete a file by path.
	 */
	async delete(path: string): Promise<void> {
		const headers: Record<string, string> = { ...this.headers };
		const token =
			typeof window !== "undefined"
				? localStorage.getItem("vibexe_session")
				: null;
		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}

		const res = await fetch(`${this.baseUrl}/storage/${path}`, {
			method: "DELETE",
			headers,
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(
				(err as Record<string, string>).error || `Delete failed: ${res.status}`,
			);
		}
	}

	/**
	 * Get a URL for a file, optionally with image transform parameters.
	 *
	 * @param path - File path
	 * @param transforms - Optional image transform params (width, height, format, quality)
	 * @returns URL string for the file
	 */
	getUrl(path: string, transforms?: ImageTransformOptions): string {
		let url = `${this.baseUrl}/storage/${path}`;

		if (transforms) {
			const params = new URLSearchParams();
			if (transforms.width) params.set("width", String(transforms.width));
			if (transforms.height) params.set("height", String(transforms.height));
			if (transforms.format) params.set("format", transforms.format);
			if (transforms.quality) params.set("quality", String(transforms.quality));
			const qs = params.toString();
			if (qs) url += `?${qs}`;
		}

		return url;
	}
}
