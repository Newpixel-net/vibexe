import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { builderApps, teamMemberships, workspaces } from "@/db/schema";
import { getUser } from "@/lib/supabase/get-user";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
	const user = await getUser();
	if (!user) redirect("/login");

	const membership = await db.query.teamMemberships.findFirst({
		where: eq(teamMemberships.userDbId, user.dbId),
		with: { team: true },
	});

	if (!membership) {
		redirect("/app-builder");
	}

	const teamDbId = membership.teamDbId;

	const [recentApps, recentWorkflows] = await Promise.all([
		db.query.builderApps.findMany({
			where: eq(builderApps.teamDbId, teamDbId),
			orderBy: (apps, { desc }) => [desc(apps.updatedAt)],
			columns: {
				id: true,
				name: true,
				description: true,
				updatedAt: true,
			},
			limit: 6,
		}),
		db.query.workspaces.findMany({
			where: eq(workspaces.teamDbId, teamDbId),
			orderBy: (w, { desc }) => [desc(w.updatedAt)],
			columns: {
				id: true,
				name: true,
				updatedAt: true,
			},
			limit: 6,
		}),
	]);

	return (
		<DashboardClient
			recentApps={recentApps.map((app) => ({
				id: app.id,
				name: app.name,
				description: app.description,
				updatedAt: app.updatedAt.toISOString(),
			}))}
			recentWorkflows={recentWorkflows.map((w) => ({
				id: w.id,
				name: w.name,
				updatedAt: w.updatedAt.toISOString(),
			}))}
		/>
	);
}
