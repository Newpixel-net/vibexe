/**
 * Internal Tables Registry
 *
 * Shared definition of internal auth tables (_app_users, _app_sessions)
 * that exist in every app database. Used by data API routes for validation.
 *
 * SECURITY: Internal tables require API key or builder session access.
 * End-users (Bearer token auth) cannot access internal tables.
 * password_hash is excluded from the exposed fields list.
 */

export interface InternalTableDef {
	name: string;
	tableName: string;
	fields: Array<{ name: string; type: string; required?: boolean }>;
	/** Whether to include the `id` column in SELECT results. Default: true.
	 *  Set to false for tables where `id` is sensitive (e.g. session tokens). */
	exposeId?: boolean;
}

/** Internal auth tables that exist in every app database */
export const INTERNAL_TABLES: Record<string, InternalTableDef> = {
	_app_users: {
		name: "AppUser",
		tableName: "_app_users",
		fields: [
			{ name: "email", type: "text", required: true },
			// password_hash intentionally excluded — never expose via data API
			{ name: "display_name", type: "text" },
			{ name: "role", type: "text" },
			{ name: "status", type: "text" },
			{ name: "email_verified", type: "boolean" },
			{ name: "last_login_at", type: "date" },
			{ name: "auth_provider", type: "text" },
			{ name: "provider_user_id", type: "text" },
			{ name: "avatar_url", type: "text" },
		],
	},
	_app_sessions: {
		name: "AppSession",
		tableName: "_app_sessions",
		exposeId: false, // id IS the session token — never expose via data API
		fields: [
			{ name: "user_id", type: "number", required: true },
			{ name: "expires_at", type: "date", required: true },
		],
	},
};

/** Max items allowed in a single IN filter array */
export const MAX_IN_FILTER_ITEMS = 100;

/**
 * Build safe SQL column list for internal tables.
 * Excludes sensitive columns (password_hash, session tokens).
 * Use instead of SELECT * for internal tables.
 */
export function getInternalSelectColumns(tableDef: InternalTableDef): string {
	const cols: string[] = [];
	if (tableDef.exposeId !== false) cols.push('"id"');
	for (const f of tableDef.fields) cols.push(`"${f.name}"`);
	cols.push('"created_at"', '"updated_at"');
	return cols.join(", ");
}
