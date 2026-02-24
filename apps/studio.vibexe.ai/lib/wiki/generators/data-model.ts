/**
 * DATA-MODEL.md Generator
 *
 * Generates entity documentation with field tables and a Mermaid ER diagram
 * from the app's schema definition (stored in builder_app_databases.schemaJson).
 */

import type { AppSchema, EntityDefinition, EntityField } from "@/lib/app-database/schema-types";

/**
 * Generate DATA-MODEL.md content from an AppSchema.
 */
export function generateDataModel(schema: AppSchema | null): string {
	if (!schema || !schema.entities || schema.entities.length === 0) {
		return `# Data Model

> No entities defined yet. Entities will appear here after the AI defines your data model.
`;
	}

	const lines: string[] = [];
	lines.push("# Data Model");
	lines.push("");
	lines.push(`> Schema version ${schema.version} \u00B7 ${schema.entities.length} entit${schema.entities.length === 1 ? "y" : "ies"}`);
	lines.push("");

	// --- Entity tables ---
	for (const entity of schema.entities) {
		lines.push(`## ${entity.name} (\`${entity.tableName}\`)`);
		lines.push("");
		lines.push("| Field | Type | Required | Description |");
		lines.push("|-------|------|----------|-------------|");
		lines.push("| id | serial | yes | Auto-generated primary key |");
		lines.push("| created_at | timestamptz | yes | Row creation timestamp |");
		lines.push("| updated_at | timestamptz | yes | Last update timestamp |");

		for (const field of entity.fields) {
			const req = field.required ? "yes" : "no";
			const desc = buildFieldDescription(field);
			lines.push(`| ${field.name} | ${field.type} | ${req} | ${desc} |`);
		}
		lines.push("");
	}

	// --- Relationships ---
	const relations = extractRelations(schema.entities);
	if (relations.length > 0) {
		lines.push("## Relationships");
		lines.push("");
		for (const rel of relations) {
			const cascade = rel.onDelete ? ` (onDelete: ${rel.onDelete})` : "";
			lines.push(`- **${rel.from}** \u2192 **${rel.to}** via \`${rel.field}\`${cascade}`);
		}
		lines.push("");
	}

	// --- Mermaid ER Diagram ---
	lines.push("## ER Diagram");
	lines.push("");
	lines.push("```mermaid");
	lines.push("erDiagram");

	for (const entity of schema.entities) {
		lines.push(`    ${entity.name} {`);
		lines.push("        int id PK");
		for (const field of entity.fields) {
			if (field.type === "relation") continue;
			const mermaidType = fieldToMermaidType(field.type);
			const constraint = field.unique ? "UK" : field.required ? "" : "";
			lines.push(`        ${mermaidType} ${field.name}${constraint ? ` ${constraint}` : ""}`);
		}
		lines.push("        timestamptz created_at");
		lines.push("        timestamptz updated_at");
		lines.push("    }");
	}

	// Relationship lines
	for (const rel of relations) {
		lines.push(`    ${rel.from} ||--o{ ${rel.to} : "${rel.field}"`);
	}

	lines.push("```");
	lines.push("");

	return lines.join("\n");
}

function buildFieldDescription(field: EntityField): string {
	const parts: string[] = [];
	if (field.type === "relation" && field.relationTo) {
		parts.push(`FK \u2192 ${field.relationTo}`);
		if (field.onDelete) parts.push(`onDelete: ${field.onDelete}`);
	}
	if (field.unique) parts.push("unique");
	if (field.defaultValue) parts.push(`default: ${field.defaultValue}`);
	return parts.join(", ") || "\u2014";
}

interface Relation {
	from: string;
	to: string;
	field: string;
	onDelete?: string;
}

function extractRelations(entities: EntityDefinition[]): Relation[] {
	const relations: Relation[] = [];
	for (const entity of entities) {
		for (const field of entity.fields) {
			if (field.type === "relation" && field.relationTo) {
				relations.push({
					from: field.relationTo,
					to: entity.name,
					field: field.name,
					onDelete: field.onDelete,
				});
			}
		}
	}
	return relations;
}

function fieldToMermaidType(type: EntityField["type"]): string {
	switch (type) {
		case "text": return "string";
		case "number": return "numeric";
		case "boolean": return "boolean";
		case "date": return "timestamptz";
		case "json": return "jsonb";
		default: return "string";
	}
}
