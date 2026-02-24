"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, users } from "@/db";
import { type AuthError, createAuthError } from "@/lib/auth/errors";
import { createPasswordResetToken } from "@/lib/auth/password-reset";
import { sendPasswordResetEmail as sendResetEmail } from "@/lib/auth/send-auth-email";

export const sendPasswordResetEmail = async (
	_prevState: AuthError | null,
	formData: FormData,
): Promise<AuthError | null> => {
	const email = formData.get("email");
	if (email == null || typeof email !== "string") {
		return createAuthError({
			code: "invalid_email",
			message: "Please enter a valid email address.",
			name: "AuthValidationError",
			status: 422,
		});
	}

	const [user] = await db
		.select({ dbId: users.dbId })
		.from(users)
		.where(eq(users.email, email))
		.limit(1);

	// Always redirect to "sent" page even if user not found (prevent enumeration)
	if (user) {
		const token = await createPasswordResetToken(user.dbId);
		const origin =
			process.env.NEXT_PUBLIC_URL || process.env.VERCEL_URL || "http://localhost:3000";
		const resetUrl = `${origin}/password_reset/confirm?token_hash=${token}&type=recovery`;
		await sendResetEmail(email, resetUrl);
	}

	redirect("/password_reset/sent");
	return null;
};
