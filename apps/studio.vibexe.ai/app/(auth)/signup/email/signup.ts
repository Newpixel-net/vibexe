"use server";

import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, users } from "@/db";
import { createEmailVerificationToken } from "@/lib/auth/email-verification";
import { type AuthError, createAuthError } from "@/lib/auth/errors";
import { hashPassword } from "@/lib/auth/password";
import { sendVerificationEmail } from "@/lib/auth/send-auth-email";

export async function signup(
	email: string,
	password: string,
): Promise<AuthError | null> {
	const [existing] = await db
		.select({ dbId: users.dbId })
		.from(users)
		.where(eq(users.email, email))
		.limit(1);

	if (existing) {
		return createAuthError({
			code: "user_already_exists",
			message: "An account with this email already exists.",
			name: "AuthError",
			status: 422,
		});
	}

	const passwordHash = await hashPassword(password);
	const userId = `usr_${createId()}` as const;

	const [user] = await db
		.insert(users)
		.values({
			id: userId,
			email,
			passwordHash,
			emailVerified: false,
		})
		.returning({ dbId: users.dbId });

	const token = await createEmailVerificationToken(user.dbId, email);
	await sendVerificationEmail(email, token);

	redirect("/signup/verify-email");
	return null;
}
