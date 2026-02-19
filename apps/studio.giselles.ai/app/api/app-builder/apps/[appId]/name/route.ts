import {
	getAppById,
	updateAppName,
} from "@/app/(main)/app-builder/lib/queries";
import { getUser } from "@/lib/auth/get-user";

/**
 * PUT /api/app-builder/apps/[appId]/name
 * Body: { name: string }
 * Returns: { success: true, name }
 */
export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ appId: string }> },
) {
	const user = await getUser();
	if (!user) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { appId } = await params;
	const app = await getAppById(appId, user.id);
	if (!app) {
		return Response.json({ error: "App not found" }, { status: 404 });
	}

	const body = await request.json();
	const name = typeof body.name === "string" ? body.name.trim() : "";
	if (!name || name.length > 100) {
		return Response.json({ error: "Invalid name" }, { status: 400 });
	}

	await updateAppName(appId, name);
	return Response.json({ success: true, name });
}
