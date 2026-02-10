import { randomInt } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db, emailVerificationTokens } from "@/db";

const TOKEN_LENGTH = 6;
const TOKEN_EXPIRY_MINUTES = 60;

function generateOtp(): string {
	const max = 10 ** TOKEN_LENGTH;
	return randomInt(0, max).toString().padStart(TOKEN_LENGTH, "0");
}

export async function createEmailVerificationToken(
	userDbId: number,
	email: string,
): Promise<string> {
	const token = generateOtp();
	const expiresAt = new Date(
		Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000,
	);

	await db.insert(emailVerificationTokens).values({
		userDbId,
		email,
		token,
		expiresAt,
	});

	return token;
}

export async function verifyEmailToken(
	email: string,
	token: string,
): Promise<{ valid: true; userDbId: number } | { valid: false }> {
	const [record] = await db
		.select()
		.from(emailVerificationTokens)
		.where(
			and(
				eq(emailVerificationTokens.email, email),
				eq(emailVerificationTokens.token, token),
				isNull(emailVerificationTokens.usedAt),
			),
		)
		.limit(1);

	if (!record) return { valid: false };
	if (record.expiresAt < new Date()) return { valid: false };

	await db
		.update(emailVerificationTokens)
		.set({ usedAt: new Date() })
		.where(eq(emailVerificationTokens.id, record.id));

	return { valid: true, userDbId: record.userDbId };
}
