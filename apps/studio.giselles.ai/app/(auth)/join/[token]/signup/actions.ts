"use server";

import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, users } from "@/db";
import { createEmailVerificationToken } from "@/lib/auth/email-verification";
import { hashPassword } from "@/lib/auth/password";
import { sendVerificationEmail } from "@/lib/auth/send-auth-email";

export async function signupJoin(formData: FormData) {
	const token = formData.get("token") as string;
	const email = formData.get("email") as string;
	const password = formData.get("password") as string;

	const [existing] = await db
		.select({ dbId: users.dbId })
		.from(users)
		.where(eq(users.email, email))
		.limit(1);

	if (existing) {
		return { error: "An account with this email already exists." };
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

	const otpToken = await createEmailVerificationToken(user.dbId, email);
	await sendVerificationEmail(email, otpToken);

	redirect(`/join/${encodeURIComponent(token)}/signup/verify-email`);
}
