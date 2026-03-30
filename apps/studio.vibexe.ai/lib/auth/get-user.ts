import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db, users } from "@/db";
import { getSessionByToken } from "../session-store";

const SESSION_COOKIE_NAME = "vibexe-auth";

export interface VibexeUser {
	id: string;
	dbId: number;
	email?: string;
	displayName?: string;
	avatarUrl?: string;
	identities?: Array<{ provider: string; providerAccountId?: string }>;
}

const getUser = async (): Promise<VibexeUser> => {
	const cookieStore = await cookies();
	const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

	if (!sessionToken) {
		throw new Error("No session token");
	}

	const session = await getSessionByToken(sessionToken);
	if (!session) {
		throw new Error("Invalid or expired session");
	}

	const userId = session.userId as `usr_${string}`;

	const userResult = await db
		.select()
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (userResult.length === 0) {
		throw new Error("User not found");
	}

	return {
		id: userResult[0].id,
		dbId: userResult[0].dbId,
		email: userResult[0].email ?? undefined,
		displayName: userResult[0].displayName ?? undefined,
		avatarUrl: userResult[0].avatarUrl ?? undefined,
	};
};

export { getUser };
