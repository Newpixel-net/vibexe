/**
 * App Database Manager
 *
 * Handles creating and destroying isolated PostgreSQL databases for each app.
 * Each app gets its own database (vibexe_app_{shortId}) completely separated
 * from the platform database.
 *
 * Uses the platform database connection for DDL operations (CREATE/DROP DATABASE).
 */

import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { Pool } from "pg";
import { db } from "@/db";
import { builderAppDatabases } from "@/db/schema";
import { closePool } from "./pool-manager";

/**
 * Get a raw pg.Pool connected to the platform database for DDL operations.
 * DDL commands like CREATE DATABASE cannot run inside transactions,
 * so we need a direct pool (not Drizzle).
 */
function getPlatformPool(): Pool {
	return new Pool({
		connectionString: process.env.POSTGRES_URL ?? "",
		max: 1,
	});
}

/**
 * Create an isolated PostgreSQL database for an app.
 *
 * 1. Generates a unique database name: vibexe_app_{nanoid(8)}
 * 2. Inserts a row into builderAppDatabases with status "provisioning"
 * 3. Runs CREATE DATABASE via the platform connection
 * 4. Creates the _app_meta table inside the new database
 * 5. Updates status to "active"
 *
 * @param appDbId - The builder_apps.db_id (serial integer)
 * @returns The builderAppDatabases row
 */
export async function createAppDatabase(appDbId: number) {
	const shortId = nanoid(8).toLowerCase();
	const databaseName = `vibexe_app_${shortId}`;

	// Insert tracking row
	const [row] = await db
		.insert(builderAppDatabases)
		.values({
			appDbId,
			databaseName,
			status: "provisioning",
		})
		.returning();

	const platformPool = getPlatformPool();

	try {
		// CREATE DATABASE (cannot be in a transaction)
		// Database names are safe — generated from nanoid (alphanumeric only)
		await platformPool.query(`CREATE DATABASE ${databaseName}`);

		// Connect to the new database and create _app_meta table
		const appPool = new Pool({
			connectionString: buildAppConnectionString(databaseName),
			max: 1,
		});

		try {
			await appPool.query(`
				CREATE TABLE IF NOT EXISTS _app_meta (
					key TEXT PRIMARY KEY,
					value JSONB,
					created_at TIMESTAMPTZ DEFAULT NOW()
				)
			`);
			await appPool.query(
				`INSERT INTO _app_meta (key, value) VALUES ('created', $1)`,
				[JSON.stringify({ at: new Date().toISOString(), appDbId })],
			);
		} finally {
			await appPool.end();
		}

		// Mark as active
		await db
			.update(builderAppDatabases)
			.set({ status: "active" })
			.where(eq(builderAppDatabases.dbId, row.dbId));

		return { ...row, status: "active" as const };
	} catch (error) {
		// Clean up: try to drop the orphaned database if it was created
		try {
			const cleanupPool = getPlatformPool();
			try {
				await cleanupPool.query(`DROP DATABASE IF EXISTS ${databaseName}`);
			} finally {
				await cleanupPool.end();
			}
		} catch {
			// Best-effort cleanup — database may not have been created yet
		}

		// Mark as error
		await db
			.update(builderAppDatabases)
			.set({ status: "error" })
			.where(eq(builderAppDatabases.dbId, row.dbId));

		throw new Error(
			`Failed to create database ${databaseName}: ${error instanceof Error ? error.message : String(error)}`,
		);
	} finally {
		await platformPool.end();
	}
}

/**
 * Drop an app's database and remove the tracking row.
 *
 * 1. Close any cached pool for this database
 * 2. Terminate active connections
 * 3. DROP DATABASE
 * 4. Delete the builderAppDatabases row
 */
export async function dropAppDatabase(appDbId: number): Promise<void> {
	const row = await db.query.builderAppDatabases.findFirst({
		where: eq(builderAppDatabases.appDbId, appDbId),
	});

	if (!row) return;

	// Close cached pool first
	await closePool(row.databaseName);

	const platformPool = getPlatformPool();

	try {
		// Terminate any remaining connections to the database
		await platformPool.query(
			`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid != pg_backend_pid()`,
			[row.databaseName],
		);

		// DROP DATABASE
		await platformPool.query(`DROP DATABASE IF EXISTS ${row.databaseName}`);

		// Remove tracking row
		await db
			.delete(builderAppDatabases)
			.where(eq(builderAppDatabases.dbId, row.dbId));
	} finally {
		await platformPool.end();
	}
}

/**
 * Get database info for an app.
 * Returns null if no database has been provisioned.
 */
export async function getAppDatabaseInfo(appDbId: number) {
	return await db.query.builderAppDatabases.findFirst({
		where: eq(builderAppDatabases.appDbId, appDbId),
	});
}

/**
 * Get or create an app database.
 * If the app already has a database, returns it.
 * Otherwise, creates a new one.
 */
export async function ensureAppDatabase(appDbId: number) {
	const existing = await getAppDatabaseInfo(appDbId);
	if (existing && existing.status === "active") {
		return existing;
	}

	// If exists but in error state, try to recreate
	if (existing && existing.status === "error") {
		await db
			.delete(builderAppDatabases)
			.where(eq(builderAppDatabases.dbId, existing.dbId));
	}

	// If exists but still provisioning, return as-is (caller should wait/retry)
	if (existing && existing.status === "provisioning") {
		return existing;
	}

	try {
		return await createAppDatabase(appDbId);
	} catch (error) {
		// Race condition: another request may have created the DB concurrently.
		// Re-check before propagating the error.
		const raceCheck = await getAppDatabaseInfo(appDbId);
		if (raceCheck) return raceCheck;
		throw error;
	}
}

/**
 * Build a connection string for an app database.
 * Reuses host/port/credentials from the platform POSTGRES_URL.
 */
export function buildAppConnectionString(databaseName: string): string {
	const baseUrl = process.env.POSTGRES_URL ?? "";
	try {
		const url = new URL(baseUrl);
		url.pathname = `/${databaseName}`;
		return url.toString();
	} catch {
		const match = baseUrl.match(/^(postgresql:\/\/[^/]+)\//);
		if (match) {
			return `${match[1]}/${databaseName}`;
		}
		throw new Error(
			`Cannot build connection string for ${databaseName}: POSTGRES_URL is not set or invalid`,
		);
	}
}
