/**
 * Schema Executor for Per-App Databases
 *
 * Takes an AppSchema definition and creates/alters real PostgreSQL tables
 * inside an app's isolated database.
 *
 * Every entity auto-gets: id SERIAL PRIMARY KEY, created_at, updated_at.
 * Relation fields become INTEGER columns with FOREIGN KEY constraints.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { builderAppDatabases } from "@/db/schema";
import { executeQuery } from "./pool-manager";
import type { AppSchema, EntityDefinition, EntityField } from "./schema-types";
import { fieldTypeToSql } from "./schema-types";

/**
 * Apply an AppSchema to an app database.
 * Creates all entity tables + auth tables if they don't exist.
 * Stores the schema in builderAppDatabases.schema_json.
 *
 * @param databaseName - The app database name (vibexe_app_xxx)
 * @param schema - The entity definitions
 * @param appDatabaseDbId - The builderAppDatabases.dbId for updating schema_json
 */
export async function applySchema(
	databaseName: string,
	schema: AppSchema,
	appDatabaseDbId: number,
): Promise<void> {
	// Create entity tables
	for (const entity of schema.entities) {
		const createSql = buildCreateTableSql(entity, schema.entities);
		await executeQuery(databaseName, createSql);
	}

	// Create app-level auth tables (always present)
	await createAuthTables(databaseName);

	// Store schema in platform database
	await db
		.update(builderAppDatabases)
		.set({ schemaJson: schema })
		.where(eq(builderAppDatabases.dbId, appDatabaseDbId));
}

/**
 * Diff two schemas and apply only the additions.
 * Never drops columns or tables — only adds.
 *
 * @param databaseName - The app database name
 * @param oldSchema - Previous schema (from builderAppDatabases.schema_json)
 * @param newSchema - New schema to apply
 * @param appDatabaseDbId - For updating schema_json
 */
export async function diffAndApplySchema(
	databaseName: string,
	oldSchema: AppSchema | null,
	newSchema: AppSchema,
	appDatabaseDbId: number,
): Promise<{ newTables: string[]; newColumns: string[] }> {
	const oldEntities = new Map(
		(oldSchema?.entities ?? []).map((e) => [e.tableName, e]),
	);
	const newTables: string[] = [];
	const newColumns: string[] = [];

	for (const entity of newSchema.entities) {
		const existing = oldEntities.get(entity.tableName);

		if (!existing) {
			// Entirely new table
			const sql = buildCreateTableSql(entity, newSchema.entities);
			await executeQuery(databaseName, sql);
			newTables.push(entity.tableName);
		} else {
			// Check for new columns
			const existingFieldNames = new Set(existing.fields.map((f) => f.name));
			for (const field of entity.fields) {
				if (!existingFieldNames.has(field.name)) {
					const alterSql = buildAddColumnSql(entity.tableName, field, newSchema.entities);
					await executeQuery(databaseName, alterSql);
					newColumns.push(`${entity.tableName}.${field.name}`);
				}
			}
		}
	}

	// Create auth tables if not yet present
	await createAuthTables(databaseName);

	// Update stored schema
	await db
		.update(builderAppDatabases)
		.set({ schemaJson: newSchema })
		.where(eq(builderAppDatabases.dbId, appDatabaseDbId));

	return { newTables, newColumns };
}

/**
 * Build a CREATE TABLE IF NOT EXISTS statement for an entity.
 */
function buildCreateTableSql(
	entity: EntityDefinition,
	allEntities: EntityDefinition[],
): string {
	const columns: string[] = [
		"id SERIAL PRIMARY KEY",
	];

	for (const field of entity.fields) {
		columns.push(buildColumnDef(field, allEntities));
	}

	// Auto-add timestamps
	columns.push("created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()");
	columns.push("updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()");

	return `CREATE TABLE IF NOT EXISTS "${entity.tableName}" (\n  ${columns.join(",\n  ")}\n)`;
}

/**
 * Build a column definition string for a single field.
 */
function buildColumnDef(
	field: EntityField,
	allEntities: EntityDefinition[],
): string {
	const sqlType = fieldTypeToSql(field.type);
	const parts = [`"${field.name}" ${sqlType}`];

	if (field.required) {
		parts.push("NOT NULL");
	}

	if (field.unique) {
		parts.push("UNIQUE");
	}

	if (field.defaultValue !== undefined && field.defaultValue !== "") {
		parts.push(`DEFAULT ${field.defaultValue}`);
	}

	// Foreign key for relation fields
	if (field.type === "relation" && field.relationTo) {
		const targetEntity = allEntities.find((e) => e.name === field.relationTo);
		if (targetEntity) {
			parts.push(`REFERENCES "${targetEntity.tableName}"(id) ON DELETE SET NULL`);
		}
	}

	return parts.join(" ");
}

/**
 * Build an ALTER TABLE ADD COLUMN statement.
 */
function buildAddColumnSql(
	tableName: string,
	field: EntityField,
	allEntities: EntityDefinition[],
): string {
	const colDef = buildColumnDef(field, allEntities);
	return `ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS ${colDef}`;
}

/**
 * Create the built-in auth tables inside an app database.
 * These exist in every app database for end-user authentication.
 */
async function createAuthTables(databaseName: string): Promise<void> {
	await executeQuery(
		databaseName,
		`CREATE TABLE IF NOT EXISTS _app_users (
			id SERIAL PRIMARY KEY,
			email TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			display_name TEXT,
			role TEXT NOT NULL DEFAULT 'user',
			email_verified BOOLEAN NOT NULL DEFAULT false,
			status TEXT NOT NULL DEFAULT 'active',
			last_login_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
	);

	// Add columns for existing app databases that were created before these columns existed
	await executeQuery(
		databaseName,
		`ALTER TABLE _app_users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`,
	);
	await executeQuery(
		databaseName,
		`ALTER TABLE _app_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`,
	);

	await executeQuery(
		databaseName,
		`CREATE TABLE IF NOT EXISTS _app_sessions (
			id TEXT PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES _app_users(id) ON DELETE CASCADE,
			expires_at TIMESTAMPTZ NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
	);

	// Analytics tables for visitor tracking
	await executeQuery(
		databaseName,
		`CREATE TABLE IF NOT EXISTS _app_analytics_sessions (
			id TEXT PRIMARY KEY,
			visitor_id TEXT NOT NULL,
			user_id INTEGER REFERENCES _app_users(id),
			started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			user_agent TEXT,
			referrer TEXT,
			country TEXT
		)`,
	);

	await executeQuery(
		databaseName,
		`CREATE INDEX IF NOT EXISTS _app_analytics_sessions_started_idx ON _app_analytics_sessions(started_at)`,
	);

	await executeQuery(
		databaseName,
		`CREATE TABLE IF NOT EXISTS _app_analytics_events (
			id SERIAL PRIMARY KEY,
			session_id TEXT REFERENCES _app_analytics_sessions(id),
			event_type TEXT NOT NULL,
			page_path TEXT,
			metadata JSONB DEFAULT '{}',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
	);

	await executeQuery(
		databaseName,
		`CREATE INDEX IF NOT EXISTS _app_analytics_events_created_idx ON _app_analytics_events(created_at)`,
	);

	await executeQuery(
		databaseName,
		`CREATE INDEX IF NOT EXISTS _app_analytics_events_type_idx ON _app_analytics_events(event_type)`,
	);

	// Logs table for runtime event tracking
	await executeQuery(
		databaseName,
		`CREATE TABLE IF NOT EXISTS _app_logs (
			id SERIAL PRIMARY KEY,
			level TEXT NOT NULL DEFAULT 'info',
			category TEXT NOT NULL,
			event_type TEXT NOT NULL,
			message TEXT NOT NULL,
			user_id INTEGER,
			user_email TEXT,
			metadata JSONB DEFAULT '{}',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
	);

	await executeQuery(
		databaseName,
		`CREATE INDEX IF NOT EXISTS _app_logs_created_idx ON _app_logs(created_at)`,
	);

	await executeQuery(
		databaseName,
		`CREATE INDEX IF NOT EXISTS _app_logs_level_idx ON _app_logs(level)`,
	);
}
