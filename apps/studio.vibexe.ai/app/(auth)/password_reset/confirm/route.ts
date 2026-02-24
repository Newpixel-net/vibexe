import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db, users } from "@/db";
import { verifyPasswordResetToken } from "@/lib/auth/password-reset";
import { createSession } from "@/lib/session-store";

export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const tokenHash = searchParams.get("token_hash");
	const redirectTo = request.nextUrl.clone();

	if (tokenHash) {
		const result = await verifyPasswordResetToken(tokenHash);
		if (result.valid) {
			// Find user and create session so they can update their password
			const [user] = await db
				.select({ id: users.id })
				.from(users)
				.where(eq(users.dbId, result.userDbId))
				.limit(1);

			if (user) {
				const session = await createSession(user.id);
				redirectTo.pathname = "/password_reset/new_password";
				const response = NextResponse.redirect(redirectTo);
				response.cookies.set("vibexe-auth", session.token, {
					httpOnly: true,
					secure: process.env.NODE_ENV === "production",
					sameSite: "lax",
					maxAge: 7 * 24 * 60 * 60,
					path: "/",
				});
				return response;
			}
		}
	}

	redirectTo.pathname = "/password_reset";
	return NextResponse.redirect(redirectTo);
}
