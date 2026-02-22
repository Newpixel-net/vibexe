/**
 * App Storage Settings API
 *
 * GET  /api/apps/{appId}/storage/settings — Return current storage settings
 * PUT  /api/apps/{appId}/storage/settings — Upsert storage settings
 *
 * Auth: App builder session (same as auth-settings route).
 */

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
	type BuilderAppId,
	builderApps,
	builderAppStorageSettings,
} from "@/db/schema";
import { calculateUsedStorage } from "@/lib/app-storage/storage-manager";

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

export async function GET(_request: Request, { params }: RouteParams) {
	try {
		const { appId } = await params;

		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});

		if (!app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		const settings = await db.query.builderAppStorageSettings.findFirst({
			where: eq(builderAppStorageSettings.appDbId, app.dbId),
		});

		if (!settings) {
			return NextResponse.json(DEFAULTS);
		}

		return NextResponse.json({
			accessLevel: settings.accessLevel,
			maxFileSizeMb: settings.maxFileSizeMb,
			storageQuotaMb: settings.storageQuotaMb,
			usedStorageBytes: settings.usedStorageBytes,
			allowedTypes: settings.allowedTypes,
		});
	} catch (error) {
		console.error("[Storage Settings API] GET error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function PUT(request: Request, { params }: RouteParams) {
	try {
		const { appId } = await params;

		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});

		if (!app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		const body = await request.json();

		// Validate access level
		const validLevels = ["public", "authenticated", "owner"];
		const accessLevel = validLevels.includes(body.accessLevel)
			? body.accessLevel
			: DEFAULTS.accessLevel;

		const values = {
			appDbId: app.dbId,
			accessLevel,
			maxFileSizeMb: body.maxFileSizeMb ?? DEFAULTS.maxFileSizeMb,
			storageQuotaMb: body.storageQuotaMb ?? DEFAULTS.storageQuotaMb,
			allowedTypes: body.allowedTypes ?? DEFAULTS.allowedTypes,
		};

		await db
			.insert(builderAppStorageSettings)
			.values(values)
			.onConflictDoUpdate({
				target: builderAppStorageSettings.appDbId,
				set: {
					accessLevel: values.accessLevel,
					maxFileSizeMb: values.maxFileSizeMb,
					storageQuotaMb: values.storageQuotaMb,
					allowedTypes: values.allowedTypes,
				},
			});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[Storage Settings API] PUT error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
