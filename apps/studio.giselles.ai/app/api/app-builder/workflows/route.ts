import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAvailableWorkflows } from "@/app/(main)/app-builder/lib/workflow-queries";
import { db } from "@/db";
import { teamMemberships } from "@/db/schema";
import { getUser } from "@/lib/supabase/get-user";

export async function GET() {
	const user = await getUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const membership = await db.query.teamMemberships.findFirst({
		where: eq(teamMemberships.userDbId, user.dbId),
	});

	if (!membership) {
		return NextResponse.json({ error: "No team found" }, { status: 404 });
	}

	const workflows = await getAvailableWorkflows(membership.teamDbId);

	return NextResponse.json({ workflows });
}
