/**
 * Schema Types for Per-App Databases
 *
 * Defines the structure of entity definitions that get translated
 * into PostgreSQL tables inside each app's isolated database.
 */

export interface EntityField {
	/** Column name (snake_case recommended) */
	name: string;
	/** Data type mapped to PostgreSQL types */
	type: "text" | "number" | "boolean" | "date" | "json" | "relation";
	/** Whether the field is required (NOT NULL) */
	required?: boolean;
	/** Whether the field must be unique */
	unique?: boolean;
	/** Default value as SQL expression string */
	defaultValue?: string;
	/** For relation fields: the entity name this references */
	relationTo?: string;
	/** For relation fields: relationship type */
	relationType?: "one-to-many" | "many-to-one";
	/** For relation fields: FK delete behavior (default: "SET NULL") */
	onDelete?: "CASCADE" | "SET NULL" | "RESTRICT";
}

/** Configuration for a single field in full-text search */
export interface SearchFieldConfig {
	/** Field name (must be a text field in the entity) */
	field: string;
	/** PostgreSQL ts_rank weight: A (highest) through D (lowest) */
	weight: "A" | "B" | "C" | "D";
}

export interface EntityDefinition {
	/** Display name (PascalCase, e.g., "Course", "UserProgress") */
	name: string;
	/** PostgreSQL table name (auto-generated snake_case, e.g., "courses", "user_progress") */
	tableName: string;
	/** Entity fields (id, created_at, updated_at are auto-added) */
	fields: EntityField[];
	/** Full-text search configuration — which fields to index and their weights */
	searchConfig?: SearchFieldConfig[];
}

export interface AppSchema {
	/** Schema version (increments on each change) */
	version: number;
	/** All entity definitions for this app */
	entities: EntityDefinition[];
}

/**
 * Map entity field types to PostgreSQL column types.
 */
export function fieldTypeToSql(type: EntityField["type"]): string {
	switch (type) {
		case "text":
			return "TEXT";
		case "number":
			return "NUMERIC";
		case "boolean":
			return "BOOLEAN";
		case "date":
			return "TIMESTAMPTZ";
		case "json":
			return "JSONB";
		case "relation":
			return "INTEGER";
		default:
			return "TEXT";
	}
}

/**
 * Convert PascalCase or camelCase to snake_case for table names.
 */
export function toSnakeCase(name: string): string {
	return name
		.replace(/([A-Z])/g, "_$1")
		.toLowerCase()
		.replace(/^_/, "");
}

/**
 * Pluralize a snake_case name for table naming.
 * Simple heuristic: add "s" unless already ends in "s".
 */
export function pluralize(name: string): string {
	if (name.endsWith("s")) return name;
	if (name.endsWith("y") && !name.endsWith("ay") && !name.endsWith("ey") && !name.endsWith("oy") && !name.endsWith("uy")) {
		return `${name.slice(0, -1)}ies`;
	}
	return `${name}s`;
}

/**
 * Generate a table name from an entity name.
 * "Course" → "courses", "UserProgress" → "user_progresses"
 */
export function entityToTableName(entityName: string): string {
	return pluralize(toSnakeCase(entityName));
}
