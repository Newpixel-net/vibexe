import type { NextRequest } from "next/server";
import { NodeId, WorkspaceId } from "@giselles-ai/protocol";
import { db } from "@/db";
import { webhookEndpoints } from "@/db/schema";
import { giselle } from "@/app/giselle";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

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
		// Look up the webhook endpoint
		const [endpoint] = await db
			.select()
			.from(webhookEndpoints)
			.where(
				and(
					eq(webhookEndpoints.webhookPath, path),
					eq(webhookEndpoints.enabled, true),
				),
			)
			.limit(1);

		if (!endpoint) {
			return Response.json(
				{ error: "Webhook endpoint not found or disabled" },
				{ status: 404 },
			);
		}

		// Check method
		if (endpoint.method !== "POST" && endpoint.method !== request.method) {
			return Response.json(
				{ error: `Method ${request.method} not allowed. Expected ${endpoint.method}` },
				{ status: 405 },
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
		await giselle.createAndStartTask({
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

		return Response.json({
			success: true,
			message: "Webhook received and workflow triggered",
			workspaceId: endpoint.sdkWorkspaceId,
			timestamp: new Date().toISOString(),
		});
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
		await giselle.createAndStartTask({
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

		return Response.json({
			success: true,
			message: "Webhook received and workflow triggered",
			workspaceId: endpoint.sdkWorkspaceId,
			timestamp: new Date().toISOString(),
		});
	} catch (err) {
		console.error("[Webhook GET] Error processing webhook:", err);
		return Response.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
