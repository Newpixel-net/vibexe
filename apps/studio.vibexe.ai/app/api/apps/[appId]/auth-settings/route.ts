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
import { verifyAppAccess } from "@/lib/auth/verify-app-access";

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
	googleClientId: "",
	googleClientSecret: "",
	githubClientId: "",
	githubClientSecret: "",
};

export async function GET(_request: Request, { params }: RouteParams) {
	try {
		const { appId } = await params;

		try {
			await verifyAppAccess(appId);
		} catch {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

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
			googleClientId: settings.googleClientId ?? "",
			googleClientSecret: settings.googleClientSecret ? "••••••••" : "",
			githubClientId: settings.githubClientId ?? "",
			githubClientSecret: settings.githubClientSecret ? "••••••••" : "",
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

		try {
			await verifyAppAccess(appId);
		} catch {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const app = await db.query.builderApps.findFirst({
			where: eq(builderApps.id, appId as BuilderAppId),
			columns: { dbId: true },
		});

		if (!app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		const body = await request.json();

		// Build values — only include credentials if actually provided (not masked placeholder)
		const values: Record<string, unknown> = {
			appDbId: app.dbId,
			emailPasswordEnabled: body.emailPasswordEnabled ?? DEFAULTS.emailPasswordEnabled,
			googleEnabled: body.googleEnabled ?? DEFAULTS.googleEnabled,
			githubEnabled: body.githubEnabled ?? DEFAULTS.githubEnabled,
			microsoftEnabled: body.microsoftEnabled ?? DEFAULTS.microsoftEnabled,
			appleEnabled: body.appleEnabled ?? DEFAULTS.appleEnabled,
			requireApproval: body.requireApproval ?? DEFAULTS.requireApproval,
		};

		const setFields: Record<string, unknown> = {
			emailPasswordEnabled: values.emailPasswordEnabled,
			googleEnabled: values.googleEnabled,
			githubEnabled: values.githubEnabled,
			microsoftEnabled: values.microsoftEnabled,
			appleEnabled: values.appleEnabled,
			requireApproval: values.requireApproval,
		};

		// Only update credentials if a real value was sent (not the masked placeholder)
		if (body.googleClientId !== undefined && body.googleClientId !== "••••••••") {
			values.googleClientId = body.googleClientId || null;
			setFields.googleClientId = body.googleClientId || null;
		}
		if (body.googleClientSecret !== undefined && body.googleClientSecret !== "••••••••") {
			values.googleClientSecret = body.googleClientSecret || null;
			setFields.googleClientSecret = body.googleClientSecret || null;
		}
		if (body.githubClientId !== undefined && body.githubClientId !== "••••••••") {
			values.githubClientId = body.githubClientId || null;
			setFields.githubClientId = body.githubClientId || null;
		}
		if (body.githubClientSecret !== undefined && body.githubClientSecret !== "••••••••") {
			values.githubClientSecret = body.githubClientSecret || null;
			setFields.githubClientSecret = body.githubClientSecret || null;
		}

		await db
			.insert(builderAppAuthSettings)
			.values(values as typeof builderAppAuthSettings.$inferInsert)
			.onConflictDoUpdate({
				target: builderAppAuthSettings.appDbId,
				set: setFields,
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
