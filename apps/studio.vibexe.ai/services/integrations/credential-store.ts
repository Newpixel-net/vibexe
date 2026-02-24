"use server";

import { and, eq } from "drizzle-orm";
import { db, integrationCredentials } from "@/db";
import { decryptToken, encryptToken } from "@/lib/token-encryption";

export interface IntegrationCredential {
	dbId: number;
	teamDbId: number;
	pieceName: string;
	displayName: string;
	authType: string;
	config: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
}

export async function getCredentialsForTeam(
	teamDbId: number,
): Promise<IntegrationCredential[]> {
	const results = await db
		.select()
		.from(integrationCredentials)
		.where(eq(integrationCredentials.teamDbId, teamDbId));

	const credentials: IntegrationCredential[] = [];
	for (const row of results) {
		try {
			credentials.push({
				dbId: row.dbId,
				teamDbId: row.teamDbId,
				pieceName: row.pieceName,
				displayName: row.displayName,
				authType: row.authType,
				config: JSON.parse(decryptToken(row.encryptedConfig)),
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
			});
		} catch {
			console.warn(
				`[credential-store] Skipping credential ${row.dbId} (${row.pieceName}): decrypt failed`,
			);
		}
	}
	return credentials;
}

export async function getCredential(
	teamDbId: number,
	credentialId: number,
): Promise<IntegrationCredential | null> {
	const [result] = await db
		.select()
		.from(integrationCredentials)
		.where(
			and(
				eq(integrationCredentials.dbId, credentialId),
				eq(integrationCredentials.teamDbId, teamDbId),
			),
		);

	if (!result) return null;

	try {
		return {
			dbId: result.dbId,
			teamDbId: result.teamDbId,
			pieceName: result.pieceName,
			displayName: result.displayName,
			authType: result.authType,
			config: JSON.parse(decryptToken(result.encryptedConfig)),
			createdAt: result.createdAt,
			updatedAt: result.updatedAt,
		};
	} catch {
		console.warn(
			`[credential-store] Credential ${result.dbId} (${result.pieceName}): decrypt failed`,
		);
		return null;
	}
}

export async function getCredentialForPiece(
	teamDbId: number,
	pieceName: string,
): Promise<IntegrationCredential | null> {
	const [result] = await db
		.select()
		.from(integrationCredentials)
		.where(
			and(
				eq(integrationCredentials.teamDbId, teamDbId),
				eq(integrationCredentials.pieceName, pieceName),
			),
		);

	if (!result) return null;

	try {
		return {
			dbId: result.dbId,
			teamDbId: result.teamDbId,
			pieceName: result.pieceName,
			displayName: result.displayName,
			authType: result.authType,
			config: JSON.parse(decryptToken(result.encryptedConfig)),
			createdAt: result.createdAt,
			updatedAt: result.updatedAt,
		};
	} catch {
		console.warn(
			`[credential-store] Credential ${result.dbId} (${result.pieceName}): decrypt failed`,
		);
		return null;
	}
}

export async function createCredential(args: {
	teamDbId: number;
	pieceName: string;
	displayName: string;
	authType: string;
	config: Record<string, unknown>;
}): Promise<IntegrationCredential> {
	const encryptedConfig = encryptToken(JSON.stringify(args.config));

	const [result] = await db
		.insert(integrationCredentials)
		.values({
			teamDbId: args.teamDbId,
			pieceName: args.pieceName,
			displayName: args.displayName,
			authType: args.authType,
			encryptedConfig,
		})
		.returning();

	return {
		dbId: result.dbId,
		teamDbId: result.teamDbId,
		pieceName: result.pieceName,
		displayName: result.displayName,
		authType: result.authType,
		config: args.config,
		createdAt: result.createdAt,
		updatedAt: result.updatedAt,
	};
}

export async function updateCredential(args: {
	teamDbId: number;
	credentialId: number;
	displayName?: string;
	config?: Record<string, unknown>;
}): Promise<IntegrationCredential | null> {
	const updates: Record<string, unknown> = {};
	if (args.displayName !== undefined) {
		updates.displayName = args.displayName;
	}
	if (args.config !== undefined) {
		updates.encryptedConfig = encryptToken(JSON.stringify(args.config));
	}

	if (Object.keys(updates).length === 0) return null;

	const [result] = await db
		.update(integrationCredentials)
		.set(updates)
		.where(
			and(
				eq(integrationCredentials.dbId, args.credentialId),
				eq(integrationCredentials.teamDbId, args.teamDbId),
			),
		)
		.returning();

	if (!result) return null;

	return {
		dbId: result.dbId,
		teamDbId: result.teamDbId,
		pieceName: result.pieceName,
		displayName: result.displayName,
		authType: result.authType,
		config: args.config ?? (() => {
			try { return JSON.parse(decryptToken(result.encryptedConfig)); }
			catch { return {}; }
		})(),
		createdAt: result.createdAt,
		updatedAt: result.updatedAt,
	};
}

export async function deleteCredential(
	teamDbId: number,
	credentialId: number,
): Promise<boolean> {
	const result = await db
		.delete(integrationCredentials)
		.where(
			and(
				eq(integrationCredentials.dbId, credentialId),
				eq(integrationCredentials.teamDbId, teamDbId),
			),
		)
		.returning({ dbId: integrationCredentials.dbId });

	return result.length > 0;
}
