import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { moveAppToProject } from "@/app/(main)/app-builder/lib/project-queries";
import { getAppById } from "@/app/(main)/app-builder/lib/queries";
import { db, builderProjects } from "@/db";
import type { BuilderProjectId } from "@/db/schema";
import { getUser } from "@/lib/auth/get-user";

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ appId: string }> },
) {
	const user = await getUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { appId } = await params;

	// Verify app ownership
	const app = await getAppById(appId, user.dbId);
	if (!app) {
		return NextResponse.json({ error: "App not found" }, { status: 404 });
	}

	const body = (await request.json()) as { projectId: string | null };

	let projectDbId: number | null = null;

	if (body.projectId) {
		const project = await db.query.builderProjects.findFirst({
			where: eq(builderProjects.id, body.projectId as BuilderProjectId),
			columns: { dbId: true },
		});
		if (!project) {
			return NextResponse.json(
				{ error: "Project not found" },
				{ status: 404 },
			);
		}
		projectDbId = project.dbId;
	}

	const updated = await moveAppToProject(appId, projectDbId);
	if (!updated) {
		return NextResponse.json({ error: "App not found" }, { status: 404 });
	}

	return NextResponse.json({ app: updated });
}
