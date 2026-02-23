/**
 * Connection Pool Manager for Per-App Databases
 *
 * LRU-cached pool manager that maintains pg.Pool instances for app databases.
 * Designed for a shared server with ~4GB RAM:
 * - Max 20 active pools
 * - 2 connections per pool
 * - LRU eviction of least-recently-used pools
 */

import { Pool } from "pg";

interface PoolEntry {
	pool: Pool;
	lastAccessed: number;
}

const MAX_POOLS = 20;
const CONNECTIONS_PER_POOL = 2;
const IDLE_TIMEOUT_MS = 30_000; // 30 seconds
const STATEMENT_TIMEOUT_MS = 30_000; // 30 seconds — prevents runaway queries from blocking the pool

/** Map of database name → pool entry */
const pools = new Map<string, PoolEntry>();

/**
 * Build a connection string for an app database.
 * Uses the same host/port/credentials as the platform database.
 */
function buildConnectionString(databaseName: string): string {
	const baseUrl = process.env.POSTGRES_URL ?? "";
	// Parse platform URL to extract host, port, user, password
	try {
		const url = new URL(baseUrl);
		url.pathname = `/${databaseName}`;
		return url.toString();
	} catch {
		// Fallback: replace database name in connection string
		const match = baseUrl.match(/^(postgresql:\/\/[^/]+)\//);
		if (match) {
			return `${match[1]}/${databaseName}`;
		}
		throw new Error(
			`Cannot build connection string for ${databaseName}: POSTGRES_URL is not set or invalid`,
		);
	}
}

/**
 * Evict the least-recently-used pool if at capacity.
 */
async function evictIfNeeded(): Promise<void> {
	if (pools.size < MAX_POOLS) return;

	let oldestKey: string | null = null;
	let oldestTime = Number.POSITIVE_INFINITY;

	for (const [key, entry] of pools) {
		if (entry.lastAccessed < oldestTime) {
			oldestTime = entry.lastAccessed;
			oldestKey = key;
		}
	}

	if (oldestKey) {
		const entry = pools.get(oldestKey);
		pools.delete(oldestKey);
		if (entry) {
			try {
				await entry.pool.end();
			} catch {
				// Ignore close errors during eviction
			}
		}
	}
}

/**
 * Get or create a connection pool for the given app database.
 */
export async function getAppPool(databaseName: string): Promise<Pool> {
	const existing = pools.get(databaseName);
	if (existing) {
		existing.lastAccessed = Date.now();
		return existing.pool;
	}

	await evictIfNeeded();

	const pool = new Pool({
		connectionString: buildConnectionString(databaseName),
		max: CONNECTIONS_PER_POOL,
		idleTimeoutMillis: IDLE_TIMEOUT_MS,
		statement_timeout: STATEMENT_TIMEOUT_MS,
	});

	pools.set(databaseName, {
		pool,
		lastAccessed: Date.now(),
	});

	return pool;
}

/**
 * Execute a parameterized SQL query against an app database.
 * Handles pool acquisition automatically.
 */
export async function executeQuery<T extends Record<string, unknown> = Record<string, unknown>>(
	databaseName: string,
	sql: string,
	params: unknown[] = [],
): Promise<T[]> {
	const pool = await getAppPool(databaseName);
	const result = await pool.query(sql, params);
	return result.rows as T[];
}

/**
 * Close a specific app's pool (e.g., when deleting the app database).
 */
export async function closePool(databaseName: string): Promise<void> {
	const entry = pools.get(databaseName);
	if (entry) {
		pools.delete(databaseName);
		try {
			await entry.pool.end();
		} catch {
			// Pool may already be closed or connections in use — ignore
		}
	}
}

/**
 * Close all pools. Call during graceful shutdown.
 */
export async function closeAllPools(): Promise<void> {
	const closePromises: Promise<void>[] = [];
	for (const [key, entry] of pools) {
		pools.delete(key);
		closePromises.push(entry.pool.end());
	}
	await Promise.allSettled(closePromises);
}

/**
 * Get current pool stats for monitoring.
 */
export function getPoolStats(): {
	activeCount: number;
	maxPools: number;
	databases: string[];
} {
	return {
		activeCount: pools.size,
		maxPools: MAX_POOLS,
		databases: Array.from(pools.keys()),
	};
}
