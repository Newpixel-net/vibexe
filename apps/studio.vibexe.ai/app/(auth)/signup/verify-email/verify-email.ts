"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, users } from "@/db";
import {
	createEmailVerificationToken,
	verifyEmailToken,
} from "@/lib/auth/email-verification";
import { type AuthError, createAuthError } from "@/lib/auth/errors";
import { sendVerificationEmail } from "@/lib/auth/send-auth-email";
import { createSession } from "@/lib/session-store";
import { initializeAccount } from "@/services/accounts";

export const verifyEmail = async (
	_prevState: null | AuthError,
	formData: FormData,
): Promise<AuthError | null> => {
	const verificationEmailEntry = formData.get("verificationEmail");
	const tokenEntry = formData.get("token");
	if (
		typeof verificationEmailEntry !== "string" ||
		typeof tokenEntry !== "string"
	) {
		return createAuthError({
			code: "invalid_verification_payload",
			message: "Invalid verification payload. Please request a new code.",
			name: "AuthValidationError",
			status: 400,
		});
	}
	const verificationEmail = verificationEmailEntry;
	const token = tokenEntry;

	const result = await verifyEmailToken(verificationEmail, token);
	if (!result.valid) {
		return createAuthError({
			code: "invalid_token",
			message:
				"The confirmation code you've entered has expired or is invalid.",
			name: "AuthError",
			status: 400,
		});
	}

	// Mark user as verified
	const [user] = await db
		.update(users)
		.set({ emailVerified: true })
		.where(eq(users.dbId, result.userDbId))
		.returning({ id: users.id, email: users.email });

	if (!user) {
		return createAuthError({
			code: "missing_user",
			message: "No user returned",
			name: "AuthMissingUserError",
			status: 500,
		});
	}

	// Initialize account (creates team, sample workspaces, etc.)
	await initializeAccount(user.id, user.email);

	// Create session
	const session = await createSession(user.id);
	const cookieStore = await cookies();
	cookieStore.set("vibexe-auth", session.token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 7 * 24 * 60 * 60,
		path: "/",
	});

	redirect("/");
};

export const resendOtp = async (
	_prevState: null | AuthError,
	formData: FormData,
): Promise<AuthError | null> => {
	const verificationEmailEntry = formData.get("verificationEmail");
	if (typeof verificationEmailEntry !== "string") {
		return createAuthError({
			code: "invalid_email",
			message: "Please enter a valid email address.",
			name: "AuthValidationError",
			status: 422,
		});
	}
	const verificationEmail = verificationEmailEntry;

	const [user] = await db
		.select({ dbId: users.dbId })
		.from(users)
		.where(eq(users.email, verificationEmail))
		.limit(1);

	if (!user) {
		return createAuthError({
			code: "user_not_found",
			message: "No account found with this email address.",
			name: "AuthError",
			status: 404,
		});
	}

	const token = await createEmailVerificationToken(
		user.dbId,
		verificationEmail,
	);
	await sendVerificationEmail(verificationEmail, token);

	return {
		code: "success",
		status: 200,
		message: "A new confirmation code has been sent to your email address.",
		name: "Success",
	};
};
