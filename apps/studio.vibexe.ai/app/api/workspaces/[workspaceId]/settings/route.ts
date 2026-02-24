import type { WorkspaceId } from "@vibexe-ai/protocol";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, workspaces } from "@/db";

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ workspaceId: string }> },
) {
	const { workspaceId } = await params;
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
}

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ workspaceId: string }> },
) {
	const { workspaceId } = await params;

	const workspace = await db.query.workspaces.findFirst({
		where: (ws, { eq: eqFn }) => eqFn(ws.id, workspaceId as WorkspaceId),
		columns: { errorWorkflowId: true },
	});

	return NextResponse.json({
		errorWorkflowId: workspace?.errorWorkflowId ?? null,
	});
}
