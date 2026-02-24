/**
 * App Secrets API
 *
 * GET    /api/apps/{appId}/secrets     — List secret keys (values masked)
 * PUT    /api/apps/{appId}/secrets     — Set a secret { key, value }
 * DELETE /api/apps/{appId}/secrets     — Remove a secret { key }
 *
 * Auth: X-Vibexe-Api-Key header (app builder/admin only).
 */

import { eq, and } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
	type BuilderAppId,
	builderApps,
	builderAppSecrets,
} from "@/db/schema";
import { verifyApiKey } from "@/lib/app-database/api-keys";
import { encryptToken } from "@/lib/token-encryption";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

async function resolveApp(appId: string, request: NextRequest) {
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		columns: { dbId: true },
	});
	if (!app) return { error: "App not found", status: 404 } as const;

	const apiKey = request.headers.get("x-vibexe-api-key");
	if (!apiKey) return { error: "API key required", status: 401 } as const;
	const valid = await verifyApiKey(app.dbId, apiKey);
	if (!valid) return { error: "Invalid API key", status: 401 } as const;

	return { app };
}

/**
 * GET — List secret keys (values masked).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId } = await params;
		const ctx = await resolveApp(appId, request);
		if ("error" in ctx) {
			return NextResponse.json({ error: ctx.error }, { status: ctx.status });
		}

		const secrets = await db.query.builderAppSecrets.findMany({
			where: eq(builderAppSecrets.appDbId, ctx.app.dbId),
			columns: { key: true, createdAt: true, updatedAt: true },
		});

		return NextResponse.json({
			data: secrets.map((s) => ({
				key: s.key,
				value: "••••••••",
				createdAt: s.createdAt,
				updatedAt: s.updatedAt,
			})),
		});
	} catch (error) {
		console.error("[Secrets API] GET error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * PUT — Set a secret (upsert).
 * Body: { key, value }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId } = await params;
		const ctx = await resolveApp(appId, request);
		if ("error" in ctx) {
			return NextResponse.json({ error: ctx.error }, { status: ctx.status });
		}

		const body = await request.json();
		const { key, value } = body;

		if (!key || typeof key !== "string") {
			return NextResponse.json({ error: "key is required" }, { status: 400 });
		}
		if (value === undefined || value === null) {
			return NextResponse.json({ error: "value is required" }, { status: 400 });
		}

		const encrypted = encryptToken(String(value));

		const existing = await db.query.builderAppSecrets.findFirst({
			where: and(
				eq(builderAppSecrets.appDbId, ctx.app.dbId),
				eq(builderAppSecrets.key, key),
			),
		});

		if (existing) {
			await db
				.update(builderAppSecrets)
				.set({ encryptedValue: encrypted })
				.where(eq(builderAppSecrets.dbId, existing.dbId));
		} else {
			await db.insert(builderAppSecrets).values({
				appDbId: ctx.app.dbId,
				key,
				encryptedValue: encrypted,
			});
		}

		return NextResponse.json({ data: { key, updated: !!existing } });
	} catch (error) {
		console.error("[Secrets API] PUT error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * DELETE — Remove a secret.
 * Body: { key }
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId } = await params;
		const ctx = await resolveApp(appId, request);
		if ("error" in ctx) {
			return NextResponse.json({ error: ctx.error }, { status: ctx.status });
		}

		const body = await request.json();
		const { key } = body;

		if (!key || typeof key !== "string") {
			return NextResponse.json({ error: "key is required" }, { status: 400 });
		}

		const existing = await db.query.builderAppSecrets.findFirst({
			where: and(
				eq(builderAppSecrets.appDbId, ctx.app.dbId),
				eq(builderAppSecrets.key, key),
			),
		});

		if (!existing) {
			return NextResponse.json({ error: "Secret not found" }, { status: 404 });
		}

		await db
			.delete(builderAppSecrets)
			.where(eq(builderAppSecrets.dbId, existing.dbId));

		return NextResponse.json({ success: true, deleted: key });
	} catch (error) {
		console.error("[Secrets API] DELETE error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
