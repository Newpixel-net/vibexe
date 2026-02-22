/**
 * App Storage API — Download & Delete individual files
 *
 * GET    /api/apps/{appId}/storage/{path}  — Download/serve file (with optional image transforms)
 * DELETE /api/apps/{appId}/storage/{path}  — Delete file
 *
 * Image transform query params: ?width=200&height=200&format=webp&quality=80
 *
 * Auth: Based on storage settings access_level.
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
import { downloadFile, deleteFile, getFileInfo } from "@/lib/app-storage/storage-manager";
import { transformImage, isTransformableImage, type TransformParams } from "@/lib/app-storage/image-transform";

interface RouteParams {
	params: Promise<{ appId: string; path: string[] }>;
}

const DEFAULTS = {
	accessLevel: "authenticated",
	maxFileSizeMb: 10,
	storageQuotaMb: 500,
	usedStorageBytes: "0",
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
	appDbId: number,
	databaseName: string | undefined,
	accessLevel: string,
): Promise<{ allowed: boolean; userId?: number; error?: string; status?: number }> {
	// API key = admin access
	const apiKey = request.headers.get("x-vibexe-api-key");
	if (apiKey) {
		const valid = await verifyApiKey(appDbId, apiKey);
		if (!valid) return { allowed: false, error: "Invalid API key", status: 401 };
		return { allowed: true };
	}

	// Public = no auth needed
	if (accessLevel === "public") return { allowed: true };

	// Need Bearer token
	if (!databaseName) return { allowed: false, error: "Database not available", status: 503 };

	try {
		const user = await resolveAppUser(databaseName, request);
		if (!user) return { allowed: false, error: "Authentication required", status: 401 };
		return { allowed: true, userId: user.userId };
	} catch {
		return { allowed: false, error: "Authentication required", status: 401 };
	}
}

/**
 * GET — Download/serve a file
 *
 * Supports image transform query params for on-the-fly resize/format conversion.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId, path: pathSegments } = await params;
		const filePath = pathSegments.join("/");

		const resolved = await resolveApp(appId);
		if (!resolved?.app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		const settings = await getSettings(resolved.app.dbId);

		const auth = await authenticateRequest(
			request,
			resolved.app.dbId,
			resolved.appDb?.databaseName,
			settings.accessLevel,
		);
		if (!auth.allowed) {
			return NextResponse.json({ error: auth.error }, { status: auth.status });
		}

		// Download the file from S3
		let result: Awaited<ReturnType<typeof downloadFile>>;
		try {
			result = await downloadFile(appId, filePath);
		} catch {
			return NextResponse.json({ error: "File not found" }, { status: 404 });
		}

		// Check for image transform params
		const url = new URL(request.url);
		const width = url.searchParams.get("width");
		const height = url.searchParams.get("height");
		const format = url.searchParams.get("format") as TransformParams["format"];
		const quality = url.searchParams.get("quality");

		const hasTransforms = width || height || format || quality;

		if (hasTransforms && isTransformableImage(result.contentType)) {
			const transformParams: TransformParams = {};
			if (width) transformParams.width = Number.parseInt(width, 10);
			if (height) transformParams.height = Number.parseInt(height, 10);
			if (format) transformParams.format = format;
			if (quality) transformParams.quality = Number.parseInt(quality, 10);

			const transformed = await transformImage(
				appId,
				filePath,
				result.data,
				result.contentType,
				transformParams,
			);

			return new NextResponse(transformed.data, {
				headers: {
					"Content-Type": transformed.contentType,
					"Content-Length": String(transformed.data.length),
					"Cache-Control": "public, max-age=31536000, immutable",
				},
			});
		}

		// Return original file
		const headers: Record<string, string> = {
			"Content-Type": result.contentType,
			"Content-Length": String(result.size),
			"Cache-Control": "public, max-age=3600",
		};
		if (result.etag) headers.ETag = result.etag;

		return new NextResponse(result.data, { headers });
	} catch (error) {
		console.error("[Storage API] GET file error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * DELETE — Delete a file
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId, path: pathSegments } = await params;
		const filePath = pathSegments.join("/");

		const resolved = await resolveApp(appId);
		if (!resolved?.app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		const settings = await getSettings(resolved.app.dbId);

		const auth = await authenticateRequest(
			request,
			resolved.app.dbId,
			resolved.appDb?.databaseName,
			settings.accessLevel,
		);
		if (!auth.allowed) {
			return NextResponse.json({ error: auth.error }, { status: auth.status });
		}

		// Owner check: verify the file was uploaded by this user
		if (settings.accessLevel === "owner" && auth.userId) {
			const info = await getFileInfo(appId, filePath);
			if (!info) {
				return NextResponse.json({ error: "File not found" }, { status: 404 });
			}
			// Note: owner check would require reading S3 object metadata
			// For now, authenticated users can delete files
		}

		// Get file size before deletion (for quota update)
		const info = await getFileInfo(appId, filePath);
		const fileSize = info?.size ?? 0;

		await deleteFile(appId, filePath);

		// Update used_storage_bytes (fire-and-forget)
		if (fileSize > 0) {
			const currentUsed = Number.parseInt(String(settings.usedStorageBytes ?? "0"), 10);
			const newUsed = Math.max(0, currentUsed - fileSize);
			db.update(builderAppStorageSettings)
				.set({ usedStorageBytes: String(newUsed) })
				.where(eq(builderAppStorageSettings.appDbId, resolved.app.dbId))
				.then(() => {})
				.catch(() => {});
		}

		// Log (fire-and-forget)
		if (resolved.appDb?.databaseName) {
			logAppEvent(resolved.appDb.databaseName, {
				level: "info",
				category: "storage",
				eventType: "app.storage.delete",
				message: `Deleted ${filePath}`,
				metadata: { path: filePath, size: fileSize },
			});
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[Storage API] DELETE error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
