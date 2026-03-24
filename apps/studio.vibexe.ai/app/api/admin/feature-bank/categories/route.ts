import { NextResponse } from "next/server";
import { db } from "@/db";
import { featureBankSnippets } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-guard";
import { sql } from "drizzle-orm";

/**
 * GET /api/admin/feature-bank/categories
 * Returns all categories as a tree structure with counts
 */
export async function GET() {
	try {
		await requireAdmin();

		const rows = await db
			.select({
				category: featureBankSnippets.category,
				count: sql<number>`count(*)::int`,
			})
			.from(featureBankSnippets)
			.groupBy(featureBankSnippets.category)
			.orderBy(featureBankSnippets.category);

		// Build tree from flat "Mechanics/Movement" paths
		type TreeNode = { name: string; count: number; children: TreeNode[] };
		const root: TreeNode[] = [];

		for (const row of rows) {
			const parts = row.category.split("/");
			let current = root;
			for (let i = 0; i < parts.length; i++) {
				const name = parts[i];
				let node = current.find((n) => n.name === name);
				if (!node) {
					node = { name, count: 0, children: [] };
					current.push(node);
				}
				if (i === parts.length - 1) {
					node.count = row.count;
				}
				current = node.children;
			}
		}

		return NextResponse.json({ categories: root, flat: rows });
	} catch (error) {
		if (error instanceof Error && error.message.includes("Unauthorized")) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		console.error("[Feature Bank] Categories error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
