/**
 * Row-Level Security (RLS) Enforcement Module
 *
 * Enforces entity access policies for end-user Bearer token auth.
 * API keys bypass RLS entirely (they represent the app builder/admin).
 * Internal tables (_app_users, _app_sessions) are exempt from RLS.
 *
 * Access levels:
 *   public        — No auth required, no filtering
 *   authenticated — Valid session required, no filtering
 *   owner         — Valid session required, rows filtered by ownerField = userId
 *   role          — Valid session required, user.role must be in allowedRoles
 *   custom        — Valid session required, user-defined WHERE with $userId/$userRole substitution
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { builderAppEntityPolicies } from "@/db/schema";
import { executeQuery } from "./pool-manager";

// ---- Types ----

export interface AppUser {
	userId: number;
	email: string;
	role: string;
}

export interface EntityPolicy {
	readAccess: string;
	writeAccess: string;
	deleteAccess: string;
	ownerField: string;
	allowedRoles: string | null;
	customExpression: string | null;
}

export interface RLSCheck {
	allowed: boolean;
	error?: string;
	status?: number;
	whereClauses: string[];
	whereParams: unknown[];
	autoFields: Record<string, unknown>;
}

type Operation = "read" | "write" | "delete";

// ---- resolveAppUser ----

/**
 * Extract Bearer token from Authorization header, look up the session + user
 * in the app's database. Returns the user or null if no valid session.
 */
export async function resolveAppUser(
	databaseName: string,
	request: Request,
): Promise<AppUser | null> {
	const authHeader = request.headers.get("authorization");
	if (!authHeader?.startsWith("Bearer ")) return null;
	const token = authHeader.slice(7);
	if (!token) return null;

	try {
		const results = await executeQuery<{
			user_id: number;
			email: string;
			role: string;
			status: string;
		}>(
			databaseName,
			`SELECT u.id AS user_id, u.email, u.role, u.status
			 FROM "_app_sessions" s
			 JOIN "_app_users" u ON u.id = s.user_id
			 WHERE s.id = $1 AND s.expires_at > NOW()
			 LIMIT 1`,
			[token],
		);

		if (results.length === 0) return null;
		const row = results[0];
		if (row.status === "suspended" || row.status === "pending") return null;

		return {
			userId: row.user_id,
			email: row.email,
			role: row.role ?? "user",
		};
	} catch {
		// If _app_sessions table doesn't exist yet, gracefully return null
		return null;
	}
}

// ---- getEntityPolicy ----

/**
 * Fetch the entity's access policy from builder_app_entity_policies.
 * Returns sensible defaults if no row exists.
 */
export async function getEntityPolicy(
	appDbId: number,
	entityName: string,
): Promise<EntityPolicy> {
	const row = await db.query.builderAppEntityPolicies.findFirst({
		where: and(
			eq(builderAppEntityPolicies.appDbId, appDbId),
			eq(builderAppEntityPolicies.entityName, entityName),
		),
	});

	return {
		readAccess: row?.readAccess ?? "public",
		writeAccess: row?.writeAccess ?? "authenticated",
		deleteAccess: row?.deleteAccess ?? "authenticated",
		ownerField: row?.ownerField ?? "user_id",
		allowedRoles: row?.allowedRoles ?? null,
		customExpression: row?.customExpression ?? null,
	};
}

// ---- enforceRLS ----

interface EnforceOpts {
	policy: EntityPolicy;
	operation: Operation;
	user: AppUser | null;
	paramOffset: number;
	/** Entity field names — used to verify ownerField exists */
	entityFields?: string[];
}

/**
 * Evaluate the policy for the given operation and user.
 * Returns where clauses, params, and auto-inject fields (for POST).
 */
export function enforceRLS(opts: EnforceOpts): RLSCheck {
	const { policy, operation, user, paramOffset, entityFields } = opts;

	// Select the relevant access level
	const accessLevel =
		operation === "read"
			? policy.readAccess
			: operation === "write"
				? policy.writeAccess
				: policy.deleteAccess;

	// public — no restrictions
	if (accessLevel === "public") {
		return { allowed: true, whereClauses: [], whereParams: [], autoFields: {} };
	}

	// All other levels require authentication
	if (!user) {
		return {
			allowed: false,
			error: "Authentication required",
			status: 401,
			whereClauses: [],
			whereParams: [],
			autoFields: {},
		};
	}

	// authenticated — just needs a valid session
	if (accessLevel === "authenticated") {
		return { allowed: true, whereClauses: [], whereParams: [], autoFields: {} };
	}

	// owner — filter by ownerField = userId
	if (accessLevel === "owner") {
		const ownerField = policy.ownerField || "user_id";

		// Sanitize ownerField — must be a valid SQL identifier (letters, digits, underscores)
		if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(ownerField)) {
			return {
				allowed: false,
				error: "Invalid ownerField identifier",
				status: 400,
				whereClauses: [],
				whereParams: [],
				autoFields: {},
			};
		}

		// Warn if ownerField isn't in schema, but still enforce — the builder
		// explicitly configured this field in the security policy, and the column
		// may exist in the DB even if not in schema_json.
		if (entityFields && entityFields.length > 0 && !entityFields.includes(ownerField)) {
			console.warn(
				`[RLS] ownerField "${ownerField}" not in schema fields — enforcing anyway (column must exist in DB)`,
			);
		}

		const paramNum = paramOffset + 1;
		return {
			allowed: true,
			whereClauses: [`"${ownerField}" = $${paramNum}`],
			whereParams: [user.userId],
			autoFields: { [ownerField]: user.userId },
		};
	}

	// role — check user.role is in allowedRoles
	if (accessLevel === "role") {
		let roles: string[] = [];
		try {
			roles = policy.allowedRoles ? JSON.parse(policy.allowedRoles) : [];
		} catch {
			roles = [];
		}

		if (roles.length === 0) {
			// No roles configured — fall back to authenticated behavior
			return { allowed: true, whereClauses: [], whereParams: [], autoFields: {} };
		}

		if (!roles.includes(user.role)) {
			return {
				allowed: false,
				error: "Access denied: insufficient role",
				status: 403,
				whereClauses: [],
				whereParams: [],
				autoFields: {},
			};
		}

		return { allowed: true, whereClauses: [], whereParams: [], autoFields: {} };
	}

	// custom — user-defined WHERE expression with $userId/$userRole placeholders
	if (accessLevel === "custom") {
		const expr = policy.customExpression;
		if (!expr) {
			// No expression configured — fall back to authenticated
			return { allowed: true, whereClauses: [], whereParams: [], autoFields: {} };
		}

		// Validate expression — reject dangerous SQL patterns
		const dangerousPattern =
			/(\b(DROP|DELETE|INSERT|UPDATE|TRUNCATE|ALTER|CREATE|EXEC|EXECUTE|UNION|INTO|GRANT|REVOKE|COPY|pg_|information_schema)\b|--|\/\*|;)/i;
		if (dangerousPattern.test(expr)) {
			return {
				allowed: false,
				error: "Custom expression contains disallowed SQL syntax",
				status: 400,
				whereClauses: [],
				whereParams: [],
				autoFields: {},
			};
		}

		// Replace $userId and $userRole with parameterized values
		const params: unknown[] = [];
		let nextParam = paramOffset + 1;
		let parsed = expr;

		if (parsed.includes("$userId")) {
			parsed = parsed.replace(/\$userId/g, `$${nextParam}`);
			params.push(user.userId);
			nextParam++;
		}
		if (parsed.includes("$userRole")) {
			parsed = parsed.replace(/\$userRole/g, `$${nextParam}`);
			params.push(user.role);
			nextParam++;
		}

		return {
			allowed: true,
			whereClauses: [`(${parsed})`],
			whereParams: params,
			autoFields: {},
		};
	}

	// Unknown access level — default deny
	return {
		allowed: false,
		error: "Unknown access level",
		status: 403,
		whereClauses: [],
		whereParams: [],
		autoFields: {},
	};
}
