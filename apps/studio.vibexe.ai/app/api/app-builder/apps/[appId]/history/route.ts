import { NextResponse } from "next/server";
import {
	getAppById,
	getHistoryForApp,
} from "@/app/(main)/app-builder/lib/queries";
import { getUser } from "@/lib/auth/get-user";

interface RouteContext {
	params: Promise<{ appId: string }>;
}

/**
 * GET /api/app-builder/apps/[appId]/history
 *
 * Returns development history entries for a builder app.
 */
export async function GET(_request: Request, context: RouteContext) {
	try {
		const user = await getUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { appId } = await context.params;

		const app = await getAppById(appId, user.id);
		if (!app) {
			return NextResponse.json({ error: "App not found" }, { status: 404 });
		}

		const history = await getHistoryForApp(appId);

		return NextResponse.json({
			history: history.map((h) => ({
				id: h.dbId,
				summary: h.summary,
				details: h.details,
				sessionType: h.sessionType,
				createdAt: h.createdAt.toISOString(),
			})),
		});
	} catch (error) {
		console.error("[History API] GET error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
