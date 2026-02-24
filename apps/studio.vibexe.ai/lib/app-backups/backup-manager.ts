/**
 * Backup Manager for Per-App Databases
 *
 * Handles creating database backups (pg_dump → S3) and restoring them (S3 → pg_restore).
 * Uses the same MinIO/S3 storage infrastructure as per-app file storage.
 *
 * Backup format: pg_dump custom format (-Fc) — compressed, supports parallel restore.
 * Storage path: backups/{databaseName}/{timestamp}.dump
 */

import { execFile } from "node:child_process";
import { unlink, writeFile, readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { eq, and, lt, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { builderAppBackups } from "@/db/schema";
import { buildAppConnectionString } from "@/lib/app-database/manager";

const execFileAsync = promisify(execFile);

// ---- Lazy Singleton S3 Client (same pattern as storage-manager) ----

import { S3Client } from "@aws-sdk/client-s3";

let _client: S3Client | null = null;

function getS3Client(): S3Client {
	if (!_client) {
		const endpoint = process.env.S3_STORAGE_URL;
		const region = process.env.S3_STORAGE_REGION;
		const accessKeyId = process.env.S3_STORAGE_ACCESS_KEY_ID;
		const secretAccessKey = process.env.S3_STORAGE_SECRET_ACCESS_KEY;
		if (!endpoint || !region || !accessKeyId || !secretAccessKey) {
			throw new Error(
				"Missing S3 storage configuration for backups. Set S3_STORAGE_URL, S3_STORAGE_REGION, S3_STORAGE_ACCESS_KEY_ID, S3_STORAGE_SECRET_ACCESS_KEY.",
			);
		}
		_client = new S3Client({
			endpoint,
			region,
			credentials: { accessKeyId, secretAccessKey },
			forcePathStyle: true,
		});
	}
	return _client;
}

function getBucket(): string {
	return process.env.S3_STORAGE_BUCKET ?? "vibexe-storage";
}

/**
 * Parse POSTGRES_URL to extract connection params for pg_dump/pg_restore CLI tools.
 */
function parseConnectionParams(databaseName: string): {
	host: string;
	port: string;
	user: string;
	password: string;
	dbname: string;
} {
	const connStr = buildAppConnectionString(databaseName);
	const url = new URL(connStr);
	return {
		host: url.hostname,
		port: url.port || "5432",
		user: decodeURIComponent(url.username),
		password: decodeURIComponent(url.password),
		dbname: databaseName,
	};
}

/**
 * Create a database backup using pg_dump, upload to S3.
 *
 * Flow:
 * 1. Insert tracking row (status=in_progress)
 * 2. Run pg_dump -Fc (custom format, compressed)
 * 3. Upload dump to S3
 * 4. Update row (status=completed, size, s3Key)
 */
export async function createBackup(opts: {
	appDbId: number;
	databaseName: string;
	environment: string;
	backupType: "scheduled" | "manual" | "pre-deploy" | "pre-promote";
	retentionDays?: number;
}): Promise<{ backupDbId: number; s3Key: string; sizeBytes: number }> {
	const { appDbId, databaseName, environment, backupType, retentionDays = 30 } = opts;
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const s3Key = `backups/${databaseName}/${timestamp}.dump`;
	const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

	// Insert tracking row
	const [row] = await db
		.insert(builderAppBackups)
		.values({
			appDbId,
			environment,
			databaseName,
			backupType,
			s3Key,
			status: "in_progress",
			startedAt: new Date(),
			expiresAt,
		})
		.returning();

	const tmpDir = await mkdtemp(join(tmpdir(), "vibexe-backup-"));
	const dumpFile = join(tmpDir, "dump.pg");

	try {
		const params = parseConnectionParams(databaseName);

		// Run pg_dump with custom format (compressed)
		await execFileAsync("pg_dump", [
			"-Fc",
			"-h", params.host,
			"-p", params.port,
			"-U", params.user,
			"-d", params.dbname,
			"-f", dumpFile,
		], {
			env: { ...process.env, PGPASSWORD: params.password },
			timeout: 120_000, // 2 minutes max
		});

		// Read dump and upload to S3
		const dumpData = await readFile(dumpFile);
		const sizeBytes = dumpData.length;

		await getS3Client().send(
			new PutObjectCommand({
				Bucket: getBucket(),
				Key: s3Key,
				Body: dumpData,
				ContentType: "application/octet-stream",
				Metadata: {
					"backup-type": backupType,
					environment,
					"database-name": databaseName,
				},
			}),
		);

		// Update tracking row
		await db
			.update(builderAppBackups)
			.set({
				status: "completed",
				sizeBytes,
				completedAt: new Date(),
			})
			.where(eq(builderAppBackups.dbId, row.dbId));

		return { backupDbId: row.dbId, s3Key, sizeBytes };
	} catch (error) {
		// Mark as failed
		await db
			.update(builderAppBackups)
			.set({
				status: "failed",
				error: error instanceof Error ? error.message : String(error),
				completedAt: new Date(),
			})
			.where(eq(builderAppBackups.dbId, row.dbId));

		throw error;
	} finally {
		// Cleanup temp file
		try {
			await unlink(dumpFile);
		} catch {}
		try {
			const { rmdir } = await import("node:fs/promises");
			await rmdir(tmpDir);
		} catch {}
	}
}

/**
 * Restore a database from an S3 backup using pg_restore.
 *
 * Flow:
 * 1. Download .dump from S3
 * 2. Terminate active connections to target DB
 * 3. Run pg_restore --clean --if-exists
 * 4. Cleanup temp file
 */
export async function restoreBackup(opts: {
	backupDbId: number;
	targetDatabaseName: string;
}): Promise<void> {
	const { backupDbId, targetDatabaseName } = opts;

	// Get backup record
	const backup = await db.query.builderAppBackups.findFirst({
		where: eq(builderAppBackups.dbId, backupDbId),
	});

	if (!backup) {
		throw new Error(`Backup ${backupDbId} not found`);
	}
	if (backup.status !== "completed") {
		throw new Error(`Backup ${backupDbId} is not in completed state (status: ${backup.status})`);
	}

	const tmpDir = await mkdtemp(join(tmpdir(), "vibexe-restore-"));
	const dumpFile = join(tmpDir, "restore.dump");

	try {
		// Download from S3
		const response = await getS3Client().send(
			new GetObjectCommand({
				Bucket: getBucket(),
				Key: backup.s3Key,
			}),
		);

		if (!response.Body) {
			throw new Error(`S3 object ${backup.s3Key} has no body`);
		}

		// Stream body to file
		const chunks: Buffer[] = [];
		for await (const chunk of response.Body as AsyncIterable<Buffer>) {
			chunks.push(chunk);
		}
		await writeFile(dumpFile, Buffer.concat(chunks));

		const params = parseConnectionParams(targetDatabaseName);

		// Terminate active connections to the target database
		const { Pool } = await import("pg");
		const platformPool = new Pool({
			connectionString: process.env.POSTGRES_URL ?? "",
			max: 1,
		});
		try {
			await platformPool.query(
				`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid != pg_backend_pid()`,
				[targetDatabaseName],
			);
		} finally {
			await platformPool.end();
		}

		// Close any cached pool for this database
		const { closePool } = await import("@/lib/app-database/pool-manager");
		await closePool(targetDatabaseName);

		// Run pg_restore
		await execFileAsync("pg_restore", [
			"--clean",
			"--if-exists",
			"-h", params.host,
			"-p", params.port,
			"-U", params.user,
			"-d", params.dbname,
			dumpFile,
		], {
			env: { ...process.env, PGPASSWORD: params.password },
			timeout: 180_000, // 3 minutes max
		});
	} finally {
		try {
			await unlink(dumpFile);
		} catch {}
		try {
			const { rmdir } = await import("node:fs/promises");
			await rmdir(tmpDir);
		} catch {}
	}
}

/**
 * Delete expired backups from S3 and the database.
 * Returns the number of backups cleaned up.
 */
export async function cleanupExpiredBackups(): Promise<number> {
	const now = new Date();

	const expired = await db
		.select({ dbId: builderAppBackups.dbId, s3Key: builderAppBackups.s3Key })
		.from(builderAppBackups)
		.where(
			and(
				eq(builderAppBackups.status, "completed"),
				isNotNull(builderAppBackups.expiresAt),
				lt(builderAppBackups.expiresAt, now),
			),
		);

	let cleaned = 0;
	for (const backup of expired) {
		try {
			// Delete from S3
			await getS3Client().send(
				new DeleteObjectCommand({
					Bucket: getBucket(),
					Key: backup.s3Key,
				}),
			);

			// Delete DB record
			await db
				.delete(builderAppBackups)
				.where(eq(builderAppBackups.dbId, backup.dbId));

			cleaned++;
		} catch (error) {
			console.error(`[Backup Cleanup] Failed to clean backup ${backup.dbId}:`, error);
		}
	}

	return cleaned;
}

/**
 * Delete a specific backup (S3 + DB record).
 */
export async function deleteBackup(backupDbId: number): Promise<void> {
	const backup = await db.query.builderAppBackups.findFirst({
		where: eq(builderAppBackups.dbId, backupDbId),
	});

	if (!backup) return;

	// Delete from S3
	try {
		await getS3Client().send(
			new DeleteObjectCommand({
				Bucket: getBucket(),
				Key: backup.s3Key,
			}),
		);
	} catch {
		// Best effort — S3 object may already be gone
	}

	// Delete DB record
	await db
		.delete(builderAppBackups)
		.where(eq(builderAppBackups.dbId, backupDbId));
}

/**
 * Get the last backup time for a specific database.
 */
export async function getLastBackupTime(
	appDbId: number,
	environment: string,
): Promise<Date | null> {
	const result = await db.query.builderAppBackups.findFirst({
		where: and(
			eq(builderAppBackups.appDbId, appDbId),
			eq(builderAppBackups.environment, environment),
			eq(builderAppBackups.status, "completed"),
		),
		orderBy: (b, { desc }) => [desc(b.completedAt)],
		columns: { completedAt: true },
	});
	return result?.completedAt ?? null;
}
