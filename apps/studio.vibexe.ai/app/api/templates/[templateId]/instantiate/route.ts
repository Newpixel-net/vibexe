import type { NextRequest } from "next/server";
import type { WorkspaceId } from "@vibexe-ai/protocol";
import { vibexe } from "@/app/vibexe";
import { db, workflowTemplates } from "@/db";
import { eq, sql } from "drizzle-orm";
import { fetchCurrentTeam } from "@/services/teams";

export const dynamic = "force-dynamic";

/**
 * POST /api/templates/[templateId]/instantiate
 *
 * Create a new workspace from a template snapshot.
 * Returns the new workspaceId for redirect.
 */
export async function POST(
	_request: NextRequest,
	{ params }: { params: Promise<{ templateId: string }> },
) {
	const { templateId } = await params;
	const templateDbId = Number.parseInt(templateId, 10);

	if (Number.isNaN(templateDbId)) {
		return Response.json({ error: "Invalid template ID" }, { status: 400 });
	}

	try {
		await fetchCurrentTeam(); // Verify user is authenticated

		// Get the template
		const [template] = await db
			.select({
				dbId: workflowTemplates.dbId,
				name: workflowTemplates.name,
				snapshot: workflowTemplates.snapshot,
			})
			.from(workflowTemplates)
			.where(eq(workflowTemplates.dbId, templateDbId))
			.limit(1);

		if (!template) {
			return Response.json({ error: "Template not found" }, { status: 404 });
		}

		// Create a new workspace with the template snapshot
		const newWorkspace = await vibexe.createWorkspace();
		const workspaceId = newWorkspace.id;

		// Apply the template snapshot to the new workspace
		const snapshot = template.snapshot as Record<string, unknown>;
		snapshot.id = workspaceId;
		await vibexe.updateWorkspace(
			snapshot as unknown as import("@vibexe-ai/protocol").Workspace,
		);

		// Increment use count
		await db
			.update(workflowTemplates)
			.set({ useCount: sql`${workflowTemplates.useCount} + 1` })
			.where(eq(workflowTemplates.dbId, templateDbId));

		return Response.json({
			workspaceId,
			templateName: template.name,
		});
	} catch (err) {
		console.error("[Templates] Error instantiating template:", err);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}
