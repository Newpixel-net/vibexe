import type { WorkspaceId } from "@vibexe-ai/protocol";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, workspaces } from "@/db";
import { fetchCurrentTeam } from "@/services/teams";

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ workspaceId: string }> },
) {
	const { workspaceId } = await params;

	try {
		const currentTeam = await fetchCurrentTeam();

		// Verify workspace belongs to team
		const workspace = await db.query.workspaces.findFirst({
			where: (ws, { eq: eqFn }) =>
				and(
					eqFn(ws.id, workspaceId as WorkspaceId),
					eqFn(ws.teamDbId, currentTeam.dbId),
				),
			columns: { id: true },
		});
		if (!workspace) {
			return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
		}

		const body = await request.json();

		const updates: Record<string, unknown> = {};

		if ("errorWorkflowId" in body) {
			updates.errorWorkflowId = (body.errorWorkflowId || null) as WorkspaceId | null;
		}

		if (Object.keys(updates).length === 0) {
			return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
		}

		await db
			.update(workspaces)
			.set(updates)
			.where(eq(workspaces.id, workspaceId as WorkspaceId));

		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
}

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ workspaceId: string }> },
) {
	const { workspaceId } = await params;

	try {
		const currentTeam = await fetchCurrentTeam();

		// Verify workspace belongs to team
		const workspace = await db.query.workspaces.findFirst({
			where: (ws, { eq: eqFn }) =>
				and(
					eqFn(ws.id, workspaceId as WorkspaceId),
					eqFn(ws.teamDbId, currentTeam.dbId),
				),
			columns: { errorWorkflowId: true },
		});

		if (!workspace) {
			return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
		}

		return NextResponse.json({
			errorWorkflowId: workspace.errorWorkflowId ?? null,
		});
	} catch {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
}
