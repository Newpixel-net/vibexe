"use server";

import { captureException } from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, users } from "@/db";
import {
	createEmailVerificationToken,
	verifyEmailToken,
} from "@/lib/auth/email-verification";
import { createAuthError } from "@/lib/auth/errors";
import { sendVerificationEmail } from "@/lib/auth/send-auth-email";
import { createSession } from "@/lib/session-store";
import { initializeAccount } from "@/services/accounts";
import { JoinError } from "../../errors";
import { acceptInvitation } from "../../invitation";

export async function verifyJoinEmail(formData: FormData) {
	const invitedEmailEntry = formData.get("invitedEmail");
	const otpTokenEntry = formData.get("token");
	const invitationTokenEntry = formData.get("invitationToken");
	if (
		typeof invitedEmailEntry !== "string" ||
		typeof otpTokenEntry !== "string" ||
		typeof invitationTokenEntry !== "string"
	) {
		return {
			error: "Invalid verification payload. Please try again.",
		};
	}
	const invitedEmail = invitedEmailEntry;
	const otpToken = otpTokenEntry;
	const invitationToken = invitationTokenEntry;

	const result = await verifyEmailToken(invitedEmail, otpToken);
	if (!result.valid) {
		return {
			error:
				"The confirmation code you've entered has expired or is invalid.",
		};
	}

	// Mark user as verified
	const [user] = await db
		.update(users)
		.set({ emailVerified: true })
		.where(eq(users.dbId, result.userDbId))
		.returning({ id: users.id, email: users.email });

	if (!user) {
		return { error: "No user returned" };
	}

	await initializeAccount(user.id, user.email);

	// Create session
	const session = await createSession(user.id);
	const cookieStore = await cookies();
	cookieStore.set("giselle-auth", session.token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 7 * 24 * 60 * 60,
		path: "/",
	});

	// After successful email verification, automatically join the team
	try {
		await acceptInvitation(invitationToken);
	} catch (err: unknown) {
		if (err instanceof JoinError) {
			redirect(`/join/${encodeURIComponent(invitationToken)}`);
		}
		captureException(err);
		redirect(`/join/${encodeURIComponent(invitationToken)}`);
	}
	redirect("/join/success");
}

export async function resendJoinOtp(formData: FormData) {
	const invitedEmailEntry = formData.get("invitedEmail");
	if (typeof invitedEmailEntry !== "string") {
		return {
			code: "invalid_email",
			message: "Invalid email address.",
			status: 400,
			name: "AuthValidationError",
		};
	}
	const invitedEmail = invitedEmailEntry;

	const [user] = await db
		.select({ dbId: users.dbId })
		.from(users)
		.where(eq(users.email, invitedEmail))
		.limit(1);

	if (!user) {
		return createAuthError({
			code: "user_not_found",
			message: "No account found with this email.",
			name: "AuthError",
			status: 404,
		});
	}

	const token = await createEmailVerificationToken(user.dbId, invitedEmail);
	await sendVerificationEmail(invitedEmail, token);

	return {
		code: "success",
		status: 200,
		message: "A new confirmation code has been sent to your email address.",
		name: "Success",
	};
}
