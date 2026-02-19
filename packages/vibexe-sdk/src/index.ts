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
	public readonly appId: string;

	constructor(config: VibexeAppConfig) {
		this.appId = config.appId;

		const baseUrl = config.baseUrl
			? `${config.baseUrl}/api/apps/${config.appId}`
			: typeof window !== "undefined"
				? `${window.location.origin}/api/apps/${config.appId}`
				: `/api/apps/${config.appId}`;

		const headers: Record<string, string> = {};
		if (config.apiKey) {
			headers["X-Vibexe-Api-Key"] = config.apiKey;
		}

		this.data = new DataClient(baseUrl, headers);
		this.auth = new AuthClient(baseUrl, headers);
	}
}

// Re-export types for convenience
export type { ListOptions, PaginatedResponse } from "./data";
export type { AppUser, AuthResponse } from "./auth";
