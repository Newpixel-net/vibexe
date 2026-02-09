import type { DatabaseConfig } from "@giselles-ai/rag";

/**
 * Create database configuration for PostgreSQL connection.
 * Returns empty connectionString when POSTGRES_URL is not set to avoid
 * breaking Next.js builds. Vector store features will fail at runtime
 * if the env var is missing.
 */
export function createDatabaseConfig(): DatabaseConfig {
	return { connectionString: process.env.POSTGRES_URL ?? "" };
}
