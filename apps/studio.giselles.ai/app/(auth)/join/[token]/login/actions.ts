"use server";

import { captureException } from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, users } from "@/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/session-store";
import { JoinError } from "../errors";
import { acceptInvitation } from "../invitation";

export async function loginUser(formData: FormData) {
	const email = formData.get("email") as string;
	const password = formData.get("password") as string;
	const token = formData.get("token") as string;

	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.email, email))
		.limit(1);

	if (!user || !user.passwordHash) {
		return { error: "Invalid email or password." };
	}

	const valid = await verifyPassword(password, user.passwordHash);
	if (!valid) {
		return { error: "Invalid email or password." };
	}

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

	// After successful login, automatically join the team
	try {
		await acceptInvitation(token);
	} catch (err: unknown) {
		if (err instanceof JoinError) {
			redirect(`/join/${encodeURIComponent(token)}`);
		}
		captureException(err);
		redirect(`/join/${encodeURIComponent(token)}`);
	}
	redirect("/join/success");
}
