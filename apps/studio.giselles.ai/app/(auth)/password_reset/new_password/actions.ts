"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { type AuthError, createAuthError } from "@/lib/auth/errors";
import { hashPassword } from "@/lib/auth/password";
import { updatePasswordHash } from "@/lib/auth/password-reset";
import { getSessionByToken } from "@/lib/session-store";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";

export const resetPassword = async (
	_prevState: AuthError | null,
	formData: FormData,
): Promise<AuthError | null> => {
	const newPassword = formData.get("new_password");
	if (
		newPassword == null ||
		typeof newPassword !== "string" ||
		newPassword.trim() === ""
	) {
		return createAuthError({
			name: "PasswordResetError",
			message: "Please enter a valid password",
			status: 422,
			code: "validation_failed",
		});
	}

	const cookieStore = await cookies();
	const sessionToken = cookieStore.get("giselle-auth")?.value;
	if (!sessionToken) {
		return createAuthError({
			name: "AuthError",
			message: "Session expired. Please request a new password reset link.",
			status: 401,
			code: "session_expired",
		});
	}

	const session = await getSessionByToken(sessionToken);
	if (!session) {
		return createAuthError({
			name: "AuthError",
			message: "Session expired. Please request a new password reset link.",
			status: 401,
			code: "session_expired",
		});
	}

	const [user] = await db
		.select({ dbId: users.dbId })
		.from(users)
		.where(eq(users.id, session.userId as `usr_${string}`))
		.limit(1);

	if (!user) {
		return createAuthError({
			name: "AuthError",
			message: "User not found.",
			status: 404,
			code: "user_not_found",
		});
	}

	const passwordHash = await hashPassword(newPassword);
	await updatePasswordHash(user.dbId, passwordHash);

	redirect("/password_reset/complete");
	return null;
};
