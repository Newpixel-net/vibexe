import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
	deleteProject,
	renameProject,
} from "@/app/(main)/app-builder/lib/project-queries";
import { db } from "@/db";
import {
	type BuilderProjectId,
	builderProjects,
	teamMemberships,
} from "@/db/schema";
import { getUser } from "@/lib/auth/get-user";

/** Verify user is a member of the project's team */
async function verifyProjectOwnership(projectId: string, userDbId: number) {
	const project = await db.query.builderProjects.findFirst({
		where: eq(builderProjects.id, projectId as BuilderProjectId),
		columns: { teamDbId: true },
	});
	if (!project) return false;
	const membership = await db.query.teamMemberships.findFirst({
		where: and(
			eq(teamMemberships.userDbId, userDbId),
			eq(teamMemberships.teamDbId, project.teamDbId),
		),
	});
	return !!membership;
}

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ projectId: string }> },
) {
	const user = await getUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { projectId } = await params;

	if (!(await verifyProjectOwnership(projectId, user.dbId))) {
		return NextResponse.json({ error: "Project not found" }, { status: 404 });
	}

	const body = (await request.json()) as { name?: string };

	if (!body.name) {
		return NextResponse.json(
			{ error: "Name is required" },
			{ status: 400 },
		);
	}

	const project = await renameProject(projectId, body.name);
	if (!project) {
		return NextResponse.json(
			{ error: "Project not found" },
			{ status: 404 },
		);
	}

	return NextResponse.json({ project });
}

export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ projectId: string }> },
) {
	const user = await getUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { projectId } = await params;

	if (!(await verifyProjectOwnership(projectId, user.dbId))) {
		return NextResponse.json({ error: "Project not found" }, { status: 404 });
	}

	const deleted = await deleteProject(projectId);

	if (!deleted) {
		return NextResponse.json(
			{ error: "Project not found" },
			{ status: 404 },
		);
	}

	return NextResponse.json({ success: true });
}
