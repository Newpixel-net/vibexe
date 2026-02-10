import { and, eq } from "drizzle-orm";
import { db, oauthCredentials } from "@/db";
import { getUser } from "@/lib/auth/get-user";

export async function deleteOauthCredential(provider: string) {
	const user = await getUser();

	await db
		.delete(oauthCredentials)
		.where(
			and(
				eq(oauthCredentials.userId, user.dbId),
				eq(oauthCredentials.provider, provider),
			),
		);
}
