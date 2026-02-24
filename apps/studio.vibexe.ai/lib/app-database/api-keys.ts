/**
 * API Key Management for Per-App Databases
 *
 * Per-app API keys for external data access.
 * Keys are generated as vbx_{nanoid(32)}, stored as SHA-256 hashes.
 * The raw key is returned only once on creation.
 */

import { createHash } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { builderAppApiKeys } from "@/db/schema";

/**
 * Generate a new API key for an app.
 * Returns the raw key (shown only once) and the stored record.
 */
export async function generateApiKey(
	appDbId: number,
	label?: string,
): Promise<{ rawKey: string; record: typeof builderAppApiKeys.$inferSelect }> {
	const rawKey = `vbx_${nanoid(32)}`;
	const keyHash = hashKey(rawKey);
	const keyPrefix = rawKey.slice(0, 12); // "vbx_xxxxxxxx"

	const [record] = await db
		.insert(builderAppApiKeys)
		.values({
			appDbId,
			keyHash,
			keyPrefix,
			label: label || "Default",
		})
		.returning();

	return { rawKey, record };
}

/**
 * Verify an API key against stored hashes for an app.
 * Updates lastUsedAt on success.
 * Returns the matching key record or null.
 */
export async function verifyApiKey(
	appDbId: number,
	rawKey: string,
): Promise<typeof builderAppApiKeys.$inferSelect | null> {
	const keyHash = hashKey(rawKey);

	const match = await db.query.builderAppApiKeys.findFirst({
		where: and(
			eq(builderAppApiKeys.appDbId, appDbId),
			eq(builderAppApiKeys.keyHash, keyHash),
		),
	});
	if (!match) return null;

	// Update last used timestamp
	await db
		.update(builderAppApiKeys)
		.set({ lastUsedAt: new Date() })
		.where(eq(builderAppApiKeys.dbId, match.dbId));

	return match;
}

/**
 * List all API keys for an app (masked — no raw keys).
 */
export async function listApiKeys(appDbId: number) {
	return await db.query.builderAppApiKeys.findMany({
		where: eq(builderAppApiKeys.appDbId, appDbId),
		columns: {
			dbId: true,
			keyPrefix: true,
			label: true,
			createdAt: true,
			lastUsedAt: true,
		},
	});
}

/**
 * Revoke (delete) an API key.
 */
export async function revokeApiKey(
	appDbId: number,
	keyDbId: number,
): Promise<boolean> {
	const result = await db
		.delete(builderAppApiKeys)
		.where(
			and(
				eq(builderAppApiKeys.dbId, keyDbId),
				eq(builderAppApiKeys.appDbId, appDbId),
			),
		)
		.returning();

	return result.length > 0;
}

/**
 * SHA-256 hash of an API key for storage.
 */
function hashKey(rawKey: string): string {
	return createHash("sha256").update(rawKey).digest("hex");
}
