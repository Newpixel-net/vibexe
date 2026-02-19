/**
 * App Database Module
 *
 * Per-app isolated PostgreSQL database management for Vibexe builder apps.
 */

export {
	createAppDatabase,
	dropAppDatabase,
	getAppDatabaseInfo,
	ensureAppDatabase,
} from "./manager";

export {
	getAppPool,
	executeQuery,
	closePool,
	closeAllPools,
	getPoolStats,
} from "./pool-manager";

export type {
	EntityField,
	EntityDefinition,
	AppSchema,
} from "./schema-types";

export {
	fieldTypeToSql,
	toSnakeCase,
	pluralize,
	entityToTableName,
} from "./schema-types";

export {
	applySchema,
	diffAndApplySchema,
} from "./schema-executor";

export {
	generateApiKey,
	verifyApiKey,
	listApiKeys,
	revokeApiKey,
} from "./api-keys";
