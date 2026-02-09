import type { DatabaseConfig } from "@giselles-ai/rag";

/**
 * Create database configuration for PostgreSQL connection.
 * Uses a lazy getter to avoid throwing at module evaluation time (which breaks Next.js builds).
 */
export function createDatabaseConfig(): DatabaseConfig {
	return {
		get connectionString() {
			const postgresUrl = process.env.POSTGRES_URL;
			if (!postgresUrl) {
				throw new Error("POSTGRES_URL environment variable is required");
			}
			return postgresUrl;
		},
	};
}
