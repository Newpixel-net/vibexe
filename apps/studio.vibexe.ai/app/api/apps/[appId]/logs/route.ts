/**
 * App Logs API
 *
 * GET /api/apps/{appId}/logs — Paginated log entries with filtering.
 *
 * Query params:
 *   ?page=1&limit=50&level=error&category=auth&search=keyword
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { type BuilderAppId, builderApps, builderAppDatabases } from "@/db/schema";
import { executeQuery } from "@/lib/app-database/pool-manager";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
	try {
		const { appId } = await params;

		try {
			await verifyAppAccess(appId);
		} catch {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Look up app
		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});
		if (!app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		// Look up app database
		const appDb = await db.query.builderAppDatabases.findFirst({
			where: eq(builderAppDatabases.appDbId, app.dbId),
		});
		if (!appDb || appDb.status !== "active") {
			return NextResponse.json(
				{ error: "App database not available" },
				{ status: 503 },
			);
		}

		const databaseName = appDb.databaseName;
		const url = new URL(request.url);

		// Parse query params
		const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10));
		const limit = Math.min(200, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "50", 10)));
		const levelFilter = url.searchParams.get("level");
		const categoryFilter = url.searchParams.get("category");
		const search = url.searchParams.get("search");
		const offset = (page - 1) * limit;

		// Build WHERE clauses
		const conditions: string[] = [];
		const queryParams: unknown[] = [];
		let paramIndex = 1;

		if (levelFilter) {
			// UI sends "warn" but DB stores "warning"
			const dbLevel = levelFilter === "warn" ? "warning" : levelFilter;
			conditions.push(`level = $${paramIndex}`);
			queryParams.push(dbLevel);
			paramIndex++;
		}

		if (categoryFilter) {
			conditions.push(`category = $${paramIndex}`);
			queryParams.push(categoryFilter);
			paramIndex++;
		}

		if (search) {
			conditions.push(`message ILIKE $${paramIndex}`);
			queryParams.push(`%${search}%`);
			paramIndex++;
		}

		const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

		// Count total matching logs
		const countResult = await executeQuery<{ count: string }>(
			databaseName,
			`SELECT COUNT(*) as count FROM _app_logs ${whereClause}`,
			queryParams,
		);
		const total = Number.parseInt(countResult[0]?.count || "0", 10);

		// Fetch paginated logs
		const rows = await executeQuery<{
			id: number;
			level: string;
			category: string;
			event_type: string;
			message: string;
			user_id: number | null;
			user_email: string | null;
			metadata: Record<string, unknown>;
			created_at: string;
		}>(
			databaseName,
			`SELECT * FROM _app_logs ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
			[...queryParams, limit, offset],
		);

		// Map to UI-expected format
		const logs = rows.map((row) => {
			// DB stores "warning", UI expects "warn"
			const uiLevel = row.level === "warning" ? "warn" : row.level;
			const metadata = row.metadata && typeof row.metadata === "object" && Object.keys(row.metadata).length > 0
				? JSON.stringify(row.metadata, null, 2)
				: undefined;

			return {
				id: String(row.id),
				timestamp: new Date(row.created_at).toISOString(),
				level: uiLevel as "info" | "warn" | "error" | "debug",
				message: row.message,
				source: row.category,
				details: metadata,
			};
		});

		return NextResponse.json({
			logs,
			total,
			page,
			limit,
		});
	} catch (error) {
		console.error("[Logs API] GET error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
