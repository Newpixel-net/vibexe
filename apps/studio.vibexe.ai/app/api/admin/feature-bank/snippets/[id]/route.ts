import { NextResponse } from "next/server";
import { db } from "@/db";
import { featureBankSnippets } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-guard";
import { eq } from "drizzle-orm";

/**
 * GET /api/admin/feature-bank/snippets/[id]
 * Get a single snippet with full code
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		await requireAdmin();
		const { id } = await params;
		const [snippet] = await db
			.select()
			.from(featureBankSnippets)
			.where(eq(featureBankSnippets.id, id));

		if (!snippet) {
			return NextResponse.json({ error: "Snippet not found" }, { status: 404 });
		}

		return NextResponse.json({ snippet });
	} catch (error) {
		if (error instanceof Error && error.message.includes("Unauthorized")) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		console.error("[Feature Bank] GET [id] error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

/**
 * PUT /api/admin/feature-bank/snippets/[id]
 * Update an existing snippet
 */
export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		await requireAdmin();
		const { id } = await params;
		const body = await request.json();

		const [updated] = await db
			.update(featureBankSnippets)
			.set(body)
			.where(eq(featureBankSnippets.id, id))
			.returning();

		if (!updated) {
			return NextResponse.json({ error: "Snippet not found" }, { status: 404 });
		}

		return NextResponse.json({ snippet: updated });
	} catch (error) {
		if (error instanceof Error && error.message.includes("Unauthorized")) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		console.error("[Feature Bank] PUT error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

/**
 * DELETE /api/admin/feature-bank/snippets/[id]
 * Delete a snippet
 */
export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		await requireAdmin();
		const { id } = await params;

		const [deleted] = await db
			.delete(featureBankSnippets)
			.where(eq(featureBankSnippets.id, id))
			.returning();

		if (!deleted) {
			return NextResponse.json({ error: "Snippet not found" }, { status: 404 });
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		if (error instanceof Error && error.message.includes("Unauthorized")) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		console.error("[Feature Bank] DELETE error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
