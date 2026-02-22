/**
 * App Auth Settings API
 *
 * GET  /api/apps/{appId}/auth-settings — Return current auth method toggles
 * PUT  /api/apps/{appId}/auth-settings — Upsert auth method toggles
 */

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
	type BuilderAppId,
	builderApps,
	builderAppAuthSettings,
} from "@/db/schema";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

const DEFAULTS = {
	emailPasswordEnabled: true,
	googleEnabled: false,
	githubEnabled: false,
	microsoftEnabled: false,
	appleEnabled: false,
	requireApproval: false,
};

export async function GET(_request: Request, { params }: RouteParams) {
	try {
		const { appId } = await params;

		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});

		if (!app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		const settings = await db.query.builderAppAuthSettings.findFirst({
			where: eq(builderAppAuthSettings.appDbId, app.dbId),
		});

		if (!settings) {
			return NextResponse.json(DEFAULTS);
		}

		return NextResponse.json({
			emailPasswordEnabled: settings.emailPasswordEnabled,
			googleEnabled: settings.googleEnabled,
			githubEnabled: settings.githubEnabled,
			microsoftEnabled: settings.microsoftEnabled,
			appleEnabled: settings.appleEnabled,
			requireApproval: settings.requireApproval,
		});
	} catch (error) {
		console.error("[Auth Settings API] GET error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function PUT(request: Request, { params }: RouteParams) {
	try {
		const { appId } = await params;

		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});

		if (!app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		const body = await request.json();

		const values = {
			appDbId: app.dbId,
			emailPasswordEnabled: body.emailPasswordEnabled ?? DEFAULTS.emailPasswordEnabled,
			googleEnabled: body.googleEnabled ?? DEFAULTS.googleEnabled,
			githubEnabled: body.githubEnabled ?? DEFAULTS.githubEnabled,
			microsoftEnabled: body.microsoftEnabled ?? DEFAULTS.microsoftEnabled,
			appleEnabled: body.appleEnabled ?? DEFAULTS.appleEnabled,
			requireApproval: body.requireApproval ?? DEFAULTS.requireApproval,
		};

		await db
			.insert(builderAppAuthSettings)
			.values(values)
			.onConflictDoUpdate({
				target: builderAppAuthSettings.appDbId,
				set: {
					emailPasswordEnabled: values.emailPasswordEnabled,
					googleEnabled: values.googleEnabled,
					githubEnabled: values.githubEnabled,
					microsoftEnabled: values.microsoftEnabled,
					appleEnabled: values.appleEnabled,
					requireApproval: values.requireApproval,
				},
			});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[Auth Settings API] PUT error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
