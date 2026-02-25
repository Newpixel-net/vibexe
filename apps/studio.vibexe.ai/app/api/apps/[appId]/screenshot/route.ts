/**
 * Screenshot API
 *
 * PUT /api/apps/{appId}/screenshot — Update app screenshot URLs + sync to template
 */

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { builderApps, builderAppTemplates } from "@/db/schema";
import { verifyAppAccess } from "@/lib/auth/verify-app-access";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
	try {
		const { appId } = await params;
		const { appDbId } = await verifyAppAccess(appId);

		const body = await request.json();
		const { thumbnailUrl, fullpageUrl } = body;

		// Update the app's screenshot fields
		const updateData: Record<string, unknown> = {};
		if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl;
		if (fullpageUrl !== undefined) updateData.fullpageUrl = fullpageUrl;

		if (Object.keys(updateData).length === 0) {
			return NextResponse.json({ error: "No fields to update" }, { status: 400 });
		}

		await db
			.update(builderApps)
			.set(updateData)
			.where(eq(builderApps.dbId, appDbId));

		// Sync to template if one exists for this app
		const template = await db.query.builderAppTemplates.findFirst({
			where: eq(builderAppTemplates.sourceAppDbId, appDbId),
			columns: { dbId: true },
		});

		if (template) {
			await db
				.update(builderAppTemplates)
				.set(updateData)
				.where(eq(builderAppTemplates.dbId, template.dbId));
		}

		return NextResponse.json({ success: true });
	} catch (e) {
		const message = e instanceof Error ? e.message : "Unknown error";
		if (message.includes("session") || message.includes("membership")) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		if (message.includes("not found") || message.includes("denied")) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
