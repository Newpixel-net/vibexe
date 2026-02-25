import type { NextRequest } from "next/server";
import { db } from "@/db";
import { workflowTemplates } from "@/db/schema";
import { getUser } from "@/lib/auth/get-user";
import { fetchCurrentTeam } from "@/services/teams/fetch-current-team";
import { eq, and, or, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * POST /api/workflow-templates/[id]/use
 *
 * "Use" a workflow template:
 *   1. Increments the template's useCount
 *   2. Returns the snapshot JSON so the client can import it
 */
export async function POST(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		await getUser();
		const currentTeam = await fetchCurrentTeam();
		const { id } = await params;

		const templateDbId = Number.parseInt(id, 10);
		if (Number.isNaN(templateDbId)) {
			return Response.json(
				{ error: "Invalid template id" },
				{ status: 400 },
			);
		}

		// Fetch the template — must be public or belong to user's team
		const results = await db
			.select({
				dbId: workflowTemplates.dbId,
				name: workflowTemplates.name,
				snapshot: workflowTemplates.snapshot,
				isPublic: workflowTemplates.isPublic,
				teamDbId: workflowTemplates.teamDbId,
			})
			.from(workflowTemplates)
			.where(
				and(
					eq(workflowTemplates.dbId, templateDbId),
					or(
						eq(workflowTemplates.isPublic, true),
						eq(workflowTemplates.teamDbId, currentTeam.dbId),
					),
				),
			)
			.limit(1);

		if (results.length === 0) {
			return Response.json(
				{ error: "Template not found" },
				{ status: 404 },
			);
		}

		const template = results[0];

		// Increment useCount atomically
		await db
			.update(workflowTemplates)
			.set({
				useCount: sql`${workflowTemplates.useCount} + 1`,
			})
			.where(eq(workflowTemplates.dbId, templateDbId));

		return Response.json({
			template: {
				dbId: template.dbId,
				name: template.name,
				snapshot: template.snapshot,
			},
		});
	} catch (err) {
		console.error("[WorkflowTemplates] Error using template:", err);
		return Response.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
