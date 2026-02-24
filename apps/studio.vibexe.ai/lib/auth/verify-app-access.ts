import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { type BuilderAppId, builderApps, teamMemberships } from "@/db/schema";
import { getUser } from "./get-user";

/**
 * Verify the current user is logged in AND their team owns the given app.
 * Throws on failure — callers should catch and return 401/404.
 */
export async function verifyAppAccess(appId: string) {
	const user = await getUser(); // throws "No session token" / "Invalid or expired session"

	const membership = await db.query.teamMemberships.findFirst({
		where: eq(teamMemberships.userDbId, user.dbId),
	});
	if (!membership) throw new Error("No team membership");

	const app = await db.query.builderApps.findFirst({
		where: and(
			eq(builderApps.id, appId as BuilderAppId),
			eq(builderApps.teamDbId, membership.teamDbId),
		),
		columns: { dbId: true },
	});
	if (!app) throw new Error("App not found or access denied");

	return { user, teamDbId: membership.teamDbId, appDbId: app.dbId };
}
