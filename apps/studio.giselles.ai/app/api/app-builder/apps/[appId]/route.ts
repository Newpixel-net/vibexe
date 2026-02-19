import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
	deleteApp,
	duplicateApp,
	getAppById,
	updateAppSettings,
} from "@/app/(main)/app-builder/lib/queries";
import { db, teamMemberships } from "@/db";
import { getUser } from "@/lib/auth/get-user";

export async function GET(
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

	return NextResponse.json({
		id: app.id,
		name: app.name,
		description: app.description,
		visibility: app.visibility ?? "public",
		requireLogin: app.requireLogin ?? false,
		shareToken: app.shareToken,
		createdAt: app.createdAt,
		updatedAt: app.updatedAt,
	});
}

export async function PATCH(
	request: Request,
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

	const body = await request.json();
	const settings: Record<string, unknown> = {};

	if (typeof body.name === "string") settings.name = body.name.trim();
	if (typeof body.description === "string") settings.description = body.description;
	if (body.visibility === "public" || body.visibility === "private")
		settings.visibility = body.visibility;
	if (typeof body.requireLogin === "boolean")
		settings.requireLogin = body.requireLogin;

	await updateAppSettings(appId, settings);
	return NextResponse.json({ success: true });
}

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
