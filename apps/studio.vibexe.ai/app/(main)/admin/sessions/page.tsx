import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { eq, gt } from "drizzle-orm";
import { SessionsClient } from "./sessions-client";

export default async function SessionsPage() {
	const now = new Date();

	const activeSessions = await db
		.select({
			id: sessions.id,
			userId: sessions.userId,
			ipAddress: sessions.ipAddress,
			userAgent: sessions.userAgent,
			createdAt: sessions.createdAt,
			expiresAt: sessions.expiresAt,
			userEmail: users.email,
			userName: users.displayName,
			userDbId: users.dbId,
		})
		.from(sessions)
		.leftJoin(users, eq(sessions.userId, users.id))
		.where(gt(sessions.expiresAt, now))
		.orderBy(sessions.createdAt);

	const sessionData = activeSessions.map((s) => ({
		id: s.id,
		userId: s.userId,
		userDbId: s.userDbId ?? 0,
		userEmail: s.userEmail ?? "unknown",
		userName: s.userName ?? "",
		ipAddress: s.ipAddress ?? "unknown",
		userAgent: s.userAgent ?? "",
		createdAt: s.createdAt.toISOString(),
		expiresAt: s.expiresAt.toISOString(),
	}));

	return <SessionsClient sessions={sessionData} />;
}
