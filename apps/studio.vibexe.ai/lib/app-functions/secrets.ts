/**
 * App Secrets Helper
 *
 * Loads and decrypts app secrets from builder_app_secrets table.
 * Uses the same token encryption as external DB credentials.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { builderAppSecrets } from "@/db/schema";
import { decryptToken } from "@/lib/token-encryption";

/**
 * Load all secrets for an app, decrypted into a key-value map.
 */
export async function loadAppSecrets(appDbId: number): Promise<Record<string, string>> {
	try {
		const rows = await db.query.builderAppSecrets.findMany({
			where: eq(builderAppSecrets.appDbId, appDbId),
		});

		const secrets: Record<string, string> = {};
		for (const row of rows) {
			try {
				secrets[row.key] = decryptToken(row.encryptedValue);
			} catch {
				// Skip secrets that fail to decrypt
			}
		}
		return secrets;
	} catch {
		// Table might not exist yet
		return {};
	}
}
