"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidReturnUrl } from "@/app/(auth)/lib";
import { db, users } from "@/db";
import { type AuthError, createAuthError } from "@/lib/auth/errors";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/session-store";

export async function login(
	_prevState: AuthError | null,
	formData: FormData,
): Promise<AuthError | null> {
	const emailEntry = formData.get("email");
	const passwordEntry = formData.get("password");
	if (typeof emailEntry !== "string" || typeof passwordEntry !== "string") {
		return createAuthError({
			code: "invalid_credentials_payload",
			message: "Please enter both email and password.",
			name: "AuthValidationError",
			status: 400,
		});
	}

	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.email, emailEntry))
		.limit(1);

	if (!user || !user.passwordHash) {
		return createAuthError({
			code: "invalid_credentials",
			message: "Invalid email or password.",
			name: "AuthError",
			status: 400,
		});
	}

	const valid = await verifyPassword(passwordEntry, user.passwordHash);
	if (!valid) {
		return createAuthError({
			code: "invalid_credentials",
			message: "Invalid email or password.",
			name: "AuthError",
			status: 400,
		});
	}

	if (!user.emailVerified) {
		return createAuthError({
			code: "email_not_verified",
			message: "Please verify your email address before signing in.",
			name: "AuthError",
			status: 403,
		});
	}

	const session = await createSession(user.id);
	const cookieStore = await cookies();
	cookieStore.set("giselle-auth", session.token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 7 * 24 * 60 * 60,
		path: "/",
	});

	const returnUrlEntry = formData.get("returnUrl");
	const fallbackUrl = "/playground";
	const validReturnUrl = isValidReturnUrl(returnUrlEntry)
		? returnUrlEntry
		: fallbackUrl;
	redirect(validReturnUrl);
	return null;
}
