/**
 * App Storage API — List & Upload
 *
 * GET  /api/apps/{appId}/storage?prefix=avatars/&limit=50&cursor=xxx  — List files
 * POST /api/apps/{appId}/storage  — Upload file (multipart/form-data)
 *
 * Auth: X-Vibexe-Api-Key header OR Bearer token (end-user).
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
	type BuilderAppId,
	builderApps,
	builderAppDatabases,
	builderAppStorageSettings,
} from "@/db/schema";
import { verifyApiKey } from "@/lib/app-database/api-keys";
import { resolveAppUser } from "@/lib/app-database/rls";
import { logAppEvent } from "@/lib/app-database/app-logger";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";
import {
	uploadFile,
	listFiles,
	calculateUsedStorage,
} from "@/lib/app-storage/storage-manager";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

const DEFAULTS = {
	accessLevel: "authenticated",
	maxFileSizeMb: 10,
	storageQuotaMb: 500,
	usedStorageBytes: "0",
	allowedTypes: ["image/*", "application/pdf", "text/*"],
};

async function resolveApp(appId: string) {
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		columns: { dbId: true },
	});
	if (!app) return null;

	const appDb = await db.query.builderAppDatabases.findFirst({
		where: eq(builderAppDatabases.appDbId, app.dbId),
	});

	return { app, appDb };
}

async function getSettings(appDbId: number) {
	const settings = await db.query.builderAppStorageSettings.findFirst({
		where: eq(builderAppStorageSettings.appDbId, appDbId),
	});
	return settings ?? DEFAULTS;
}

async function authenticateRequest(
	request: NextRequest,
	appId: string,
	appDbId: number,
	databaseName: string | undefined,
	accessLevel: string,
): Promise<{ allowed: boolean; error?: string; status?: number }> {
	// Check API key first
	const apiKey = request.headers.get("x-vibexe-api-key");
	if (apiKey) {
		const valid = await verifyApiKey(appDbId, apiKey);
		if (!valid) return { allowed: false, error: "Invalid API key", status: 401 };
		return { allowed: true };
	}

	// Builder session fallback — verify builder owns this app via team membership
	try {
		await verifyAppAccess(appId);
		return { allowed: true };
	} catch {
		// Not a builder session or no access — continue with end-user auth
	}

	// Public = no auth needed
	if (accessLevel === "public") return { allowed: true };

	// Authenticated or owner = need Bearer token
	if (!databaseName) return { allowed: false, error: "Database not available", status: 503 };

	try {
		const user = await resolveAppUser(databaseName, request);
		if (!user) return { allowed: false, error: "Authentication required", status: 401 };
		return { allowed: true };
	} catch {
		return { allowed: false, error: "Authentication required", status: 401 };
	}
}

function matchesAllowedType(contentType: string, allowedTypes: string[]): boolean {
	for (const pattern of allowedTypes) {
		if (pattern === "*/*") return true;
		if (pattern.endsWith("/*")) {
			const prefix = pattern.slice(0, -2);
			if (contentType.startsWith(prefix)) return true;
		} else if (contentType === pattern) {
			return true;
		}
	}
	return false;
}

/**
 * GET — List files
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId } = await params;

		const resolved = await resolveApp(appId);
		if (!resolved?.app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		const settings = await getSettings(resolved.app.dbId);

		const auth = await authenticateRequest(
			request,
			appId,
			resolved.app.dbId,
			resolved.appDb?.databaseName,
			settings.accessLevel,
		);
		if (!auth.allowed) {
			return NextResponse.json({ error: auth.error }, { status: auth.status });
		}

		const url = new URL(request.url);
		const prefix = url.searchParams.get("prefix") ?? undefined;
		const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "50", 10)));
		const cursor = url.searchParams.get("cursor") ?? undefined;

		const result = await listFiles(appId, prefix, limit, cursor);

		return NextResponse.json(result);
	} catch (error) {
		console.error("[Storage API] GET error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * POST — Upload file (multipart/form-data)
 *
 * Fields: file (File), path (optional string)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId } = await params;

		const resolved = await resolveApp(appId);
		if (!resolved?.app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		const settings = await getSettings(resolved.app.dbId);

		const auth = await authenticateRequest(
			request,
			appId,
			resolved.app.dbId,
			resolved.appDb?.databaseName,
			settings.accessLevel,
		);
		if (!auth.allowed) {
			return NextResponse.json({ error: auth.error }, { status: auth.status });
		}

		// Parse multipart form data
		const formData = await request.formData();
		const file = formData.get("file") as File | null;
		if (!file) {
			return NextResponse.json({ error: "No file provided" }, { status: 400 });
		}

		// Validate file size
		const maxBytes = (settings.maxFileSizeMb ?? DEFAULTS.maxFileSizeMb) * 1024 * 1024;
		if (file.size > maxBytes) {
			return NextResponse.json(
				{ error: `File too large. Max size: ${settings.maxFileSizeMb ?? DEFAULTS.maxFileSizeMb} MB` },
				{ status: 413 },
			);
		}

		// Validate content type
		const allowedTypes = (settings.allowedTypes as string[]) ?? DEFAULTS.allowedTypes;
		if (!matchesAllowedType(file.type, allowedTypes)) {
			return NextResponse.json(
				{ error: `File type '${file.type}' not allowed. Allowed: ${allowedTypes.join(", ")}` },
				{ status: 415 },
			);
		}

		// Check quota
		const quotaBytes = (settings.storageQuotaMb ?? DEFAULTS.storageQuotaMb) * 1024 * 1024;
		const usedBytes = Number.parseInt(String(settings.usedStorageBytes ?? "0"), 10);
		if (usedBytes + file.size > quotaBytes) {
			return NextResponse.json(
				{ error: "Storage quota exceeded" },
				{ status: 413 },
			);
		}

		// Determine file path
		const customPath = formData.get("path") as string | null;
		const filePath = customPath || file.name;

		// Sanitize path — prevent all traversal vectors
		const safePath = filePath
			.replace(/\\/g, "/")             // Normalize backslashes
			.replace(/\.{2,}/g, ".")         // Collapse consecutive dots
			.replace(/^\/+/, "")             // Strip leading slashes
			.split("/")
			.filter((seg) => seg !== ".." && seg !== "." && seg.length > 0)
			.join("/");

		if (!safePath) {
			return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
		}

		// Get file buffer
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		// Get uploader metadata
		let uploadedBy: string | undefined;
		if (resolved.appDb?.databaseName) {
			try {
				const user = await resolveAppUser(resolved.appDb.databaseName, request);
				if (user) uploadedBy = String(user.userId);
			} catch {
				// No user context — that's fine for public uploads
			}
		}

		const result = await uploadFile(
			appId,
			safePath,
			buffer,
			file.type,
			uploadedBy ? { uploaded_by: uploadedBy } : undefined,
		);

		// Update used_storage_bytes (fire-and-forget)
		db.update(builderAppStorageSettings)
			.set({ usedStorageBytes: String(usedBytes + file.size) })
			.where(eq(builderAppStorageSettings.appDbId, resolved.app.dbId))
			.then(() => {})
			.catch(() => {});

		// Log (fire-and-forget)
		if (resolved.appDb?.databaseName) {
			logAppEvent(resolved.appDb.databaseName, {
				level: "info",
				category: "storage",
				eventType: "app.storage.upload",
				message: `Uploaded ${safePath} (${file.size} bytes)`,
				metadata: { path: safePath, size: file.size, contentType: file.type },
			});
		}

		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		console.error("[Storage API] POST error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
