/**
 * Analytics Track API
 *
 * POST /api/apps/{appId}/analytics/track — Record analytics events from deployed apps
 * OPTIONS /api/apps/{appId}/analytics/track — CORS preflight
 */

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { type BuilderAppId, builderApps, builderAppDatabases } from "@/db/schema";
import { executeQuery } from "@/lib/app-database/pool-manager";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
	return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request, { params }: RouteParams) {
	try {
		const { appId } = await params;

		const body = await request.json();
		const {
			sessionId,
			visitorId,
			eventType,
			pagePath,
			metadata,
			userAgent,
			referrer,
		} = body;

		if (!sessionId || !visitorId || !eventType) {
			return NextResponse.json(
				{ error: "sessionId, visitorId, and eventType are required" },
				{ status: 400, headers: corsHeaders },
			);
		}

		// Resolve app and database
		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});

		if (!app) {
			return NextResponse.json(
				{ error: "App not found" },
				{ status: 404, headers: corsHeaders },
			);
		}

		const appDb = await db.query.builderAppDatabases.findFirst({
			where: eq(builderAppDatabases.appDbId, app.dbId),
		});

		if (!appDb) {
			return NextResponse.json(
				{ error: "App database not found" },
				{ status: 404, headers: corsHeaders },
			);
		}

		const databaseName = appDb.databaseName;

		// UPSERT analytics session: create if new, update last_active_at if existing
		await executeQuery(
			databaseName,
			`INSERT INTO _app_analytics_sessions (id, visitor_id, user_agent, referrer)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (id) DO UPDATE SET last_active_at = NOW()`,
			[
				sessionId,
				visitorId,
				userAgent || null,
				referrer || null,
			],
		);

		// INSERT analytics event
		await executeQuery(
			databaseName,
			`INSERT INTO _app_analytics_events (session_id, event_type, page_path, metadata)
			 VALUES ($1, $2, $3, $4)`,
			[
				sessionId,
				eventType,
				pagePath || null,
				metadata ? JSON.stringify(metadata) : "{}",
			],
		);

		return NextResponse.json(
			{ success: true },
			{ headers: corsHeaders },
		);
	} catch (error) {
		console.error("[Analytics Track API] Error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500, headers: corsHeaders },
		);
	}
}
