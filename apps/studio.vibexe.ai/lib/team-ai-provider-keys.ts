import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { teamAiProviderKeys } from "@/db/schema";
import {
	AI_PROVIDERS,
	type ProviderId,
	type ProviderKeyInfo,
	redactKey,
} from "@/lib/ai-provider-keys";
import {
	EncryptionKeyMismatchError,
	decryptToken,
	encryptToken,
} from "@/lib/token-encryption";

const ENV_VAR_MAP: Record<ProviderId, string> = {
	anthropic: "ANTHROPIC_API_KEY",
	openai: "OPENAI_API_KEY",
	google: "GOOGLE_GENERATIVE_AI_API_KEY",
	perplexity: "PERPLEXITY_API_KEY",
	xai: "XAI_API_KEY",
	nvidia: "NVIDIA_API_KEY",
	fireworks: "FIREWORKS_API_KEY",
};

export { AI_PROVIDERS };

/**
 * Get all BYOK keys for a team (masked values for UI display).
 */
export async function getTeamProviderKeys(
	teamDbId: number,
): Promise<ProviderKeyInfo[]> {
	const rows = await db
		.select()
		.from(teamAiProviderKeys)
		.where(eq(teamAiProviderKeys.teamDbId, teamDbId));

	const keys: ProviderKeyInfo[] = [];
	for (const row of rows) {
		try {
			const decrypted = decryptToken(row.encryptedApiKey);
			keys.push({
				provider: row.provider as ProviderId,
				isActive: row.isActive,
				maskedKey: redactKey(decrypted),
				updatedAt: row.updatedAt,
				errorReason: null,
			});
		} catch (err) {
			const isKeyMismatch = err instanceof EncryptionKeyMismatchError;
			keys.push({
				provider: row.provider as ProviderId,
				isActive: row.isActive,
				maskedKey: isKeyMismatch ? "Key needs re-entry" : "(decrypt error)",
				updatedAt: row.updatedAt,
				errorReason: isKeyMismatch ? "key_mismatch" : "decrypt_failed",
			});
		}
	}
	return keys;
}

/**
 * Upsert a BYOK key for a team. Does NOT inject into process.env.
 */
export async function upsertTeamProviderKey(
	teamDbId: number,
	provider: string,
	apiKey: string,
): Promise<void> {
	const envVar = ENV_VAR_MAP[provider as ProviderId];
	if (!envVar) throw new Error(`Unknown provider: ${provider}`);

	const encrypted = encryptToken(apiKey);

	await db
		.insert(teamAiProviderKeys)
		.values({
			teamDbId,
			provider,
			encryptedApiKey: encrypted,
			isActive: true,
		})
		.onConflictDoUpdate({
			target: [teamAiProviderKeys.teamDbId, teamAiProviderKeys.provider],
			set: {
				encryptedApiKey: encrypted,
				isActive: true,
				updatedAt: new Date(),
			},
		});
}

/**
 * Delete a BYOK key for a team.
 */
export async function deleteTeamProviderKey(
	teamDbId: number,
	provider: string,
): Promise<void> {
	await db
		.delete(teamAiProviderKeys)
		.where(
			and(
				eq(teamAiProviderKeys.teamDbId, teamDbId),
				eq(teamAiProviderKeys.provider, provider),
			),
		);
}

/**
 * Decrypt and return the raw API key for a specific team+provider.
 * Returns null if no key is stored or it cannot be decrypted.
 */
export async function getTeamProviderApiKey(
	teamDbId: number,
	provider: string,
): Promise<string | null> {
	const [row] = await db
		.select()
		.from(teamAiProviderKeys)
		.where(
			and(
				eq(teamAiProviderKeys.teamDbId, teamDbId),
				eq(teamAiProviderKeys.provider, provider),
				eq(teamAiProviderKeys.isActive, true),
			),
		)
		.limit(1);

	if (!row) return null;

	try {
		return decryptToken(row.encryptedApiKey);
	} catch {
		return null;
	}
}

/**
 * Resolve an API key for a provider: team key first, then platform process.env fallback.
 * Returns the key string or undefined if neither source has it.
 */
export async function resolveProviderApiKey(
	teamDbId: number,
	provider: string,
): Promise<string | undefined> {
	// Try team BYOK key first
	const teamKey = await getTeamProviderApiKey(teamDbId, provider);
	if (teamKey) return teamKey;

	// Fall back to platform key from process.env
	const envVar = ENV_VAR_MAP[provider as ProviderId];
	if (envVar && process.env[envVar]) {
		return process.env[envVar];
	}

	return undefined;
}

/**
 * Resolve all BYOK keys for a team into a provider->key map.
 * Only includes providers where a team key exists.
 * Falls back to process.env for providers without team keys.
 */
export async function resolveAllProviderApiKeys(
	teamDbId: number,
): Promise<Record<string, string>> {
	const apiKeys: Record<string, string> = {};

	const rows = await db
		.select()
		.from(teamAiProviderKeys)
		.where(
			and(
				eq(teamAiProviderKeys.teamDbId, teamDbId),
				eq(teamAiProviderKeys.isActive, true),
			),
		);

	for (const row of rows) {
		try {
			const decrypted = decryptToken(row.encryptedApiKey);
			apiKeys[row.provider] = decrypted;
		} catch {
			// Skip keys that can't be decrypted
		}
	}

	return apiKeys;
}
