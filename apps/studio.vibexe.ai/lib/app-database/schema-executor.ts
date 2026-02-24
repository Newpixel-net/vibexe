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
import type { AppSchema, EntityDefinition, EntityField, SearchFieldConfig } from "./schema-types";
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

		// Apply full-text search vector if entity has text fields
		await applySearchVector(databaseName, entity);
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
	// Fire-and-forget pre-deploy backup before any schema change
	try {
		const { createBackup } = await import("@/lib/app-backups/backup-manager");
		// Look up appDbId from the database record
		const dbRow = await db.query.builderAppDatabases.findFirst({
			where: eq(builderAppDatabases.dbId, appDatabaseDbId),
			columns: { appDbId: true },
		});
		if (dbRow) {
			createBackup({
				appDbId: dbRow.appDbId,
				databaseName,
				environment: "development",
				backupType: "pre-deploy",
			}).catch((err) =>
				console.error(`[Pre-Deploy Backup] Failed for ${databaseName}:`, err),
			);
		}
	} catch (err) {
		console.error("[Pre-Deploy Backup] Setup error:", err);
	}

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

	// Apply/update search vectors for all entities (handles new + changed configs)
	for (const entity of newSchema.entities) {
		await applySearchVector(databaseName, entity);
	}

	// Create auth tables if not yet present
	await createAuthTables(databaseName);

	// Record migration if there were actual changes
	if (newTables.length > 0 || newColumns.length > 0) {
		try {
			const upSqlStatements = generateUpSql(newTables, newColumns, newSchema);
			const downSqlStatements = generateDownSql(newTables, newColumns);
			const description = generateMigrationDescription(newTables, newColumns);

			// Get next version number
			const versionResult = await executeQuery<{ max_version: number | null }>(
				databaseName,
				`SELECT MAX(version) as max_version FROM _app_migrations`,
			).catch(() => [{ max_version: null }]); // Table may not exist yet
			const nextVersion = (versionResult[0]?.max_version ?? 0) + 1;

			await executeQuery(
				databaseName,
				`INSERT INTO _app_migrations (version, description, up_sql, down_sql, schema_before, schema_after)
				 VALUES ($1, $2, $3, $4, $5, $6)`,
				[
					nextVersion,
					description,
					upSqlStatements,
					downSqlStatements,
					JSON.stringify(oldSchema ?? {}),
					JSON.stringify(newSchema),
				],
			).catch((err) => {
				console.error(`[Migration Tracking] Failed to record migration for ${databaseName}:`, err);
			});
		} catch (err) {
			// Non-critical — don't fail the schema apply if migration tracking fails
			console.error("[Migration Tracking] Error:", err);
		}
	}

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
	if (!SAFE_IDENTIFIER.test(entity.tableName)) {
		throw new Error(`Invalid table name: ${entity.tableName}`);
	}
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
/** Safe SQL default values — only allow simple literals and function calls */
const SAFE_DEFAULT = /^(?:'[^']*'|true|false|NULL|NOW\(\)|-?\d+(?:\.\d+)?|\d+|'[^']*'::(?:text|integer|numeric|boolean|jsonb|timestamptz))$/i;

function buildColumnDef(
	field: EntityField,
	allEntities: EntityDefinition[],
): string {
	if (!SAFE_IDENTIFIER.test(field.name)) {
		throw new Error(`Invalid field name: ${field.name}`);
	}
	const sqlType = fieldTypeToSql(field.type);
	const parts = [`"${field.name}" ${sqlType}`];

	if (field.required) {
		parts.push("NOT NULL");
	}

	if (field.unique) {
		parts.push("UNIQUE");
	}

	if (field.defaultValue !== undefined && field.defaultValue !== "") {
		if (!SAFE_DEFAULT.test(field.defaultValue)) {
			throw new Error(`Unsafe default value for field ${field.name}: ${field.defaultValue}`);
		}
		parts.push(`DEFAULT ${field.defaultValue}`);
	}

	// Foreign key for relation fields
	if (field.type === "relation" && field.relationTo) {
		const targetEntity = allEntities.find((e) => e.name === field.relationTo);
		if (targetEntity) {
			const onDelete = field.onDelete ?? "SET NULL";
			parts.push(`REFERENCES "${targetEntity.tableName}"(id) ON DELETE ${onDelete}`);
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

// ─── Full-Text Search Vector Support ────────────────────────────────────────

/** Validate a field name is a safe SQL identifier (letters, digits, underscores) */
const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;
/** Valid PostgreSQL tsvector weights */
const VALID_WEIGHTS = new Set(["A", "B", "C", "D"]);

function validateSearchField(sf: SearchFieldConfig): void {
	if (!SAFE_IDENTIFIER.test(sf.field)) {
		throw new Error(`Invalid search field name: ${sf.field}`);
	}
	if (!VALID_WEIGHTS.has(sf.weight)) {
		throw new Error(`Invalid search weight: ${sf.weight}`);
	}
}

/**
 * Build the tsvector expression for a set of search fields.
 * Uses weighted setweight() for ranked results.
 */
function buildTsvectorExpression(
	searchFields: SearchFieldConfig[],
): string {
	for (const sf of searchFields) {
		validateSearchField(sf);
	}
	const parts = searchFields.map(
		(sf) =>
			`setweight(to_tsvector('english', coalesce(NEW."${sf.field}", '')), '${sf.weight}')`,
	);
	return parts.join(" || ");
}

/**
 * Apply full-text search vector column, trigger, and GIN index to an entity table.
 * If no searchConfig is provided, auto-includes all text fields with weight "D".
 * Idempotent — safe to call multiple times.
 */
export async function applySearchVector(
	databaseName: string,
	entity: EntityDefinition,
): Promise<void> {
	const textFields = entity.fields.filter((f) => f.type === "text");
	if (textFields.length === 0) return; // No text fields — nothing to index

	// Determine search config: explicit or default (all text fields, weight D)
	const searchConfig: SearchFieldConfig[] =
		entity.searchConfig && entity.searchConfig.length > 0
			? entity.searchConfig
			: textFields.map((f) => ({ field: f.name, weight: "D" as const }));

	const tableName = entity.tableName;
	const triggerFnName = `${tableName}_search_update`;

	// 1. Add _search_vector column if not exists
	await executeQuery(
		databaseName,
		`ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS _search_vector TSVECTOR`,
	);

	// 2. Create/replace trigger function (always recreate to pick up field changes)
	const tsvecExpr = buildTsvectorExpression(searchConfig);
	await executeQuery(
		databaseName,
		`CREATE OR REPLACE FUNCTION "${triggerFnName}"() RETURNS trigger AS $$
BEGIN
  NEW._search_vector := ${tsvecExpr};
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
	);

	// 3. Create trigger (drop first to handle field changes)
	await executeQuery(
		databaseName,
		`DROP TRIGGER IF EXISTS "${triggerFnName}_trg" ON "${tableName}"`,
	);
	await executeQuery(
		databaseName,
		`CREATE TRIGGER "${triggerFnName}_trg" BEFORE INSERT OR UPDATE ON "${tableName}" FOR EACH ROW EXECUTE FUNCTION "${triggerFnName}"()`,
	);

	// 4. Create GIN index if not exists
	await executeQuery(
		databaseName,
		`CREATE INDEX IF NOT EXISTS "${tableName}_search_idx" ON "${tableName}" USING GIN(_search_vector)`,
	);

	// 5. Backfill existing rows that have NULL _search_vector
	for (const sf of searchConfig) {
		validateSearchField(sf);
	}
	const backfillExpr = searchConfig
		.map(
			(sf) =>
				`setweight(to_tsvector('english', coalesce("${sf.field}", '')), '${sf.weight}')`,
		)
		.join(" || ");
	await executeQuery(
		databaseName,
		`UPDATE "${tableName}" SET _search_vector = ${backfillExpr} WHERE _search_vector IS NULL`,
	);
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
			password_hash TEXT,
			display_name TEXT,
			role TEXT NOT NULL DEFAULT 'user',
			email_verified BOOLEAN NOT NULL DEFAULT false,
			status TEXT NOT NULL DEFAULT 'active',
			last_login_at TIMESTAMPTZ,
			auth_provider TEXT,
			provider_user_id TEXT,
			avatar_url TEXT,
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
	// Make password_hash nullable for OAuth-only users
	await executeQuery(
		databaseName,
		`ALTER TABLE _app_users ALTER COLUMN password_hash DROP NOT NULL`,
	);
	// OAuth columns
	await executeQuery(
		databaseName,
		`ALTER TABLE _app_users ADD COLUMN IF NOT EXISTS auth_provider TEXT`,
	);
	await executeQuery(
		databaseName,
		`ALTER TABLE _app_users ADD COLUMN IF NOT EXISTS provider_user_id TEXT`,
	);
	await executeQuery(
		databaseName,
		`ALTER TABLE _app_users ADD COLUMN IF NOT EXISTS avatar_url TEXT`,
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

	// Background jobs tables for scheduled task management
	await executeQuery(
		databaseName,
		`CREATE TABLE IF NOT EXISTS _app_scheduled_jobs (
			id SERIAL PRIMARY KEY,
			name TEXT NOT NULL UNIQUE,
			description TEXT DEFAULT '',
			function_name TEXT NOT NULL,
			cron_expression TEXT NOT NULL,
			timezone TEXT DEFAULT 'UTC',
			enabled BOOLEAN DEFAULT true,
			retry_policy JSONB DEFAULT '{"maxRetries":3,"initialDelayMs":5000,"maxDelayMs":300000,"backoffMultiplier":2}',
			timeout_ms INTEGER DEFAULT 30000,
			last_run_at TIMESTAMPTZ,
			next_run_at TIMESTAMPTZ,
			run_count INTEGER DEFAULT 0,
			error_count INTEGER DEFAULT 0,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
	);

	await executeQuery(
		databaseName,
		`CREATE TABLE IF NOT EXISTS _app_job_runs (
			id SERIAL PRIMARY KEY,
			job_id INTEGER REFERENCES _app_scheduled_jobs(id) ON DELETE CASCADE,
			status TEXT NOT NULL DEFAULT 'pending',
			started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			completed_at TIMESTAMPTZ,
			duration_ms INTEGER,
			result JSONB,
			error TEXT,
			logs TEXT,
			attempt INTEGER DEFAULT 1,
			manual BOOLEAN DEFAULT false,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
	);

	await executeQuery(
		databaseName,
		`CREATE INDEX IF NOT EXISTS idx_job_runs_job_id ON _app_job_runs(job_id)`,
	);

	await executeQuery(
		databaseName,
		`CREATE INDEX IF NOT EXISTS idx_job_runs_status ON _app_job_runs(status)`,
	);

	await executeQuery(
		databaseName,
		`CREATE TABLE IF NOT EXISTS _app_job_dlq (
			id SERIAL PRIMARY KEY,
			job_id INTEGER REFERENCES _app_scheduled_jobs(id) ON DELETE SET NULL,
			job_name TEXT NOT NULL,
			error TEXT NOT NULL,
			last_attempt_at TIMESTAMPTZ NOT NULL,
			attempts INTEGER NOT NULL,
			payload JSONB,
			acknowledged BOOLEAN DEFAULT false,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
	);

	// Schema migration history table
	await executeQuery(
		databaseName,
		`CREATE TABLE IF NOT EXISTS _app_migrations (
			id SERIAL PRIMARY KEY,
			version INTEGER NOT NULL,
			description TEXT NOT NULL,
			up_sql TEXT NOT NULL,
			down_sql TEXT,
			schema_before JSONB,
			schema_after JSONB NOT NULL,
			applied_at TIMESTAMPTZ DEFAULT NOW(),
			rolled_back_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
	);
}

// ─── Migration Tracking Helpers ──────────────────────────────────────────────

/**
 * Generate the up SQL (forward migration) from the changes detected.
 */
function generateUpSql(
	newTables: string[],
	newColumns: string[],
	schema: AppSchema,
): string {
	const statements: string[] = [];
	const entityMap = new Map(schema.entities.map((e) => [e.tableName, e]));

	for (const tableName of newTables) {
		const entity = entityMap.get(tableName);
		if (entity) {
			statements.push(buildCreateTableSql(entity, schema.entities));
		}
	}

	for (const col of newColumns) {
		const [tableName, fieldName] = col.split(".");
		const entity = entityMap.get(tableName);
		const field = entity?.fields.find((f) => f.name === fieldName);
		if (entity && field) {
			statements.push(buildAddColumnSql(tableName, field, schema.entities));
		}
	}

	return statements.join(";\n");
}

/**
 * Generate the down SQL (reverse migration) to undo the changes.
 */
function generateDownSql(
	newTables: string[],
	newColumns: string[],
): string {
	const statements: string[] = [];

	// Reverse order: drop columns first, then tables
	for (const col of newColumns) {
		const [tableName, fieldName] = col.split(".");
		if (SAFE_IDENTIFIER.test(tableName) && SAFE_IDENTIFIER.test(fieldName)) {
			statements.push(`ALTER TABLE "${tableName}" DROP COLUMN IF EXISTS "${fieldName}"`);
		}
	}

	for (const tableName of newTables) {
		if (SAFE_IDENTIFIER.test(tableName)) {
			statements.push(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
		}
	}

	return statements.join(";\n");
}

/**
 * Generate a human-readable migration description.
 */
function generateMigrationDescription(
	newTables: string[],
	newColumns: string[],
): string {
	const parts: string[] = [];
	if (newTables.length > 0) {
		parts.push(`Added ${newTables.length === 1 ? "table" : "tables"}: ${newTables.join(", ")}`);
	}
	if (newColumns.length > 0) {
		parts.push(`Added ${newColumns.length === 1 ? "column" : "columns"}: ${newColumns.join(", ")}`);
	}
	return parts.join("; ") || "No changes";
}

/**
 * Rollback a specific migration by executing its down_sql.
 *
 * @param databaseName - The app database name
 * @param migrationId - The _app_migrations.id to rollback
 */
export async function rollbackMigration(
	databaseName: string,
	migrationId: number,
): Promise<{ version: number; description: string }> {
	// Load migration record
	const rows = await executeQuery<{
		id: number;
		version: number;
		description: string;
		down_sql: string | null;
		schema_before: unknown;
		rolled_back_at: string | null;
	}>(
		databaseName,
		`SELECT id, version, description, down_sql, schema_before, rolled_back_at
		 FROM _app_migrations WHERE id = $1`,
		[migrationId],
	);

	if (rows.length === 0) {
		throw new Error(`Migration ${migrationId} not found`);
	}

	const migration = rows[0];
	if (migration.rolled_back_at) {
		throw new Error(`Migration ${migrationId} has already been rolled back`);
	}
	if (!migration.down_sql) {
		throw new Error(`Migration ${migrationId} has no down_sql — cannot rollback`);
	}

	// Execute each down_sql statement
	const statements = migration.down_sql.split(";\n").filter((s) => s.trim());
	for (const stmt of statements) {
		await executeQuery(databaseName, stmt);
	}

	// Mark as rolled back
	await executeQuery(
		databaseName,
		`UPDATE _app_migrations SET rolled_back_at = NOW() WHERE id = $1`,
		[migrationId],
	);

	return { version: migration.version, description: migration.description };
}
