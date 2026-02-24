import { db } from "@/db";
import {
	users,
	sessions,
	teamMemberships,
	oauthCredentials,
} from "@/db/schema";
import { eq, gt, sql, count } from "drizzle-orm";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
	const now = new Date();

	const allUsers = await db
		.select({
			dbId: users.dbId,
			id: users.id,
			email: users.email,
			displayName: users.displayName,
			avatarUrl: users.avatarUrl,
			hasPassword: sql<boolean>`${users.passwordHash} IS NOT NULL`.as(
				"has_password",
			),
			emailVerified: users.emailVerified,
		})
		.from(users);

	const teamCounts = await db
		.select({
			userDbId: teamMemberships.userDbId,
			count: count(),
		})
		.from(teamMemberships)
		.groupBy(teamMemberships.userDbId);

	const sessionCounts = await db
		.select({
			userId: sessions.userId,
			count: count(),
		})
		.from(sessions)
		.where(gt(sessions.expiresAt, now))
		.groupBy(sessions.userId);

	const oauthProviders = await db
		.select({
			userId: oauthCredentials.userId,
			provider: oauthCredentials.provider,
		})
		.from(oauthCredentials);

	const teamCountMap = new Map(
		teamCounts.map((t) => [t.userDbId, t.count]),
	);
	const sessionCountMap = new Map(
		sessionCounts.map((s) => [s.userId, s.count]),
	);
	const oauthMap = new Map<number, string[]>();
	for (const oc of oauthProviders) {
		const existing = oauthMap.get(oc.userId) ?? [];
		existing.push(oc.provider);
		oauthMap.set(oc.userId, existing);
	}

	const userData = allUsers.map((u) => ({
		dbId: u.dbId,
		id: u.id,
		email: u.email ?? "",
		displayName: u.displayName ?? "",
		avatarUrl: u.avatarUrl ?? null,
		hasPassword: u.hasPassword,
		emailVerified: u.emailVerified,
		teamCount: teamCountMap.get(u.dbId) ?? 0,
		sessionCount: sessionCountMap.get(u.id) ?? 0,
		oauthProviders: oauthMap.get(u.dbId) ?? [],
	}));

	return <UsersClient users={userData} />;
}
