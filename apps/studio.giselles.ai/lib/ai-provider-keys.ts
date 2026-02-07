import { eq } from "drizzle-orm";
import { db } from "@/db";
import { aiProviderKeys } from "@/db/schema";
import { decryptToken, encryptToken } from "@/lib/token-encryption";

export const AI_PROVIDERS = [
	{
		id: "anthropic",
		name: "Anthropic (Claude)",
		envVar: "ANTHROPIC_API_KEY",
		placeholder: "sk-ant-...",
		description: "Powers Claude models for high-quality code and text generation",
	},
	{
		id: "openai",
		name: "OpenAI",
		envVar: "OPENAI_API_KEY",
		placeholder: "sk-...",
		description: "Powers GPT models and DALL-E image generation",
	},
	{
		id: "google",
		name: "Google AI",
		envVar: "GOOGLE_GENERATIVE_AI_API_KEY",
		placeholder: "AIza...",
		description: "Powers Gemini models",
	},
	{
		id: "perplexity",
		name: "Perplexity",
		envVar: "PERPLEXITY_API_KEY",
		placeholder: "pplx-...",
		description: "AI-powered search and research",
	},
] as const;

export type ProviderId = (typeof AI_PROVIDERS)[number]["id"];

const ENV_VAR_MAP: Record<ProviderId, string> = {
	anthropic: "ANTHROPIC_API_KEY",
	openai: "OPENAI_API_KEY",
	google: "GOOGLE_GENERATIVE_AI_API_KEY",
	perplexity: "PERPLEXITY_API_KEY",
};

export function redactKey(key: string): string {
	if (key.length <= 8) return `${key.slice(0, 3)}...`;
	return `${key.slice(0, 7)}...${key.slice(-4)}`;
}

export type ProviderKeyInfo = {
	provider: ProviderId;
	isActive: boolean;
	maskedKey: string;
	updatedAt: Date;
};

export async function getProviderKeys(): Promise<ProviderKeyInfo[]> {
	const rows = await db.select().from(aiProviderKeys);
	return rows.map((row) => {
		const decrypted = decryptToken(row.encryptedApiKey);
		return {
			provider: row.provider as ProviderId,
			isActive: row.isActive,
			maskedKey: redactKey(decrypted),
			updatedAt: row.updatedAt,
		};
	});
}

export async function upsertProviderKey(
	provider: string,
	apiKey: string,
): Promise<void> {
	const encrypted = encryptToken(apiKey);
	const envVar = ENV_VAR_MAP[provider as ProviderId];
	if (!envVar) throw new Error(`Unknown provider: ${provider}`);

	await db
		.insert(aiProviderKeys)
		.values({
			provider,
			encryptedApiKey: encrypted,
			isActive: true,
		})
		.onConflictDoUpdate({
			target: aiProviderKeys.provider,
			set: {
				encryptedApiKey: encrypted,
				isActive: true,
				updatedAt: new Date(),
			},
		});

	// Set into process.env so the AI SDK picks it up immediately
	process.env[envVar] = apiKey;
}

export async function deleteProviderKey(provider: string): Promise<void> {
	const envVar = ENV_VAR_MAP[provider as ProviderId];
	if (!envVar) throw new Error(`Unknown provider: ${provider}`);

	await db
		.delete(aiProviderKeys)
		.where(eq(aiProviderKeys.provider, provider));

	delete process.env[envVar];
}

export async function loadProviderKeysIntoEnv(): Promise<void> {
	try {
		const rows = await db
			.select()
			.from(aiProviderKeys)
			.where(eq(aiProviderKeys.isActive, true));

		for (const row of rows) {
			const envVar = ENV_VAR_MAP[row.provider as ProviderId];
			if (!envVar) continue;

			// Only load from DB if not already set via .env file
			if (!process.env[envVar]) {
				const decrypted = decryptToken(row.encryptedApiKey);
				process.env[envVar] = decrypted;
			}
		}
		console.log(
			`[ai-provider-keys] Loaded ${rows.length} provider key(s) from database`,
		);
	} catch (error) {
		console.error("[ai-provider-keys] Failed to load provider keys:", error);
	}
}
