import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
	deleteApp,
	duplicateApp,
	getAppById,
} from "@/app/(main)/app-builder/lib/queries";
import { db, teamMemberships } from "@/db";
import { getUser } from "@/lib/auth/get-user";

export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ appId: string }> },
) {
	const user = await getUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { appId } = await params;

	const app = await getAppById(appId, user.id);
	if (!app) {
		return NextResponse.json({ error: "App not found" }, { status: 404 });
	}

	await deleteApp(appId);
	return NextResponse.json({ success: true });
}

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ appId: string }> },
) {
	const user = await getUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { appId } = await params;
	const body = await request.json();

	if (body.action !== "duplicate") {
		return NextResponse.json({ error: "Invalid action" }, { status: 400 });
	}

	const app = await getAppById(appId, user.id);
	if (!app) {
		return NextResponse.json({ error: "App not found" }, { status: 404 });
	}

	const membership = await db.query.teamMemberships.findFirst({
		where: eq(teamMemberships.userDbId, user.dbId),
	});

	if (!membership) {
		return NextResponse.json({ error: "No team found" }, { status: 400 });
	}

	const newApp = await duplicateApp(appId, membership.teamDbId, user.dbId);
	return NextResponse.json(
		{ success: true, appId: newApp.id, redirectPath: `/app-builder/${newApp.id}` },
		{ status: 201 },
	);
}
