import type { NextRequest } from "next/server";
import { db, customNodes } from "@/db";
import { eq, and } from "drizzle-orm";
import { fetchCurrentTeam } from "@/services/teams";

export const dynamic = "force-dynamic";

/**
 * PUT /api/custom-nodes/:nodeId
 * Body: { enabled?: boolean, definition?: object, displayName?: string, ... }
 *
 * Update a custom node.
 */
export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ nodeId: string }> },
) {
	try {
		const { nodeId } = await params;
		const currentTeam = await fetchCurrentTeam();
		const body = await request.json();

		const nodeDbId = Number.parseInt(nodeId, 10);
		if (Number.isNaN(nodeDbId)) {
			return Response.json({ error: "Invalid node ID" }, { status: 400 });
		}

		const updates: Record<string, unknown> = {
			updatedAt: new Date(),
		};

		if (body.enabled !== undefined) updates.enabled = body.enabled;
		if (body.displayName) updates.displayName = body.displayName;
		if (body.description !== undefined) updates.description = body.description;
		if (body.icon) updates.icon = body.icon;
		if (body.category) updates.category = body.category;
		if (body.version) updates.version = body.version;
		if (body.definition) updates.definition = body.definition;

		const [updated] = await db
			.update(customNodes)
			.set(updates)
			.where(
				and(
					eq(customNodes.dbId, nodeDbId),
					eq(customNodes.teamDbId, currentTeam.dbId),
				),
			)
			.returning({
				dbId: customNodes.dbId,
				name: customNodes.name,
				displayName: customNodes.displayName,
				enabled: customNodes.enabled,
				updatedAt: customNodes.updatedAt,
			});

		if (!updated) {
			return Response.json({ error: "Custom node not found" }, { status: 404 });
		}

		return Response.json({ node: updated });
	} catch (err) {
		console.error("[CustomNodes] Error updating:", err);
		return Response.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

/**
 * DELETE /api/custom-nodes/:nodeId
 *
 * Delete a custom node.
 */
export async function DELETE(
	_request: NextRequest,
	{ params }: { params: Promise<{ nodeId: string }> },
) {
	try {
		const { nodeId } = await params;
		const currentTeam = await fetchCurrentTeam();

		const nodeDbId = Number.parseInt(nodeId, 10);
		if (Number.isNaN(nodeDbId)) {
			return Response.json({ error: "Invalid node ID" }, { status: 400 });
		}

		const [deleted] = await db
			.delete(customNodes)
			.where(
				and(
					eq(customNodes.dbId, nodeDbId),
					eq(customNodes.teamDbId, currentTeam.dbId),
				),
			)
			.returning({ dbId: customNodes.dbId });

		if (!deleted) {
			return Response.json({ error: "Custom node not found" }, { status: 404 });
		}

		return Response.json({ success: true });
	} catch (err) {
		console.error("[CustomNodes] Error deleting:", err);
		return Response.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
