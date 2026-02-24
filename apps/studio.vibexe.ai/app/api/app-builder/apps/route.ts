/**
 * App Builder Apps API
 *
 * POST: Create a new builder app and return its redirect path.
 * Used by the sidebar "Create App" button.
 */

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createApp } from "@/app/(main)/app-builder/lib/queries";
import { db, teamMemberships } from "@/db";
import { getUser } from "@/lib/auth/get-user";

export async function POST() {
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

	const app = await createApp(membership.teamDbId, user.dbId, "Untitled App");

	const redirectPath = `/app-builder/${app.id}`;
	return NextResponse.json({ redirectPath }, { status: 201 });
}
