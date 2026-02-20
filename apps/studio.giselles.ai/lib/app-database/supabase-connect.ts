/**
 * Supabase Connect — Free tier external database integration.
 * Lets users connect their own Supabase project to their Vibexe app.
 */

import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import {
	type BuilderAppId,
	type BuilderExternalDbId,
	builderApps,
	builderAppExternalDbs,
} from "@/db/schema";
import { encryptToken, decryptToken } from "@/lib/token-encryption";

export interface SupabaseConfig {
	url: string;
	anonKey: string;
}

export interface ExternalDbInfo {
	id: string;
	provider: string;
	url: string; // Decrypted
	status: string;
	createdAt: Date;
}

/**
 * Test a Supabase connection by hitting the REST API health endpoint.
 */
export async function testSupabaseConnection(
	config: SupabaseConfig,
): Promise<{ ok: boolean; error?: string }> {
	try {
		const url = config.url.replace(/\/$/, "");
		const res = await fetch(`${url}/rest/v1/`, {
			method: "HEAD",
			headers: {
				apikey: config.anonKey,
				Authorization: `Bearer ${config.anonKey}`,
			},
			signal: AbortSignal.timeout(10000),
		});
		if (res.ok || res.status === 200 || res.status === 204) {
			return { ok: true };
		}
		return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Connection failed";
		return { ok: false, error: msg };
	}
}

/**
 * Save or update Supabase connection for an app.
 */
export async function saveExternalDb(
	appId: string,
	config: SupabaseConfig,
): Promise<{ success: boolean; error?: string }> {
	try {
		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});
		if (!app) return { success: false, error: "App not found" };

		const encryptedUrl = encryptToken(config.url);
		const encryptedAnonKey = encryptToken(config.anonKey);

		// Check if external DB already exists for this app
		const existing = await db.query.builderAppExternalDbs.findFirst({
			where: eq(builderAppExternalDbs.appDbId, app.dbId),
		});

		if (existing) {
			await db
				.update(builderAppExternalDbs)
				.set({
					encryptedUrl,
					encryptedAnonKey,
					status: "connected",
					updatedAt: new Date(),
				})
				.where(eq(builderAppExternalDbs.dbId, existing.dbId));
		} else {
			await db.insert(builderAppExternalDbs).values({
				id: `bext_${nanoid(20)}` as BuilderExternalDbId,
				appDbId: app.dbId,
				provider: "supabase",
				encryptedUrl,
				encryptedAnonKey,
				status: "connected",
			});
		}

		return { success: true };
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Save failed";
		return { success: false, error: msg };
	}
}

/**
 * Get external DB config for an app (decrypted).
 */
export async function getExternalDb(
	appId: string,
): Promise<ExternalDbInfo | null> {
	try {
		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});
		if (!app) return null;

		const ext = await db.query.builderAppExternalDbs.findFirst({
			where: eq(builderAppExternalDbs.appDbId, app.dbId),
		});
		if (!ext) return null;

		return {
			id: ext.id,
			provider: ext.provider,
			url: decryptToken(ext.encryptedUrl),
			status: ext.status,
			createdAt: ext.createdAt,
		};
	} catch {
		return null;
	}
}

/**
 * Get decrypted Supabase config for an app (used by system prompt).
 */
export async function getSupabaseConfig(
	appId: string,
): Promise<SupabaseConfig | null> {
	try {
		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});
		if (!app) return null;

		const ext = await db.query.builderAppExternalDbs.findFirst({
			where: eq(builderAppExternalDbs.appDbId, app.dbId),
		});
		if (!ext || ext.status !== "connected") return null;

		return {
			url: decryptToken(ext.encryptedUrl),
			anonKey: decryptToken(ext.encryptedAnonKey),
		};
	} catch {
		return null;
	}
}

/**
 * Remove external DB connection for an app.
 */
export async function removeExternalDb(
	appId: string,
): Promise<{ success: boolean }> {
	try {
		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});
		if (!app) return { success: false };

		await db
			.delete(builderAppExternalDbs)
			.where(eq(builderAppExternalDbs.appDbId, app.dbId));

		return { success: true };
	} catch {
		return { success: false };
	}
}

/**
 * Get the backend type for an app: "native" or "supabase".
 */
export async function getAppBackendType(
	appId: string,
): Promise<"native" | "supabase"> {
	try {
		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});
		if (!app) return "native";

		const ext = await db.query.builderAppExternalDbs.findFirst({
			where: eq(builderAppExternalDbs.appDbId, app.dbId),
		});
		return ext?.status === "connected" ? "supabase" : "native";
	} catch {
		return "native";
	}
}
