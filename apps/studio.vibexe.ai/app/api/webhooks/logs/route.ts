import type { NextRequest } from "next/server";
import { db } from "@/db";
import { webhookEndpoints, webhookRequestLogs } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { fetchCurrentTeam } from "@/services/teams";

export const dynamic = "force-dynamic";

/**
 * GET /api/webhooks/logs?endpointId=<dbId>&limit=50
 * GET /api/webhooks/logs?path=<webhookPath>&limit=50
 *
 * Fetches recent webhook request logs for a given endpoint.
 * Supports lookup by either dbId or webhook path.
 * Auth: requires session — endpoint must belong to the caller's team.
 */
export async function GET(request: NextRequest) {
	const endpointId = request.nextUrl.searchParams.get("endpointId");
	const webhookPath = request.nextUrl.searchParams.get("path");
	const limit = Math.min(
		Number(request.nextUrl.searchParams.get("limit") ?? 50),
		200,
	);

	if (!endpointId && !webhookPath) {
		return Response.json(
			{ error: "endpointId or path query parameter is required" },
			{ status: 400 },
		);
	}

	try {
		const currentTeam = await fetchCurrentTeam();

		let resolvedEndpointId = endpointId ? Number.parseInt(endpointId, 10) : null;
		if (resolvedEndpointId !== null && Number.isNaN(resolvedEndpointId)) {
			return Response.json(
				{ error: "endpointId must be a valid integer" },
				{ status: 400 },
			);
		}

		// Resolve by endpointId — verify it belongs to the team
		if (resolvedEndpointId !== null) {
			const [endpoint] = await db
				.select({ dbId: webhookEndpoints.dbId })
				.from(webhookEndpoints)
				.where(
					and(
						eq(webhookEndpoints.dbId, resolvedEndpointId),
						eq(webhookEndpoints.teamDbId, currentTeam.dbId),
					),
				)
				.limit(1);
			if (!endpoint) {
				return Response.json({ logs: [] });
			}
		}

		// Resolve by path — scoped to team
		if (resolvedEndpointId === null && webhookPath) {
			const [endpoint] = await db
				.select({ dbId: webhookEndpoints.dbId })
				.from(webhookEndpoints)
				.where(
					and(
						eq(webhookEndpoints.webhookPath, webhookPath),
						eq(webhookEndpoints.teamDbId, currentTeam.dbId),
					),
				)
				.limit(1);
			if (!endpoint) {
				return Response.json({ logs: [] });
			}
			resolvedEndpointId = endpoint.dbId;
		}

		if (!resolvedEndpointId) {
			return Response.json({ logs: [] });
		}

		const logs = await db
			.select()
			.from(webhookRequestLogs)
			.where(eq(webhookRequestLogs.webhookEndpointDbId, resolvedEndpointId))
			.orderBy(desc(webhookRequestLogs.createdAt))
			.limit(limit);

		return Response.json({ logs });
	} catch {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}
}
