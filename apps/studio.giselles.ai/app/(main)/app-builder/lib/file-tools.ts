// giselle-integration/lib/file-tools.ts
// AI SDK tool definitions for file operations in App Builder
//
// This file provides createFileTools() which returns tool definitions
// for the AI to create, update, and delete files during code generation.
//
// Deploy to: /opt/giselle/apps/studio.giselles.ai/app/(main)/app-builder/lib/file-tools.ts

import { eq } from "drizzle-orm";
import { tool } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { type BuilderAppId, builderApps } from "@/db/schema";
import {
	ensureAppDatabase,
	entityToTableName,
	type AppSchema,
} from "@/lib/app-database";
import { applySchema, diffAndApplySchema } from "@/lib/app-database/schema-executor";
import { deleteFile, getFileByPath, saveFile } from "./queries";

/**
 * Create file operation tools for AI SDK.
 * These tools allow the AI to create, update, and delete files
 * during the app generation process.
 *
 * @param appId - The builder app ID (bldr_xxx) to scope operations to
 * @returns Object containing createFile, updateFile, deleteFile tools
 */
export function createFileTools(appId: string) {
	return {
		create_file: tool({
			description:
				"Create a new file in the project. Use this when generating new code files like components, pages, utilities, or configuration files.",
			inputSchema: z.object({
				path: z
					.string()
					.describe(
						'File path relative to project root, e.g., "src/App.tsx" or "src/components/Button.tsx"',
					)
					.regex(
						/^[a-zA-Z0-9_\-./]+$/,
						"Path must contain only alphanumeric characters, underscores, hyphens, dots, and slashes",
					),
				content: z
					.string()
					.describe(
						"The complete file content including all imports and exports",
					),
				language: z
					.string()
					.optional()
					.describe(
						"Programming language for syntax highlighting (auto-detected if not provided)",
					),
			}),
			execute: async ({ path, content, language }) => {
				try {
					const lang = language || inferLanguage(path);
					const file = await saveFile(appId, path, content, lang);
					return { success: true, action: "created", path, fileId: file.id };
				} catch (error) {
					console.error("create_file error:", error);
					return {
						success: false,
						action: "created",
						path,
						error: `Failed to create file: ${String(error)}`,
					};
				}
			},
		}),

		update_file: tool({
			description:
				"Update an existing file in the project. Use this when modifying existing code, fixing bugs, or adding features to existing files.",
			inputSchema: z.object({
				path: z.string().describe("File path to update"),
				content: z
					.string()
					.describe(
						"The new complete file content (replaces entire file contents)",
					),
			}),
			execute: async ({ path, content }) => {
				try {
					const lang = inferLanguage(path);
					const file = await saveFile(appId, path, content, lang);
					return { success: true, action: "updated", path, fileId: file.id };
				} catch (error) {
					console.error("update_file error:", error);
					return {
						success: false,
						action: "updated",
						path,
						error: `Failed to update file: ${String(error)}`,
					};
				}
			},
		}),

		delete_file: tool({
			description:
				"Delete a file from the project. Use this when removing unnecessary files or when a file is being replaced by another.",
			inputSchema: z.object({
				path: z.string().describe("File path to delete"),
			}),
			execute: async ({ path }) => {
				try {
					await deleteFile(appId, path);
					return { success: true, action: "deleted", path };
				} catch (error) {
					console.error("delete_file error:", error);
					return {
						success: false,
						action: "deleted",
						path,
						error: `Failed to delete file: ${String(error)}`,
					};
				}
			},
		}),

		read_file: tool({
			description:
				"Read the contents of an existing file in the project. Use this BEFORE update_file to understand the current code, or to inspect any file's implementation.",
			inputSchema: z.object({
				path: z
					.string()
					.describe(
						'File path relative to project root, e.g., "src/App.tsx" or "Blueprint.md"',
					),
			}),
			execute: async ({ path }) => {
				try {
					const file = await getFileByPath(appId, path);
					if (!file) {
						return {
							success: false,
							path,
							error: `File not found: ${path}`,
						};
					}
					return {
						success: true,
						path,
						content: file.content,
						language: file.language,
					};
				} catch (error) {
					console.error("read_file error:", error);
					return {
						success: false,
						path,
						error: `Failed to read file: ${String(error)}`,
					};
				}
			},
		}),

		define_entities: tool({
			description:
				"Define the data entities (database tables) for the app's backend. Call this ONCE with all entities when the user describes data models, a backend, or needs to persist data. Each entity becomes a real PostgreSQL table with auto-generated CRUD API.",
			inputSchema: z.object({
				entities: z
					.array(
						z.object({
							name: z
								.string()
								.describe(
									'Entity name in PascalCase (e.g., "Course", "UserProgress", "BlogPost")',
								),
							fields: z.array(
								z.object({
									name: z
										.string()
										.describe(
											'Field name in snake_case (e.g., "title", "price", "is_published")',
										),
									type: z
										.enum([
											"text",
											"number",
											"boolean",
											"date",
											"json",
											"relation",
										])
										.describe(
											"Field data type. Use 'relation' for foreign key references to other entities.",
										),
									required: z
										.boolean()
										.optional()
										.describe("Whether this field is required (NOT NULL)"),
									unique: z
										.boolean()
										.optional()
										.describe("Whether this field must be unique"),
									relationTo: z
										.string()
										.optional()
										.describe(
											'For relation fields: the entity name this references (e.g., "Course")',
										),
								}),
							),
						}),
					)
					.describe("All entities to create. Each gets id, created_at, updated_at automatically."),
			}),
			execute: async ({ entities }) => {
				try {
					// Look up the app's dbId from the string appId
					const app = await db.query.builderApps.findFirst({
						where: eq(builderApps.id, appId as BuilderAppId),
						columns: { dbId: true },
					});

					if (!app) {
						return {
							success: false,
							error: `App not found: ${appId}`,
						};
					}

					// Ensure the app has a database
					const appDb = await ensureAppDatabase(app.dbId);
					if (appDb.status !== "active") {
						return {
							success: false,
							error: `Database is in '${appDb.status}' state. Please try again.`,
						};
					}

					// Build the schema
					const schema: AppSchema = {
						version: 1,
						entities: entities.map((e) => ({
							name: e.name,
							tableName: entityToTableName(e.name),
							fields: e.fields,
						})),
					};

					// Check if there's an existing schema to diff against
					const existingSchema = appDb.schemaJson as AppSchema | null;
					if (
						existingSchema &&
						existingSchema.entities &&
						existingSchema.entities.length > 0
					) {
						const diff = await diffAndApplySchema(
							appDb.databaseName,
							existingSchema,
							{ ...schema, version: existingSchema.version + 1 },
							appDb.dbId,
						);
						return {
							success: true,
							action: "updated_schema",
							database: appDb.databaseName,
							entities: schema.entities.map((e) => ({
								name: e.name,
								tableName: e.tableName,
								fields: e.fields.map((f) => f.name),
								apiEndpoint: `/api/apps/${appId}/data/${e.tableName}`,
							})),
							newTables: diff.newTables,
							newColumns: diff.newColumns,
							sdkImport: '@vibexe/sdk',
							sdkUsage: `import { VibexeApp } from "@vibexe/sdk";\nconst app = new VibexeApp({ appId: "${appId}" });`,
						};
					}

					// Fresh schema — apply from scratch
					await applySchema(appDb.databaseName, schema, appDb.dbId);

					return {
						success: true,
						action: "created_schema",
						database: appDb.databaseName,
						entities: schema.entities.map((e) => ({
							name: e.name,
							tableName: e.tableName,
							fields: e.fields.map((f) => f.name),
							apiEndpoint: `/api/apps/${appId}/data/${e.tableName}`,
						})),
						sdkImport: '@vibexe/sdk',
						sdkUsage: `import { VibexeApp } from "@vibexe/sdk";\nconst app = new VibexeApp({ appId: "${appId}" });`,
					};
				} catch (error) {
					console.error("define_entities error:", error);
					return {
						success: false,
						error: `Backend unavailable: ${error instanceof Error ? error.message : String(error)}. IMPORTANT: Continue building the app using create_file with localStorage for data persistence instead. Do NOT retry define_entities.`,
					};
				}
			},
		}),
	};
}

/**
 * Infer programming language from file extension
 * Used for syntax highlighting in the code editor
 */
function inferLanguage(path: string): string {
	const ext = path.split(".").pop()?.toLowerCase();
	const langMap: Record<string, string> = {
		// JavaScript/TypeScript
		ts: "typescript",
		tsx: "typescript",
		js: "javascript",
		jsx: "javascript",
		mjs: "javascript",
		cjs: "javascript",
		// Styles
		css: "css",
		scss: "scss",
		sass: "sass",
		less: "less",
		// Markup
		html: "html",
		htm: "html",
		xml: "xml",
		svg: "xml",
		// Data
		json: "json",
		yaml: "yaml",
		yml: "yaml",
		toml: "toml",
		// Documentation
		md: "markdown",
		mdx: "markdown",
		// Other languages
		py: "python",
		rb: "ruby",
		go: "go",
		rs: "rust",
		java: "java",
		kt: "kotlin",
		swift: "swift",
		php: "php",
		sql: "sql",
		sh: "shell",
		bash: "shell",
		zsh: "shell",
		// Config
		env: "plaintext",
		gitignore: "plaintext",
		dockerignore: "plaintext",
	};
	return langMap[ext || ""] || "plaintext";
}
