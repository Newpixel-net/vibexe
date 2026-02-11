import { db } from "@/db";
import {
	users,
	teams,
	sessions,
	workspaces,
	tasks,
	oauthAppConfigs,
	integrationCredentials,
} from "@/db/schema";
import { count, eq, gt, sql } from "drizzle-orm";
import { getProviderKeys } from "@/lib/ai-provider-keys";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
	const now = new Date();
	const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

	const [
		userCount,
		teamsByPlan,
		activeSessionCount,
		workspaceCount,
		taskCountTotal,
		taskCount24h,
		providerKeys,
		oauthConfigCount,
		credentialCount,
	] = await Promise.all([
		db.select({ count: count() }).from(users).then((r) => r[0]?.count ?? 0),
		db
			.select({ plan: teams.plan, count: count() })
			.from(teams)
			.groupBy(teams.plan)
			.then((rows) =>
				Object.fromEntries(rows.map((r) => [r.plan, r.count])),
			),
		db
			.select({ count: count() })
			.from(sessions)
			.where(gt(sessions.expiresAt, now))
			.then((r) => r[0]?.count ?? 0),
		db
			.select({ count: count() })
			.from(workspaces)
			.then((r) => r[0]?.count ?? 0),
		db.select({ count: count() }).from(tasks).then((r) => r[0]?.count ?? 0),
		db
			.select({ count: count() })
			.from(tasks)
			.where(gt(tasks.createdAt, oneDayAgo))
			.then((r) => r[0]?.count ?? 0),
		getProviderKeys(),
		db
			.select({ count: count() })
			.from(oauthAppConfigs)
			.then((r) => r[0]?.count ?? 0),
		db
			.select({ count: count() })
			.from(integrationCredentials)
			.then((r) => r[0]?.count ?? 0),
	]);

	const totalTeams = Object.values(teamsByPlan as Record<string, number>).reduce(
		(a, b) => a + b,
		0,
	);
	const activeProviders = providerKeys.filter((k) => k.isActive).length;

	return (
		<DashboardClient
			stats={{
				userCount,
				totalTeams,
				teamsByPlan: teamsByPlan as Record<string, number>,
				activeSessionCount,
				workspaceCount,
				taskCountTotal,
				taskCount24h,
				activeProviders,
				totalProviders: providerKeys.length,
				oauthConfigCount,
				credentialCount,
			}}
		/>
	);
}
