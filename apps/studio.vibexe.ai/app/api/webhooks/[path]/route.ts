import type { NextRequest } from "next/server";
import { NodeId, WorkspaceId } from "@vibexe-ai/protocol";
import { db } from "@/db";
import { agents, webhookEndpoints, webhookRequestLogs } from "@/db/schema";
import { vibexe } from "@/app/vibexe";
import { eq, and, lt, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Fire-and-forget webhook request logger. Auto-cleans entries beyond 100 per endpoint. */
async function logWebhookRequest(
	endpointDbId: number,
	method: string,
	path: string,
	headers: Record<string, string>,
	body: unknown,
	statusCode: number,
	responseBody: unknown,
	ipAddress: string | null,
) {
	try {
		await db.insert(webhookRequestLogs).values({
			webhookEndpointDbId: endpointDbId,
			method,
			path,
			headers,
			body: body as Record<string, unknown>,
			statusCode,
			responseBody: responseBody as Record<string, unknown>,
			ipAddress: ipAddress ?? undefined,
		});
		// Auto-cleanup: keep only latest 100 per endpoint
		const oldest = await db
			.select({ dbId: webhookRequestLogs.dbId })
			.from(webhookRequestLogs)
			.where(eq(webhookRequestLogs.webhookEndpointDbId, endpointDbId))
			.orderBy(desc(webhookRequestLogs.createdAt))
			.offset(100)
			.limit(1);
		if (oldest.length > 0) {
			await db
				.delete(webhookRequestLogs)
				.where(
					and(
						eq(webhookRequestLogs.webhookEndpointDbId, endpointDbId),
						lt(webhookRequestLogs.dbId, oldest[0].dbId),
					),
				);
		}
	} catch (err) {
		console.error("[Webhook] Failed to log request:", err);
	}
}

/**
 * POST /api/webhooks/[path]
 *
 * Receives webhook calls and triggers the associated workflow.
 * The webhook path is matched against the webhook_endpoints table.
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ path: string }> },
) {
	const { path } = await params;

	try {
		// Look up the webhook endpoint (filter by POST method)
		const [endpoint] = await db
			.select()
			.from(webhookEndpoints)
			.where(
				and(
					eq(webhookEndpoints.webhookPath, path),
					eq(webhookEndpoints.enabled, true),
					eq(webhookEndpoints.method, "POST"),
				),
			)
			.limit(1);

		if (!endpoint) {
			return Response.json(
				{ error: "Webhook endpoint not found or disabled" },
				{ status: 404 },
			);
		}

		// Check if the associated agent is published
		const [agent] = await db
			.select({ isPublished: agents.isPublished })
			.from(agents)
			.where(eq(agents.workspaceId, endpoint.sdkWorkspaceId))
			.limit(1);
		if (agent && !agent.isPublished) {
			return Response.json(
				{ error: "Workflow is not published" },
				{ status: 404 },
			);
		}

		// Parse request body
		let body: Record<string, unknown> = {};
		try {
			body = await request.json();
		} catch {
			// Empty or non-JSON body is OK
		}

		// Update last triggered timestamp
		await db
			.update(webhookEndpoints)
			.set({ lastTriggeredAt: new Date() })
			.where(eq(webhookEndpoints.dbId, endpoint.dbId));

		// Trigger the actual workflow generation
		const workspaceId = WorkspaceId.parse(endpoint.sdkWorkspaceId);
		await vibexe.createAndStartTask({
			workspaceId,
			nodeId: NodeId.parse(endpoint.agentNodeId),
			inputs: Object.keys(body).length > 0
				? [
						{
							type: "parameters" as const,
							items: Object.entries(body).map(([name, value]) => ({
								type: "string" as const,
								name,
								value: typeof value === "string" ? value : JSON.stringify(value),
							})),
						},
					]
				: [],
			generationOriginType: "api",
		});
		console.log(
			`[Webhook] Triggered: workspace=${endpoint.sdkWorkspaceId}, agent=${endpoint.agentNodeId}, path=${path}`,
		);

		const responseBody = {
			success: true,
			message: "Webhook received and workflow triggered",
			workspaceId: endpoint.sdkWorkspaceId,
			timestamp: new Date().toISOString(),
		};

		// Log the request (fire-and-forget)
		logWebhookRequest(endpoint.dbId, "POST", path, Object.fromEntries(request.headers), body, 200, responseBody, request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip"));

		return Response.json(responseBody);
	} catch (err) {
		console.error("[Webhook] Error processing webhook:", err);
		return Response.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

/**
 * GET /api/webhooks/[path]
 *
 * Handles GET webhook triggers.
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ path: string }> },
) {
	const { path } = await params;

	try {
		const [endpoint] = await db
			.select()
			.from(webhookEndpoints)
			.where(
				and(
					eq(webhookEndpoints.webhookPath, path),
					eq(webhookEndpoints.enabled, true),
					eq(webhookEndpoints.method, "GET"),
				),
			)
			.limit(1);

		if (!endpoint) {
			return Response.json(
				{ error: "Webhook endpoint not found or disabled" },
				{ status: 404 },
			);
		}

		// Check if the associated agent is published
		const [getAgent] = await db
			.select({ isPublished: agents.isPublished })
			.from(agents)
			.where(eq(agents.workspaceId, endpoint.sdkWorkspaceId))
			.limit(1);
		if (getAgent && !getAgent.isPublished) {
			return Response.json(
				{ error: "Workflow is not published" },
				{ status: 404 },
			);
		}

		// Parse query parameters as the trigger body
		const queryParams: Record<string, string> = {};
		request.nextUrl.searchParams.forEach((value, key) => {
			queryParams[key] = value;
		});

		// Update last triggered timestamp
		await db
			.update(webhookEndpoints)
			.set({ lastTriggeredAt: new Date() })
			.where(eq(webhookEndpoints.dbId, endpoint.dbId));

		// Trigger the actual workflow generation
		const workspaceId = WorkspaceId.parse(endpoint.sdkWorkspaceId);
		await vibexe.createAndStartTask({
			workspaceId,
			nodeId: NodeId.parse(endpoint.agentNodeId),
			inputs: Object.keys(queryParams).length > 0
				? [
						{
							type: "parameters" as const,
							items: Object.entries(queryParams).map(([name, value]) => ({
								type: "string" as const,
								name,
								value,
							})),
						},
					]
				: [],
			generationOriginType: "api",
		});
		console.log(
			`[Webhook GET] Triggered: workspace=${endpoint.sdkWorkspaceId}, agent=${endpoint.agentNodeId}, path=${path}`,
		);

		const responseBody = {
			success: true,
			message: "Webhook received and workflow triggered",
			workspaceId: endpoint.sdkWorkspaceId,
			timestamp: new Date().toISOString(),
		};

		// Log the request (fire-and-forget)
		logWebhookRequest(endpoint.dbId, "GET", path, Object.fromEntries(request.headers), queryParams, 200, responseBody, request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip"));

		return Response.json(responseBody);
	} catch (err) {
		console.error("[Webhook GET] Error processing webhook:", err);
		return Response.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
