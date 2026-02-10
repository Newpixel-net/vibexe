import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db, passwordResetTokens, users } from "@/db";

const TOKEN_EXPIRY_MINUTES = 60;

function generateResetToken(): string {
	return randomBytes(32).toString("hex");
}

export async function createPasswordResetToken(
	userDbId: number,
): Promise<string> {
	const token = generateResetToken();
	const expiresAt = new Date(
		Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000,
	);

	await db.insert(passwordResetTokens).values({
		userDbId,
		token,
		expiresAt,
	});

	return token;
}

export async function verifyPasswordResetToken(
	token: string,
): Promise<{ valid: true; userDbId: number } | { valid: false }> {
	const [record] = await db
		.select()
		.from(passwordResetTokens)
		.where(
			and(
				eq(passwordResetTokens.token, token),
				isNull(passwordResetTokens.usedAt),
			),
		)
		.limit(1);

	if (!record) return { valid: false };
	if (record.expiresAt < new Date()) return { valid: false };

	await db
		.update(passwordResetTokens)
		.set({ usedAt: new Date() })
		.where(eq(passwordResetTokens.id, record.id));

	return { valid: true, userDbId: record.userDbId };
}

export async function updatePasswordHash(
	userDbId: number,
	passwordHash: string,
): Promise<void> {
	await db
		.update(users)
		.set({ passwordHash })
		.where(eq(users.dbId, userDbId));
}
