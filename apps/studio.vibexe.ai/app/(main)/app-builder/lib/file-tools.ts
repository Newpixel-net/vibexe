// vibexe-integration/lib/file-tools.ts
// AI SDK tool definitions for file operations in App Builder
//
// This file provides createFileTools() which returns tool definitions
// for the AI to create, update, and delete files during code generation.
//
// Deploy to: /opt/vibexe/apps/studio.vibexe.ai/app/(main)/app-builder/lib/file-tools.ts

import { eq } from "drizzle-orm";
import { tool } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { type BuilderAppId, builderApps, builderAppDatabases } from "@/db/schema";
import {
	ensureAppDatabase,
	entityToTableName,
	type AppSchema,
} from "@/lib/app-database";
import { applySchema, diffAndApplySchema } from "@/lib/app-database/schema-executor";
import { deleteFile, getFileByPath, saveFile } from "./queries";

/**
 * Options for file creation filtering.
 * Used to prevent AI agents from overwriting pre-created templates
 * or creating forbidden files (e.g. BootScene, MenuScene).
 */
export interface FileToolsOptions {
	/** Paths that already exist as pre-created templates — silently skip overwrites */
	protectedPaths?: Set<string>;
	/** Regex patterns for files that should never be created */
	forbiddenPatterns?: RegExp[];
	/** Path rewrites: e.g. { "src/scenes/GameScene.ts": "src/scenes/GameScene3D.ts" } */
	pathRewrites?: Map<string, string>;
	/** If set, ONLY files matching at least one pattern can be created/updated */
	allowedPathPatterns?: RegExp[];
	/** Import path rewrites applied to file CONTENT (fix import/from mismatches after path rewrites) */
	importRewrites?: [RegExp, string][];
}

/**
 * Create file operation tools for AI SDK.
 * These tools allow the AI to create, update, and delete files
 * during the app generation process.
 *
 * @param appId - The builder app ID (bldr_xxx) to scope operations to
 * @param options - Optional filtering to protect templates and block forbidden files
 * @returns Object containing createFile, updateFile, deleteFile tools
 */
export function createFileTools(appId: string, options?: FileToolsOptions) {
	const protectedPaths = options?.protectedPaths ?? new Set<string>();
	const forbiddenPatterns = options?.forbiddenPatterns ?? [];
	const pathRewrites = options?.pathRewrites ?? new Map<string, string>();
	const allowedPathPatterns = options?.allowedPathPatterns ?? [];
	const importRewrites = options?.importRewrites ?? [];

	/** Rewrite path if a mapping exists (e.g. GameScene.ts → GameScene3D.ts) */
	function rewritePath(filePath: string): string {
		const rewritten = pathRewrites.get(filePath);
		if (rewritten) {
			console.log(`[FileTools] Path rewrite: ${filePath} → ${rewritten}`);
			return rewritten;
		}
		return filePath;
	}

	/** Fix known import path mismatches in file content */
	function rewriteImports(content: string): string {
		if (importRewrites.length === 0) return content;
		let result = content;
		for (const [pattern, replacement] of importRewrites) {
			result = result.replace(pattern, replacement);
		}
		return result;
	}

	/** Check if a path is forbidden — returns rejection message or null */
	function checkForbidden(filePath: string): string | null {
		if (protectedPaths.has(filePath)) {
			console.log(`[FileTools] BLOCKED protected path: ${filePath}`);
			return `File "${filePath}" is a pre-created template and cannot be overwritten. Import from it instead.`;
		}
		for (const pattern of forbiddenPatterns) {
			if (pattern.test(filePath)) {
				console.log(`[FileTools] BLOCKED forbidden pattern: ${filePath}`);
				return `File "${filePath}" is BLOCKED. Do NOT create BootScene, MenuScene, or LoadingScene — Game3D.tsx already provides loading/menu/restart. Put ALL game logic in src/scenes/GameScene3D.ts. Only import from: ../config/assets-3d, ../utils/media-stock-3d, ../scenes/GameOverScene3D, ../config/constants.`;
			}
		}
		// Allowlist: if set, only matching paths can be created
		if (allowedPathPatterns.length > 0) {
			const isAllowed = allowedPathPatterns.some((p) => p.test(filePath));
			if (!isAllowed) {
				console.log(`[FileTools] BLOCKED by allowlist: ${filePath}`);
				return `File "${filePath}" is not allowed. Only create: src/scenes/GameScene3D.ts, src/config/constants.ts, docs/*.md, src/objects/*.ts, src/utils/level-builder.ts. Put ALL game logic in GameScene3D.ts.`;
			}
		}
		return null;
	}

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
			execute: async ({ path: rawPath, content: rawContent, language }) => {
				const path = rewritePath(rawPath);
				const content = rewriteImports(rawContent);
				const blocked = checkForbidden(path);
				if (blocked) {
					return { success: false, action: "created", path, error: blocked };
				}
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
			execute: async ({ path: rawPath, content: rawContent }) => {
				const path = rewritePath(rawPath);
				const content = rewriteImports(rawContent);
				const blocked = checkForbidden(path);
				if (blocked) {
					return { success: false, action: "updated", path, error: blocked };
				}
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

		manage_environments: tool({
			description:
				"Manage multi-environment databases (development/staging/production) for the app. Use this to create environments, promote schemas between environments, preview schema diffs, or list existing environments.",
			inputSchema: z.object({
				action: z
					.enum(["list", "create", "promote", "diff", "delete"])
					.describe(
						'Action to perform: "list" shows all environments, "create" provisions a new staging/production database, "promote" copies schema from one env to another, "diff" previews schema differences, "delete" removes an environment',
					),
				environment: z
					.enum(["staging", "production"])
					.optional()
					.describe('Target environment for create/delete actions'),
				fromEnvironment: z
					.string()
					.optional()
					.describe('Source environment for promote/diff (e.g., "development")'),
				toEnvironment: z
					.string()
					.optional()
					.describe('Target environment for promote/diff (e.g., "staging")'),
			}),
			execute: async ({ action, environment, fromEnvironment, toEnvironment }) => {
				try {
					const app = await db.query.builderApps.findFirst({
						where: eq(builderApps.id, appId as BuilderAppId),
						columns: { dbId: true },
					});
					if (!app) return { success: false, error: `App not found: ${appId}` };

					const appDb = await db.query.builderAppDatabases.findFirst({
						where: eq(builderAppDatabases.appDbId, app.dbId),
					});
					if (!appDb) return { success: false, error: "No database found for this app" };

					switch (action) {
						case "list": {
							const { listEnvironments } = await import("@/lib/app-database/environment-manager");
							const environments = await listEnvironments(appDb.appDbId);
							return {
								success: true,
								action: "listed",
								environments: environments.map((e) => ({
									environment: e.environment,
									databaseName: e.databaseName,
									status: e.status,
									schemaVersion: e.schemaVersion,
									promotedAt: e.promotedAt,
									promotedFrom: e.promotedFrom,
								})),
							};
						}
						case "create": {
							if (!environment) return { success: false, error: 'Must specify "environment" (staging or production)' };
							const { createEnvironmentDatabase } = await import("@/lib/app-database/environment-manager");
							const result = await createEnvironmentDatabase(appDb.appDbId, environment);
							return {
								success: true,
								action: "created",
								environment,
								databaseName: result.databaseName,
								message: `${environment} environment created successfully. Use promote to copy your schema.`,
							};
						}
						case "promote": {
							if (!fromEnvironment || !toEnvironment) {
								return { success: false, error: 'Must specify "fromEnvironment" and "toEnvironment"' };
							}
							const { promoteEnvironment } = await import("@/lib/app-database/environment-manager");
							const result = await promoteEnvironment(appDb.appDbId, fromEnvironment, toEnvironment);
							return {
								success: true,
								action: "promoted",
								from: fromEnvironment,
								to: toEnvironment,
								newTables: result.newTables,
								newColumns: result.newColumns,
								message: `Schema promoted from ${fromEnvironment} to ${toEnvironment}. A pre-promote backup was created automatically.`,
							};
						}
						case "diff": {
							if (!fromEnvironment || !toEnvironment) {
								return { success: false, error: 'Must specify "fromEnvironment" and "toEnvironment"' };
							}
							const { listEnvironments, diffSchemas } = await import("@/lib/app-database/environment-manager");
							const envs = await listEnvironments(appDb.appDbId);
							const fromEnv = envs.find((e) => e.environment === fromEnvironment);
							const toEnv = envs.find((e) => e.environment === toEnvironment);
							if (!fromEnv) return { success: false, error: `Environment "${fromEnvironment}" not found` };
							if (!toEnv) return { success: false, error: `Environment "${toEnvironment}" not found` };
							const diff = diffSchemas(fromEnv.schemaJson, toEnv.schemaJson);
							const hasChanges = diff.newTables.length > 0 || diff.newColumns.length > 0 || diff.removedTables.length > 0 || diff.removedColumns.length > 0;
							return {
								success: true,
								action: "diff",
								from: fromEnvironment,
								to: toEnvironment,
								hasChanges,
								newTables: diff.newTables.map((t) => t.name),
								newColumns: diff.newColumns.map((c) => `${c.table}.${c.field.name}`),
								removedTables: diff.removedTables,
								removedColumns: diff.removedColumns.map((c) => `${c.table}.${c.field}`),
							};
						}
						case "delete": {
							if (!environment) return { success: false, error: 'Must specify "environment" to delete' };
							const { deleteEnvironmentDatabase } = await import("@/lib/app-database/environment-manager");
							await deleteEnvironmentDatabase(appDb.appDbId, environment);
							return {
								success: true,
								action: "deleted",
								environment,
								message: `${environment} environment deleted successfully.`,
							};
						}
						default:
							return { success: false, error: `Unknown action: ${action}` };
					}
				} catch (error) {
					console.error("manage_environments error:", error);
					return {
						success: false,
						error: `Environment operation failed: ${error instanceof Error ? error.message : String(error)}`,
					};
				}
			},
		}),

		lookup_integration_props: tool({
			description:
				"Look up available actions and their property schemas for an Activepieces integration piece. Call this BEFORE writing code that uses app.integrations.execute() to discover the exact property names an action expects. Without this, you will guess wrong property names and the integration will fail at runtime.",
			inputSchema: z.object({
				pieceName: z
					.string()
					.describe(
						'The piece name to look up (e.g. "slack", "sendgrid", "gmail", "hubspot")',
					),
				actionName: z
					.string()
					.optional()
					.describe(
						'Optional: specific action to get detailed properties for (e.g. "send_message", "send_email"). If omitted, returns all actions with their properties.',
					),
			}),
			execute: async ({ pieceName, actionName }) => {
				try {
					const { inspectPiece } = await import(
						"@vibexe-ai/activepieces-adapter/server"
					);
					const info = await inspectPiece(pieceName);

					if (actionName) {
						// Return detailed props for a specific action
						const action = info.actions.find((a) => a.name === actionName);
						if (!action) {
							return {
								success: false,
								pieceName,
								error: `Action "${actionName}" not found. Available actions: ${info.actions.map((a) => a.name).join(", ")}`,
							};
						}
						return {
							success: true,
							pieceName: info.name,
							displayName: info.displayName,
							action: action.name,
							actionDisplayName: action.displayName,
							description: action.description,
							requireAuth: action.requireAuth,
							properties: Object.values(action.props).map((p) => ({
								name: p.name,
								displayName: p.displayName,
								description: p.description,
								type: p.type,
								required: p.required,
								defaultValue: p.defaultValue,
								options: p.options,
							})),
						};
					}

					// Return all actions with their properties
					return {
						success: true,
						pieceName: info.name,
						displayName: info.displayName,
						authType: info.auth?.type ?? "none",
						actions: info.actions.map((a) => ({
							name: a.name,
							displayName: a.displayName,
							description: a.description,
							properties: Object.values(a.props).map((p) => ({
								name: p.name,
								type: p.type,
								required: p.required,
								description: p.description,
							})),
						})),
					};
				} catch (error) {
					return {
						success: false,
						pieceName,
						error: `Failed to look up piece "${pieceName}": ${String(error)}`,
					};
				}
			},
		}),

		manage_backups: tool({
			description:
				"Manage database backups for the app. Use this to create manual backups, list existing backups, restore from a backup, or delete old backups. Backups use pg_dump and are stored in S3.",
			inputSchema: z.object({
				action: z
					.enum(["list", "create", "restore", "delete"])
					.describe(
						'Action to perform: "list" shows all backups, "create" triggers a manual backup, "restore" restores from a backup, "delete" removes a backup',
					),
				environment: z
					.string()
					.optional()
					.describe('Environment to filter/create backups for (default: "development")'),
				backupId: z
					.number()
					.optional()
					.describe("Backup ID for restore/delete actions"),
			}),
			execute: async ({ action, environment, backupId }) => {
				try {
					const app = await db.query.builderApps.findFirst({
						where: eq(builderApps.id, appId as BuilderAppId),
						columns: { dbId: true },
					});
					if (!app) return { success: false, error: `App not found: ${appId}` };

					const appDb = await db.query.builderAppDatabases.findFirst({
						where: eq(builderAppDatabases.appDbId, app.dbId),
					});
					if (!appDb) return { success: false, error: "No database found for this app" };

					switch (action) {
						case "list": {
							const { builderAppBackups } = await import("@/db/schema");
							const { eq: eqOp, and, desc } = await import("drizzle-orm");
							let query = db
								.select()
								.from(builderAppBackups)
								.where(eqOp(builderAppBackups.appDbId, appDb.appDbId))
								.orderBy(desc(builderAppBackups.createdAt))
								.limit(20);
							const backups = await query;
							return {
								success: true,
								action: "listed",
								backups: backups.map((b) => ({
									id: b.dbId,
									environment: b.environment,
									backupType: b.backupType,
									sizeBytes: b.sizeBytes,
									status: b.status,
									createdAt: b.createdAt,
									expiresAt: b.expiresAt,
								})),
							};
						}
						case "create": {
							const env = environment || "development";
							const { resolveDatabase } = await import("@/lib/app-database/environment-manager");
							let dbName: string;
							try {
								dbName = await resolveDatabase(appDb.appDbId, env);
							} catch {
								dbName = appDb.databaseName;
							}
							const { createBackup } = await import("@/lib/app-backups/backup-manager");
							const result = await createBackup({
								appDbId: appDb.appDbId,
								databaseName: dbName,
								environment: env,
								backupType: "manual",
							});
							return {
								success: true,
								action: "created",
								environment: env,
								backupId: result.backupDbId,
								sizeBytes: result.sizeBytes,
								message: `Manual backup created for ${env} environment (${(result.sizeBytes / 1024).toFixed(1)} KB). Retained for 30 days.`,
							};
						}
						case "restore": {
							if (!backupId) return { success: false, error: 'Must specify "backupId" to restore' };
							const env = environment || "development";
							const { resolveDatabase } = await import("@/lib/app-database/environment-manager");
							let dbName: string;
							try {
								dbName = await resolveDatabase(appDb.appDbId, env);
							} catch {
								dbName = appDb.databaseName;
							}
							// Create a safety backup before restoring
							const { createBackup, restoreBackup } = await import("@/lib/app-backups/backup-manager");
							try {
								await createBackup({
									appDbId: appDb.appDbId,
									databaseName: dbName,
									environment: env,
									backupType: "pre-deploy",
								});
							} catch (e) {
								console.error("[Restore] Pre-restore backup failed:", e);
							}
							await restoreBackup({ backupDbId: backupId, targetDatabaseName: dbName });
							return {
								success: true,
								action: "restored",
								backupId,
								targetDatabase: dbName,
								message: `Database restored from backup #${backupId}. A safety backup was created before restoring.`,
							};
						}
						case "delete": {
							if (!backupId) return { success: false, error: 'Must specify "backupId" to delete' };
							const { deleteBackup } = await import("@/lib/app-backups/backup-manager");
							await deleteBackup(backupId);
							return {
								success: true,
								action: "deleted",
								backupId,
								message: `Backup #${backupId} deleted from S3 and database.`,
							};
						}
						default:
							return { success: false, error: `Unknown action: ${action}` };
					}
				} catch (error) {
					console.error("manage_backups error:", error);
					return {
						success: false,
						error: `Backup operation failed: ${error instanceof Error ? error.message : String(error)}`,
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
