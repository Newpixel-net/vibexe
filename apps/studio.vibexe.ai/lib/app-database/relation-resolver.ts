/**
 * Relation Resolver — Populate related records via JOINs and batch queries.
 *
 * Supports two strategies based on relationType:
 * - many-to-one (FK on current table → parent): LEFT JOIN with row_to_json()
 * - one-to-many (FK on related table → children): Separate batch query
 *
 * Usage: GET /api/apps/{appId}/data/{entity}?include=author,comments
 */

import type { AppSchema, EntityDefinition, EntityField } from "./schema-types";
import { entityToTableName } from "./schema-types";
import { executeQuery } from "./pool-manager";

const MAX_INCLUDES = 5;

export interface IncludeSpec {
	/** The field name on the current entity (e.g., "author") */
	fieldName: string;
	/** The target entity definition */
	targetEntity: EntityDefinition;
	/** many-to-one: FK lives on current table. one-to-many: FK lives on related table. */
	strategy: "many-to-one" | "one-to-many";
	/** For many-to-one: the FK column name on the current table (e.g., "author_id") */
	fkColumn?: string;
	/** For one-to-many: the FK column on the related table pointing back (e.g., "post_id") */
	reverseFkColumn?: string;
	/** JOIN alias index (0, 1, 2...) */
	aliasIndex: number;
}

/**
 * Parse ?include=author,comments and validate against schema.
 * Returns specs for each valid include, or throws on errors.
 */
export function resolveIncludes(
	schema: AppSchema,
	entityName: string,
	includeParam: string,
): IncludeSpec[] {
	const entity = schema.entities.find((e) => e.tableName === entityName);
	if (!entity) return [];

	const requested = includeParam
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);

	if (requested.length > MAX_INCLUDES) {
		throw new IncludeError(
			`Too many includes (${requested.length}). Maximum is ${MAX_INCLUDES}.`,
		);
	}

	const specs: IncludeSpec[] = [];
	let aliasIndex = 0;

	for (const name of requested) {
		// Strategy 1: many-to-one — field on current entity with type "relation" and relationType "many-to-one"
		const manyToOneField = entity.fields.find(
			(f) =>
				f.type === "relation" &&
				f.relationType === "many-to-one" &&
				f.relationTo &&
				fieldMatchesInclude(f, name),
		);

		if (manyToOneField) {
			const targetEntity = schema.entities.find(
				(e) => e.name === manyToOneField.relationTo,
			);
			if (targetEntity) {
				specs.push({
					fieldName: name,
					targetEntity,
					strategy: "many-to-one",
					fkColumn: manyToOneField.name,
					aliasIndex: aliasIndex++,
				});
				continue;
			}
		}

		// Strategy 2: one-to-many — a field on another entity references THIS entity
		const oneToManyMatch = findOneToManyRelation(schema, entity, name);
		if (oneToManyMatch) {
			specs.push({
				fieldName: name,
				targetEntity: oneToManyMatch.targetEntity,
				strategy: "one-to-many",
				reverseFkColumn: oneToManyMatch.fkColumn,
				aliasIndex: aliasIndex++,
			});
			continue;
		}

		// Unknown include name — silently ignore (graceful)
	}

	return specs;
}

/**
 * Check if a relation field matches an include name.
 * - Field name "author_id" matches include "author"
 * - Field name "category_id" matches include "category"
 * - Also matches the relationTo entity name (case-insensitive table name)
 */
export function fieldMatchesInclude(field: EntityField, includeName: string): boolean {
	// Direct match: field name without _id suffix
	if (field.name === `${includeName}_id`) return true;
	if (field.name === includeName) return true;
	// Match against target entity table name
	if (field.relationTo) {
		const targetTable = entityToTableName(field.relationTo);
		if (targetTable === includeName || targetTable === `${includeName}s`) {
			return true;
		}
	}
	return false;
}

/**
 * Find a one-to-many relation: another entity has a FK pointing to `entity`.
 */
function findOneToManyRelation(
	schema: AppSchema,
	entity: EntityDefinition,
	includeName: string,
): { targetEntity: EntityDefinition; fkColumn: string } | null {
	for (const other of schema.entities) {
		if (other.name === entity.name) continue;

		// Check if the other entity's table name matches the include name
		if (other.tableName !== includeName) continue;

		// Find a FK field on the other entity that references our entity
		const fkField = other.fields.find(
			(f) =>
				f.type === "relation" &&
				f.relationTo === entity.name &&
				f.relationType === "many-to-one",
		);

		if (fkField) {
			return { targetEntity: other, fkColumn: fkField.name };
		}
	}

	// Also try: include name might match an entity with a one-to-many field defined on current entity
	const otmField = entity.fields.find(
		(f) =>
			f.type === "relation" &&
			f.relationType === "one-to-many" &&
			f.relationTo,
	);
	if (otmField) {
		const targetEntity = schema.entities.find(
			(e) => e.name === otmField.relationTo,
		);
		if (targetEntity && targetEntity.tableName === includeName) {
			// Find the reverse FK on the target entity
			const reverseFk = targetEntity.fields.find(
				(f) =>
					f.type === "relation" &&
					f.relationTo === entity.name &&
					f.relationType === "many-to-one",
			);
			if (reverseFk) {
				return { targetEntity, fkColumn: reverseFk.name };
			}
		}
	}

	return null;
}

/**
 * Build LEFT JOIN clauses and SELECT expressions for many-to-one includes.
 * Returns { selectExprs, joinClauses }.
 */
export function buildManyToOneJoins(specs: IncludeSpec[]): {
	selectExprs: string[];
	joinClauses: string[];
} {
	const mtoSpecs = specs.filter((s) => s.strategy === "many-to-one");
	const selectExprs: string[] = [];
	const joinClauses: string[] = [];

	for (const spec of mtoSpecs) {
		const alias = `__r${spec.aliasIndex}`;
		const targetTable = spec.targetEntity.tableName;

		selectExprs.push(`row_to_json(${alias}.*) AS "${spec.fieldName}"`);
		joinClauses.push(
			`LEFT JOIN "${targetTable}" ${alias} ON t."${spec.fkColumn}" = ${alias}.id`,
		);
	}

	return { selectExprs, joinClauses };
}

/**
 * Qualify a column name with the table alias when JOINs are active.
 * "status" → t."status"
 */
export function qualifyColumn(column: string): string {
	return `t."${column}"`;
}

/**
 * Qualify a raw WHERE clause by prefixing bare column references with t.
 * Handles patterns like: "field" = $1, "field" ILIKE $2, etc.
 */
export function qualifyWhereClause(clause: string): string {
	// Replace bare "column" references that aren't already prefixed with t.
	// Pattern: starts with " or starts at beginning, matches "column_name"
	return clause.replace(/(?<![.\w])"(\w+)"/g, 't."$1"');
}

/**
 * Batch-fetch one-to-many children for a set of parent IDs.
 * Returns a Map keyed by parent FK value → array of child rows.
 */
export async function fetchOneToMany(
	databaseName: string,
	specs: IncludeSpec[],
	parentIds: number[],
): Promise<Map<string, Map<number, Record<string, unknown>[]>>> {
	const otmSpecs = specs.filter((s) => s.strategy === "one-to-many");
	const results = new Map<
		string,
		Map<number, Record<string, unknown>[]>
	>();

	if (otmSpecs.length === 0 || parentIds.length === 0) return results;

	for (const spec of otmSpecs) {
		const targetTable = spec.targetEntity.tableName;
		const fkCol = spec.reverseFkColumn!;

		const rows = await executeQuery<Record<string, unknown>>(
			databaseName,
			`SELECT * FROM "${targetTable}" WHERE "${fkCol}" = ANY($1::int[])`,
			[parentIds],
		);

		// Group by FK value
		const grouped = new Map<number, Record<string, unknown>[]>();
		for (const row of rows) {
			const fkValue = row[fkCol] as number;
			if (!grouped.has(fkValue)) {
				grouped.set(fkValue, []);
			}
			grouped.get(fkValue)!.push(row);
		}

		results.set(spec.fieldName, grouped);
	}

	return results;
}

/**
 * Attach resolved relations to result rows.
 * - many-to-one: Already in row via row_to_json() alias — parse if string
 * - one-to-many: Merge from otmResults map
 */
export function attachRelations(
	rows: Record<string, unknown>[],
	specs: IncludeSpec[],
	otmResults: Map<string, Map<number, Record<string, unknown>[]>>,
): Record<string, unknown>[] {
	if (specs.length === 0) return rows;

	const otmSpecs = specs.filter((s) => s.strategy === "one-to-many");
	const mtoSpecs = specs.filter((s) => s.strategy === "many-to-one");

	return rows.map((row) => {
		const result = { ...row };

		// many-to-one: row_to_json() result is already in the row under the fieldName key
		// PostgreSQL returns it as a parsed JSON object (via pg driver), but handle string case too
		for (const spec of mtoSpecs) {
			const val = result[spec.fieldName];
			if (typeof val === "string") {
				try {
					result[spec.fieldName] = JSON.parse(val);
				} catch {
					// Leave as-is
				}
			}
			// If the FK is null, row_to_json returns null — that's correct
		}

		// one-to-many: attach children array
		for (const spec of otmSpecs) {
			const grouped = otmResults.get(spec.fieldName);
			const parentId = row.id as number;
			result[spec.fieldName] = grouped?.get(parentId) ?? [];
		}

		return result;
	});
}

/**
 * Custom error class for include validation errors (returns 400).
 */
export class IncludeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "IncludeError";
	}
}

/**
 * Find a one-to-many relation for nested create operations.
 * Given a parent entity and a field name from the request body,
 * returns the target entity and FK column if the field name
 * corresponds to a one-to-many relation.
 *
 * Matches by:
 * - Target entity table name (e.g., "comments" matches Comments entity)
 * - Target entity name (case-insensitive)
 */
export function findOneToManyForCreate(
	schema: AppSchema,
	entity: EntityDefinition,
	fieldName: string,
): { targetEntity: EntityDefinition; fkColumn: string } | null {
	// Try finding another entity whose tableName matches the field name
	// and that has a FK pointing back to us
	for (const other of schema.entities) {
		if (other.name === entity.name) continue;
		if (other.tableName !== fieldName) continue;

		const fkField = other.fields.find(
			(f) =>
				f.type === "relation" &&
				f.relationTo === entity.name &&
				f.relationType === "many-to-one",
		);

		if (fkField) {
			return { targetEntity: other, fkColumn: fkField.name };
		}
	}

	// Also try: an explicit one-to-many field on the current entity
	for (const field of entity.fields) {
		if (
			field.type === "relation" &&
			field.relationType === "one-to-many" &&
			field.relationTo
		) {
			const targetEntity = schema.entities.find(
				(e) => e.name === field.relationTo,
			);
			if (targetEntity && targetEntity.tableName === fieldName) {
				const reverseFk = targetEntity.fields.find(
					(f) =>
						f.type === "relation" &&
						f.relationTo === entity.name &&
						f.relationType === "many-to-one",
				);
				if (reverseFk) {
					return { targetEntity, fkColumn: reverseFk.name };
				}
			}
		}
	}

	return null;
}

/**
 * Check cascade impact before deleting a record.
 * Finds all entities that have FK fields referencing the given entity
 * and counts how many child rows would be affected.
 *
 * Returns a map of entity table names to { count, action }.
 */
export async function checkCascadeImpact(
	databaseName: string,
	schema: AppSchema,
	entity: EntityDefinition,
	recordId: number,
): Promise<Record<string, { count: number; action: string }>> {
	const impact: Record<string, { count: number; action: string }> = {};

	for (const other of schema.entities) {
		if (other.name === entity.name) continue;

		for (const field of other.fields) {
			if (
				field.type === "relation" &&
				field.relationTo === entity.name &&
				field.relationType === "many-to-one"
			) {
				const countResult = await executeQuery<{ count: string }>(
					databaseName,
					`SELECT COUNT(*) as count FROM "${other.tableName}" WHERE "${field.name}" = $1`,
					[recordId],
				);
				const count = Number.parseInt(countResult[0]?.count || "0", 10);
				if (count > 0) {
					const action = field.onDelete ?? "SET NULL";
					impact[other.tableName] = { count, action };
				}
			}
		}
	}

	return impact;
}
