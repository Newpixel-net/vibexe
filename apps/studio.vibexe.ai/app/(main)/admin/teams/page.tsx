import { db } from "@/db";
import { teams, teamMemberships, workspaces, tasks } from "@/db/schema";
import { count, eq, sql } from "drizzle-orm";
import { TeamsClient } from "./teams-client";

export default async function TeamsPage() {
	const allTeams = await db
		.select({
			dbId: teams.dbId,
			id: teams.id,
			name: teams.name,
			plan: teams.plan,
			createdAt: teams.createdAt,
		})
		.from(teams);

	const memberCounts = await db
		.select({
			teamDbId: teamMemberships.teamDbId,
			count: count(),
		})
		.from(teamMemberships)
		.groupBy(teamMemberships.teamDbId);

	const workspaceCounts = await db
		.select({
			teamDbId: workspaces.teamDbId,
			count: count(),
		})
		.from(workspaces)
		.groupBy(workspaces.teamDbId);

	const taskCounts = await db
		.select({
			teamDbId: tasks.teamDbId,
			count: count(),
		})
		.from(tasks)
		.groupBy(tasks.teamDbId);

	const memberMap = new Map(memberCounts.map((m) => [m.teamDbId, m.count]));
	const wsMap = new Map(workspaceCounts.map((w) => [w.teamDbId, w.count]));
	const taskMap = new Map(taskCounts.map((t) => [t.teamDbId, t.count]));

	const teamData = allTeams.map((t) => ({
		dbId: t.dbId,
		id: t.id,
		name: t.name,
		plan: t.plan,
		memberCount: memberMap.get(t.dbId) ?? 0,
		workspaceCount: wsMap.get(t.dbId) ?? 0,
		taskCount: taskMap.get(t.dbId) ?? 0,
		createdAt: t.createdAt.toISOString(),
	}));

	return <TeamsClient teams={teamData} />;
}
