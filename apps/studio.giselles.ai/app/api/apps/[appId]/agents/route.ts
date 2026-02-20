/**
 * App Agents API
 *
 * GET    /api/apps/{appId}/agents — List all agents for this app
 * POST   /api/apps/{appId}/agents — Create a new agent
 * PUT    /api/apps/{appId}/agents — Update an existing agent
 * DELETE /api/apps/{appId}/agents — Delete an agent
 */

import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
	type BuilderAppId,
	builderApps,
	builderAppAgents,
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

		const agents = await db.query.builderAppAgents.findMany({
			where: eq(builderAppAgents.appDbId, app.dbId),
			orderBy: (agents, { asc }) => [asc(agents.createdAt)],
		});

		return NextResponse.json({ agents });
	} catch (error) {
		console.error("[Agents API] GET error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
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

		const [agent] = await db
			.insert(builderAppAgents)
			.values({
				appDbId: app.dbId,
				name: body.name ?? "AI Assistant",
				systemPrompt: body.systemPrompt ?? null,
				model: body.model ?? "gpt-4o-mini",
				temperature: body.temperature?.toString() ?? "0.7",
				toolsEnabled: body.toolsEnabled ?? [],
				uiConfig: body.uiConfig ?? {},
			})
			.returning();

		return NextResponse.json({ agent }, { status: 201 });
	} catch (error) {
		console.error("[Agents API] POST error:", error);
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

		if (!body.agentDbId) {
			return NextResponse.json(
				{ error: "agentDbId is required" },
				{ status: 400 },
			);
		}

		const updateFields: Record<string, unknown> = {};
		if (body.name !== undefined) updateFields.name = body.name;
		if (body.enabled !== undefined) updateFields.enabled = body.enabled;
		if (body.systemPrompt !== undefined) updateFields.systemPrompt = body.systemPrompt;
		if (body.model !== undefined) updateFields.model = body.model;
		if (body.temperature !== undefined) updateFields.temperature = body.temperature.toString();
		if (body.toolsEnabled !== undefined) updateFields.toolsEnabled = body.toolsEnabled;
		if (body.uiConfig !== undefined) updateFields.uiConfig = body.uiConfig;

		const [updated] = await db
			.update(builderAppAgents)
			.set(updateFields)
			.where(
				and(
					eq(builderAppAgents.dbId, body.agentDbId),
					eq(builderAppAgents.appDbId, app.dbId),
				),
			)
			.returning();

		if (!updated) {
			return NextResponse.json(
				{ error: "Agent not found" },
				{ status: 404 },
			);
		}

		return NextResponse.json({ agent: updated });
	} catch (error) {
		console.error("[Agents API] PUT error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
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

		if (!body.agentDbId) {
			return NextResponse.json(
				{ error: "agentDbId is required" },
				{ status: 400 },
			);
		}

		const [deleted] = await db
			.delete(builderAppAgents)
			.where(
				and(
					eq(builderAppAgents.dbId, body.agentDbId),
					eq(builderAppAgents.appDbId, app.dbId),
				),
			)
			.returning();

		if (!deleted) {
			return NextResponse.json(
				{ error: "Agent not found" },
				{ status: 404 },
			);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[Agents API] DELETE error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
