/**
 * App Automations API
 *
 * GET    /api/apps/{appId}/automations — List automations for this app
 * POST   /api/apps/{appId}/automations — Create a new automation
 * PUT    /api/apps/{appId}/automations — Update an automation (toggle, config)
 * DELETE /api/apps/{appId}/automations — Delete an automation
 */

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
	type BuilderAppId,
	builderApps,
	builderAppAutomations,
} from "@/db/schema";

interface RouteParams {
	params: Promise<{ appId: string }>;
}

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

		const automations = await db.query.builderAppAutomations.findMany({
			where: eq(builderAppAutomations.appDbId, app.dbId),
		});

		return NextResponse.json({
			automations: automations.map((a) => ({
				dbId: a.dbId,
				name: a.name,
				enabled: a.enabled,
				triggerType: a.triggerType,
				triggerConfig: a.triggerConfig,
				actionType: a.actionType,
				actionConfig: a.actionConfig,
				lastRunAt: a.lastRunAt,
				runCount: a.runCount,
				createdAt: a.createdAt,
			})),
		});
	} catch (error) {
		console.error("[Automations API] GET error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function POST(request: Request, { params }: RouteParams) {
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
		const { name, triggerType, triggerConfig, actionType, actionConfig } = body as {
			name: string;
			triggerType: string;
			triggerConfig?: Record<string, unknown>;
			actionType: string;
			actionConfig?: Record<string, unknown>;
		};

		if (!name || !triggerType || !actionType) {
			return NextResponse.json(
				{ error: "name, triggerType, and actionType are required" },
				{ status: 400 },
			);
		}

		const [inserted] = await db
			.insert(builderAppAutomations)
			.values({
				appDbId: app.dbId,
				name,
				triggerType,
				triggerConfig: triggerConfig ?? {},
				actionType,
				actionConfig: actionConfig ?? {},
			})
			.returning();

		return NextResponse.json({
			success: true,
			automation: {
				dbId: inserted.dbId,
				name: inserted.name,
				enabled: inserted.enabled,
				triggerType: inserted.triggerType,
				triggerConfig: inserted.triggerConfig,
				actionType: inserted.actionType,
				actionConfig: inserted.actionConfig,
				lastRunAt: inserted.lastRunAt,
				runCount: inserted.runCount,
				createdAt: inserted.createdAt,
			},
		});
	} catch (error) {
		console.error("[Automations API] POST error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
		const { automationDbId, ...fields } = body as {
			automationDbId: number;
			name?: string;
			enabled?: boolean;
			triggerType?: string;
			triggerConfig?: Record<string, unknown>;
			actionType?: string;
			actionConfig?: Record<string, unknown>;
		};

		if (!automationDbId) {
			return NextResponse.json(
				{ error: "automationDbId is required" },
				{ status: 400 },
			);
		}

		// Verify automation belongs to this app
		const existing = await db.query.builderAppAutomations.findFirst({
			where: and(
				eq(builderAppAutomations.dbId, automationDbId),
				eq(builderAppAutomations.appDbId, app.dbId),
			),
		});

		if (!existing) {
			return NextResponse.json(
				{ error: "Automation not found" },
				{ status: 404 },
			);
		}

		const updateData: Record<string, unknown> = {};
		if (fields.name !== undefined) updateData.name = fields.name;
		if (fields.enabled !== undefined) updateData.enabled = fields.enabled;
		if (fields.triggerType !== undefined) updateData.triggerType = fields.triggerType;
		if (fields.triggerConfig !== undefined) updateData.triggerConfig = fields.triggerConfig;
		if (fields.actionType !== undefined) updateData.actionType = fields.actionType;
		if (fields.actionConfig !== undefined) updateData.actionConfig = fields.actionConfig;

		if (Object.keys(updateData).length > 0) {
			await db
				.update(builderAppAutomations)
				.set(updateData)
				.where(eq(builderAppAutomations.dbId, automationDbId));
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[Automations API] PUT error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function DELETE(request: Request, { params }: RouteParams) {
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
		const { automationDbId } = body as { automationDbId: number };

		if (!automationDbId) {
			return NextResponse.json(
				{ error: "automationDbId is required" },
				{ status: 400 },
			);
		}

		// Verify automation belongs to this app
		const existing = await db.query.builderAppAutomations.findFirst({
			where: and(
				eq(builderAppAutomations.dbId, automationDbId),
				eq(builderAppAutomations.appDbId, app.dbId),
			),
		});

		if (existing) {
			await db
				.delete(builderAppAutomations)
				.where(eq(builderAppAutomations.dbId, automationDbId));
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[Automations API] DELETE error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
