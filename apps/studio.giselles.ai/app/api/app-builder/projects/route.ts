import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
	createProject,
	getProjectsForTeam,
} from "@/app/(main)/app-builder/lib/project-queries";
import { db, teamMemberships } from "@/db";
import { getUser } from "@/lib/auth/get-user";

export async function GET() {
	const user = await getUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const membership = await db.query.teamMemberships.findFirst({
		where: eq(teamMemberships.userDbId, user.dbId),
	});
	if (!membership) {
		return NextResponse.json({ error: "No team found" }, { status: 400 });
	}

	const projects = await getProjectsForTeam(membership.teamDbId);
	return NextResponse.json({ projects });
}

export async function POST(request: Request) {
	const user = await getUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const membership = await db.query.teamMemberships.findFirst({
		where: eq(teamMemberships.userDbId, user.dbId),
	});
	if (!membership) {
		return NextResponse.json({ error: "No team found" }, { status: 400 });
	}

	const body = (await request.json().catch(() => ({}))) as {
		name?: string;
		description?: string;
	};
	const name = body.name || "Untitled Project";

	const project = await createProject(
		membership.teamDbId,
		user.dbId,
		name,
		body.description,
	);

	return NextResponse.json({ project }, { status: 201 });
}
