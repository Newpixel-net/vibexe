import { NextResponse } from "next/server";
import {
	deleteProject,
	renameProject,
} from "@/app/(main)/app-builder/lib/project-queries";
import { getUser } from "@/lib/supabase/get-user";

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ projectId: string }> },
) {
	const user = await getUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { projectId } = await params;
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
	const deleted = await deleteProject(projectId);

	if (!deleted) {
		return NextResponse.json(
			{ error: "Project not found" },
			{ status: 404 },
		);
	}

	return NextResponse.json({ success: true });
}
