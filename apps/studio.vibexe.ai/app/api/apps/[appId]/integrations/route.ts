/**
 * App Integrations API
 *
 * GET    /api/apps/{appId}/integrations — List connected integrations
 * POST   /api/apps/{appId}/integrations — Connect a new integration
 * DELETE  /api/apps/{appId}/integrations — Disconnect an integration (body: { pieceName })
 */

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
	type BuilderAppId,
	builderApps,
	builderAppIntegrations,
} from "@/db/schema";
import { encryptToken } from "@/lib/token-encryption";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
	try {
		const { appId } = await params;

		try {
			await verifyAppAccess(appId);
		} catch {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});
		if (!app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		const integrations = await db.query.builderAppIntegrations.findMany({
			where: eq(builderAppIntegrations.appDbId, app.dbId),
		});

		return NextResponse.json({
			integrations: integrations.map((i) => ({
				pieceName: i.pieceName,
				displayName: i.displayName,
				status: i.status,
				connectedAt: i.connectedAt,
				hasCredentials: !!i.encryptedCredentials,
			})),
		});
	} catch (error) {
		console.error("[Integrations API] GET error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function POST(request: Request, { params }: RouteParams) {
	try {
		const { appId } = await params;

		try {
			await verifyAppAccess(appId);
		} catch {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});
		if (!app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		const body = await request.json();
		const { pieceName, displayName, credentials, config } = body as {
			pieceName: string;
			displayName: string;
			credentials?: string;
			config?: Record<string, unknown>;
		};

		if (!pieceName || !displayName) {
			return NextResponse.json(
				{ error: "pieceName and displayName are required" },
				{ status: 400 },
			);
		}

		// Encrypt credentials if provided
		let encryptedCredentials: string | null = null;
		if (credentials) {
			encryptedCredentials = encryptToken(credentials);
		}

		// Upsert
		const existing = await db.query.builderAppIntegrations.findFirst({
			where: and(
				eq(builderAppIntegrations.appDbId, app.dbId),
				eq(builderAppIntegrations.pieceName, pieceName),
			),
		});

		if (existing) {
			await db
				.update(builderAppIntegrations)
				.set({
					displayName,
					status: "connected",
					config: config ?? {},
					encryptedCredentials: encryptedCredentials ?? existing.encryptedCredentials,
				})
				.where(eq(builderAppIntegrations.dbId, existing.dbId));
		} else {
			await db.insert(builderAppIntegrations).values({
				appDbId: app.dbId,
				pieceName,
				displayName,
				status: "connected",
				config: config ?? {},
				encryptedCredentials,
			});
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[Integrations API] POST error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function DELETE(request: Request, { params }: RouteParams) {
	try {
		const { appId } = await params;

		try {
			await verifyAppAccess(appId);
		} catch {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});
		if (!app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		const body = await request.json();
		const { pieceName } = body as { pieceName: string };

		if (!pieceName) {
			return NextResponse.json(
				{ error: "pieceName is required" },
				{ status: 400 },
			);
		}

		const existing = await db.query.builderAppIntegrations.findFirst({
			where: and(
				eq(builderAppIntegrations.appDbId, app.dbId),
				eq(builderAppIntegrations.pieceName, pieceName),
			),
		});

		if (existing) {
			await db
				.delete(builderAppIntegrations)
				.where(eq(builderAppIntegrations.dbId, existing.dbId));
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[Integrations API] DELETE error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
