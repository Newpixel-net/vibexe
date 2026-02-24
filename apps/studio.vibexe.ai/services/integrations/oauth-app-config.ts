"use server";

import { eq } from "drizzle-orm";
import { db, oauthAppConfigs } from "@/db";
import { decryptToken, encryptToken } from "@/lib/token-encryption";

export interface OAuthAppConfig {
	dbId: number;
	provider: string;
	clientId: string;
	clientSecret: string;
	scopes: string | null;
	extraParams: Record<string, string>;
	enabled: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface OAuthAppConfigMasked {
	dbId: number;
	provider: string;
	clientId: string;
	clientSecretMasked: string;
	scopes: string | null;
	extraParams: Record<string, string>;
	enabled: boolean;
	createdAt: Date;
	updatedAt: Date;
}

function maskSecret(secret: string): string {
	if (secret.length <= 8) return "****";
	return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

function parseExtraParams(raw: string | null): Record<string, string> {
	if (!raw) return {};
	try {
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

/** Get a decrypted OAuth app config for a provider */
export async function getOAuthAppConfig(
	provider: string,
): Promise<OAuthAppConfig | null> {
	const [result] = await db
		.select()
		.from(oauthAppConfigs)
		.where(eq(oauthAppConfigs.provider, provider));

	if (!result) return null;

	return {
		dbId: result.dbId,
		provider: result.provider,
		clientId: result.clientId,
		clientSecret: decryptToken(result.encryptedClientSecret),
		scopes: result.scopes,
		extraParams: parseExtraParams(result.extraParams),
		enabled: result.enabled,
		createdAt: result.createdAt,
		updatedAt: result.updatedAt,
	};
}

/** List all OAuth app configs (secrets masked for UI display) */
export async function getAllOAuthAppConfigs(): Promise<OAuthAppConfigMasked[]> {
	const results = await db.select().from(oauthAppConfigs);

	return results.map((row) => ({
		dbId: row.dbId,
		provider: row.provider,
		clientId: row.clientId,
		clientSecretMasked: maskSecret(decryptToken(row.encryptedClientSecret)),
		scopes: row.scopes,
		extraParams: parseExtraParams(row.extraParams),
		enabled: row.enabled,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	}));
}

/** Create or update an OAuth app config */
export async function upsertOAuthAppConfig(args: {
	provider: string;
	clientId: string;
	clientSecret: string;
	scopes?: string;
	extraParams?: Record<string, string>;
}): Promise<OAuthAppConfig> {
	const encryptedClientSecret = encryptToken(args.clientSecret);
	const extraParamsStr = args.extraParams
		? JSON.stringify(args.extraParams)
		: "{}";

	const [result] = await db
		.insert(oauthAppConfigs)
		.values({
			provider: args.provider,
			clientId: args.clientId,
			encryptedClientSecret,
			scopes: args.scopes ?? null,
			extraParams: extraParamsStr,
		})
		.onConflictDoUpdate({
			target: oauthAppConfigs.provider,
			set: {
				clientId: args.clientId,
				encryptedClientSecret,
				scopes: args.scopes ?? null,
				extraParams: extraParamsStr,
			},
		})
		.returning();

	return {
		dbId: result.dbId,
		provider: result.provider,
		clientId: result.clientId,
		clientSecret: args.clientSecret,
		scopes: result.scopes,
		extraParams: parseExtraParams(result.extraParams),
		enabled: result.enabled,
		createdAt: result.createdAt,
		updatedAt: result.updatedAt,
	};
}

/** Delete an OAuth app config */
export async function deleteOAuthAppConfig(
	provider: string,
): Promise<boolean> {
	const result = await db
		.delete(oauthAppConfigs)
		.where(eq(oauthAppConfigs.provider, provider))
		.returning({ dbId: oauthAppConfigs.dbId });

	return result.length > 0;
}

/** Quick check if OAuth is configured for a provider */
export async function isOAuthConfigured(provider: string): Promise<boolean> {
	const [result] = await db
		.select({ dbId: oauthAppConfigs.dbId })
		.from(oauthAppConfigs)
		.where(eq(oauthAppConfigs.provider, provider));

	return !!result;
}
