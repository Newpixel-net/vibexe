import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
	attachWorkflowToApp,
	detachWorkflowFromApp,
	getWorkflowsForApp,
} from "@/app/(main)/app-builder/lib/workflow-queries";
import { getAppById } from "@/app/(main)/app-builder/lib/queries";
import { db } from "@/db";
import { teamMemberships } from "@/db/schema";
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

	// Verify app ownership
	const app = await getAppById(appId, user.id);
	if (!app) {
		return NextResponse.json({ error: "App not found" }, { status: 404 });
	}

	const workflows = await getWorkflowsForApp(appId);

	return NextResponse.json({ workflows });
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

	// Verify app ownership
	const app = await getAppById(appId, user.id);
	if (!app) {
		return NextResponse.json({ error: "App not found" }, { status: 404 });
	}

	const body = (await request.json()) as {
		workspaceId: string;
		purpose?: string;
		label?: string;
	};

	if (!body.workspaceId) {
		return NextResponse.json(
			{ error: "workspaceId is required" },
			{ status: 400 },
		);
	}

	try {
		const link = await attachWorkflowToApp(
			appId,
			body.workspaceId,
			body.purpose,
			body.label,
		);
		return NextResponse.json({ link }, { status: 201 });
	} catch (error) {
		return NextResponse.json(
			{ error: (error as Error).message },
			{ status: 404 },
		);
	}
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ appId: string }> },
) {
	const user = await getUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { appId } = await params;

	// Verify app ownership
	const app = await getAppById(appId, user.id);
	if (!app) {
		return NextResponse.json({ error: "App not found" }, { status: 404 });
	}

	const body = (await request.json()) as { linkId: string };

	if (!body.linkId) {
		return NextResponse.json(
			{ error: "linkId is required" },
			{ status: 400 },
		);
	}

	const deleted = await detachWorkflowFromApp(body.linkId);
	if (!deleted) {
		return NextResponse.json({ error: "Link not found" }, { status: 404 });
	}

	return NextResponse.json({ success: true });
}
