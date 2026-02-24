import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { teamMemberships } from "@/db/schema";
import { getUser } from "@/lib/auth/get-user";
import { getDashboardData } from "@/lib/dashboard/get-dashboard-data";
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

	const data = await getDashboardData(user.dbId, membership.teamDbId);

	return <DashboardClient data={data} />;
}
