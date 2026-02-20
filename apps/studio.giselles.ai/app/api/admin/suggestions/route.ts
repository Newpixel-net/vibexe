import { NextResponse } from "next/server";
import {
	createSuggestionTemplate,
	deleteSuggestionTemplate,
	getAllSuggestionTemplates,
	updateSuggestionTemplate,
} from "@/app/(main)/app-builder/lib/queries";
import { requireAdmin } from "@/lib/admin-guard";

/**
 * GET /api/admin/suggestions
 * Returns all suggestion templates (admin only)
 */
export async function GET() {
	try {
		await requireAdmin();
		const templates = await getAllSuggestionTemplates();
		return NextResponse.json({ templates });
	} catch (error) {
		if (error instanceof Error && error.message.includes("Unauthorized")) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		console.error("[Admin Suggestions] GET error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * POST /api/admin/suggestions
 * Create a new suggestion template
 */
export async function POST(request: Request) {
	try {
		await requireAdmin();
		const body = await request.json();
		const { label, prompt, icon, category, conditions, priority, enabled } = body;

		if (!label || !prompt) {
			return NextResponse.json({ error: "Label and prompt are required" }, { status: 400 });
		}

		const template = await createSuggestionTemplate({
			label,
			prompt,
			icon: icon || "sparkles",
			category: category || "general",
			conditions: conditions || {},
			priority: priority ?? 50,
			enabled: enabled ?? true,
		});

		return NextResponse.json({ template });
	} catch (error) {
		if (error instanceof Error && error.message.includes("Unauthorized")) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		console.error("[Admin Suggestions] POST error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * PUT /api/admin/suggestions
 * Update an existing suggestion template
 */
export async function PUT(request: Request) {
	try {
		await requireAdmin();
		const body = await request.json();
		const { dbId, ...data } = body;

		if (!dbId) {
			return NextResponse.json({ error: "dbId is required" }, { status: 400 });
		}

		const updated = await updateSuggestionTemplate(dbId, data);
		if (!updated) {
			return NextResponse.json({ error: "Template not found" }, { status: 404 });
		}

		return NextResponse.json({ template: updated });
	} catch (error) {
		if (error instanceof Error && error.message.includes("Unauthorized")) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		console.error("[Admin Suggestions] PUT error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * DELETE /api/admin/suggestions?id=N
 * Delete a suggestion template
 */
export async function DELETE(request: Request) {
	try {
		await requireAdmin();
		const url = new URL(request.url);
		const id = url.searchParams.get("id");

		if (!id) {
			return NextResponse.json({ error: "id is required" }, { status: 400 });
		}

		const deleted = await deleteSuggestionTemplate(Number(id));
		if (!deleted) {
			return NextResponse.json({ error: "Template not found" }, { status: 404 });
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		if (error instanceof Error && error.message.includes("Unauthorized")) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		console.error("[Admin Suggestions] DELETE error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
