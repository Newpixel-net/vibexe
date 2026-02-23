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
		fields: [
			// id (session token) intentionally excluded — never expose via data API
			{ name: "user_id", type: "number", required: true },
			{ name: "expires_at", type: "date", required: true },
		],
	},
};

/** Max items allowed in a single IN filter array */
export const MAX_IN_FILTER_ITEMS = 100;
