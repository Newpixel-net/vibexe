/**
 * Analytics API
 *
 * GET /api/apps/{appId}/analytics — Returns aggregated analytics data
 *
 * Query params:
 *   period: "24h" | "7d" | "30d" | "all" (default: "24h")
 */

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { type BuilderAppId, builderApps, builderAppDatabases } from "@/db/schema";
import { executeQuery } from "@/lib/app-database/pool-manager";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

/** Map period param to a PostgreSQL interval string */
function periodToInterval(period: string): string | null {
	switch (period) {
		case "24h":
			return "24 hours";
		case "7d":
			return "7 days";
		case "30d":
			return "30 days";
		case "all":
			return null;
		default:
			return "24 hours";
	}
}

export async function GET(request: Request, { params }: RouteParams) {
	try {
		const { appId } = await params;
		const url = new URL(request.url);
		const period = url.searchParams.get("period") || "24h";
		const interval = periodToInterval(period);

		// Resolve app and database
		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});

		if (!app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		const appDb = await db.query.builderAppDatabases.findFirst({
			where: eq(builderAppDatabases.appDbId, app.dbId),
		});

		if (!appDb) {
			return NextResponse.json({
				liveVisitors: 0,
				totalVisitors: 0,
				totalPageViews: 0,
				topPages: [],
				visitsByHour: [],
				visitsByDay: [],
			});
		}

		const databaseName = appDb.databaseName;

		// Build WHERE clause fragment for the time period
		const sessionTimeFilter = interval
			? `WHERE started_at > NOW() - INTERVAL '${interval}'`
			: "";
		const eventTimeFilter = interval
			? `WHERE created_at > NOW() - INTERVAL '${interval}'`
			: "";

		// Live visitors: sessions active in last 5 minutes
		const liveResult = await executeQuery<{ count: string }>(
			databaseName,
			`SELECT COUNT(DISTINCT visitor_id) as count
			 FROM _app_analytics_sessions
			 WHERE last_active_at > NOW() - INTERVAL '5 minutes'`,
		);
		const liveVisitors = Number.parseInt(liveResult[0]?.count || "0", 10);

		// Total unique visitors in period
		const visitorsResult = await executeQuery<{ count: string }>(
			databaseName,
			`SELECT COUNT(DISTINCT visitor_id) as count
			 FROM _app_analytics_sessions
			 ${sessionTimeFilter}`,
		);
		const totalVisitors = Number.parseInt(visitorsResult[0]?.count || "0", 10);

		// Total page views in period
		const pageViewsResult = await executeQuery<{ count: string }>(
			databaseName,
			`SELECT COUNT(*) as count
			 FROM _app_analytics_events
			 ${eventTimeFilter}`,
		);
		const totalPageViews = Number.parseInt(pageViewsResult[0]?.count || "0", 10);

		// Top pages
		const topPages = await executeQuery<{ page_path: string; count: string }>(
			databaseName,
			`SELECT page_path, COUNT(*) as count
			 FROM _app_analytics_events
			 ${eventTimeFilter ? `${eventTimeFilter} AND` : "WHERE"} page_path IS NOT NULL
			 GROUP BY page_path
			 ORDER BY count DESC
			 LIMIT 10`,
		);

		// Visits by hour (last 24 hours)
		const visitsByHour = await executeQuery<{ hour: string; count: string }>(
			databaseName,
			`SELECT date_trunc('hour', created_at) as hour, COUNT(*) as count
			 FROM _app_analytics_events
			 WHERE created_at > NOW() - INTERVAL '24 hours'
			 GROUP BY hour
			 ORDER BY hour`,
		);

		// Visits by day (last 30 days)
		const visitsByDay = await executeQuery<{ day: string; count: string }>(
			databaseName,
			`SELECT date_trunc('day', created_at) as day, COUNT(*) as count
			 FROM _app_analytics_events
			 WHERE created_at > NOW() - INTERVAL '30 days'
			 GROUP BY day
			 ORDER BY day`,
		);

		return NextResponse.json({
			liveVisitors,
			totalVisitors,
			totalPageViews,
			topPages: topPages.map((r) => ({
				path: r.page_path,
				views: Number.parseInt(r.count, 10),
			})),
			visitsByHour: visitsByHour.map((r) => ({
				hour: r.hour,
				count: Number.parseInt(r.count, 10),
			})),
			visitsByDay: visitsByDay.map((r) => ({
				day: r.day,
				count: Number.parseInt(r.count, 10),
			})),
		});
	} catch (error) {
		console.error("[Analytics API] Error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
