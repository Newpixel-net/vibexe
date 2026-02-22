/**
 * @vibexe/sdk — Vibexe App SDK
 *
 * Lightweight client for Vibexe app backends.
 * Provides data CRUD and end-user authentication.
 *
 * Usage:
 *   import { VibexeApp } from "@vibexe/sdk";
 *   const app = new VibexeApp({ appId: "bldr_xxx" });
 *
 *   // Data
 *   const items = await app.data.list("courses");
 *   const item = await app.data.create("courses", { title: "React 101" });
 *
 *   // Auth
 *   await app.auth.signUp({ email: "user@example.com", password: "secret" });
 *   const user = await app.auth.getCurrentUser();
 */

import { AuthClient } from "./auth";
import { DataClient } from "./data";
import { FunctionsClient } from "./functions";
import { StorageClient } from "./storage";

export interface VibexeAppConfig {
	/** The builder app ID (bldr_xxx) */
	appId: string;
	/** Override the API base URL (defaults to window.location.origin) */
	baseUrl?: string;
	/** API key for server-side usage */
	apiKey?: string;
}

export class VibexeApp {
	public readonly data: DataClient;
	public readonly auth: AuthClient;
	public readonly functions: FunctionsClient;
	public readonly storage: StorageClient;
	public readonly appId: string;

	constructor(config: VibexeAppConfig) {
		this.appId = config.appId;

		const origin = config.baseUrl
			|| (typeof window !== "undefined" && (window as Record<string, unknown>).__VIBEXE_API_ORIGIN__ as string)
			|| (typeof window !== "undefined" ? window.location.origin : "");
		const baseUrl = `${origin}/api/apps/${config.appId}`;

		const headers: Record<string, string> = {};
		if (config.apiKey) {
			headers["X-Vibexe-Api-Key"] = config.apiKey;
		}

		this.data = new DataClient(baseUrl, headers);
		this.auth = new AuthClient(baseUrl, headers);
		this.functions = new FunctionsClient(baseUrl, headers);
		this.storage = new StorageClient(baseUrl, headers);
	}
}

// Re-export types for convenience
export type { ListOptions, PaginatedResponse, DataChangeEvent, SubscribeOptions } from "./data";
export type { AppUser, AuthResponse } from "./auth";
export type { FileInfo, UploadResult, ListFilesResult, ImageTransformOptions } from "./storage";
