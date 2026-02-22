/**
 * Function Context Builder
 *
 * Builds the sandboxed context object that user functions receive.
 * Provides: db (query + CRUD helpers), auth, env, fetch, console (captured).
 */

import { executeQuery } from "@/lib/app-database/pool-manager";
import { logAppEvent } from "@/lib/app-database/app-logger";
import type { AppUser } from "@/lib/app-database/rls";

// ---- Types ----

export interface FunctionContext {
	db: {
		query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
		list(entity: string, options?: ListOptions): Promise<{ data: unknown[]; total: number }>;
		get(entity: string, id: number): Promise<unknown | null>;
		create(entity: string, data: Record<string, unknown>): Promise<unknown>;
		update(entity: string, id: number, data: Record<string, unknown>): Promise<unknown>;
		delete(entity: string, id: number): Promise<boolean>;
	};
	auth: { userId: number; email: string; role: string } | null;
	env: Record<string, string>;
	fetch: typeof globalThis.fetch;
	console: {
		log: (...args: unknown[]) => void;
		warn: (...args: unknown[]) => void;
		error: (...args: unknown[]) => void;
	};
	// HTTP trigger fields
	request?: {
		body: unknown;
		headers: Record<string, string>;
		query: Record<string, string>;
		method: string;
	};
	// Entity hook fields
	entity?: string;
	record?: Record<string, unknown>;
	data?: Record<string, unknown>;
	hookType?: string;
}

export interface ListOptions {
	filter?: Record<string, unknown>;
	sort?: string;
	order?: "asc" | "desc";
	page?: number;
	limit?: number;
}

// ---- Helpers ----

function safeStringify(val: unknown): string {
	if (typeof val === "string") return val;
	try {
		return JSON.stringify(val);
	} catch {
		return String(val);
	}
}

// ---- Builder ----

export interface BuildContextOpts {
	databaseName: string;
	user: AppUser | null;
	secrets: Record<string, string>;
	consoleLogs: string[];
	appId?: string;
	// HTTP trigger
	request?: FunctionContext["request"];
	// Entity hook
	entity?: string;
	record?: Record<string, unknown>;
	hookData?: Record<string, unknown>;
	hookType?: string;
}

export function buildFunctionContext(opts: BuildContextOpts): FunctionContext {
	const { databaseName, user, secrets, consoleLogs } = opts;

	const dbHelpers: FunctionContext["db"] = {
		async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
			return executeQuery<T & Record<string, unknown>>(databaseName, sql, params) as Promise<T[]>;
		},

		async list(entity: string, options: ListOptions = {}): Promise<{ data: unknown[]; total: number }> {
			const page = Math.max(1, options.page ?? 1);
			const limit = Math.min(100, Math.max(1, options.limit ?? 20));
			const offset = (page - 1) * limit;
			const sort = options.sort ?? "created_at";
			const order = options.order === "asc" ? "ASC" : "DESC";

			const filters: string[] = [];
			const params: unknown[] = [];
			let paramIdx = 1;

			if (options.filter) {
				for (const [key, value] of Object.entries(options.filter)) {
					filters.push(`"${key}" = $${paramIdx}`);
					params.push(value);
					paramIdx++;
				}
			}

			const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

			const countResult = await executeQuery<{ count: string }>(
				databaseName,
				`SELECT COUNT(*) as count FROM "${entity}" ${whereClause}`,
				params,
			);
			const total = Number.parseInt(countResult[0]?.count ?? "0", 10);

			const rows = await executeQuery(
				databaseName,
				`SELECT * FROM "${entity}" ${whereClause} ORDER BY "${sort}" ${order} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
				[...params, limit, offset],
			);

			return { data: rows, total };
		},

		async get(entity: string, id: number): Promise<unknown | null> {
			const rows = await executeQuery(databaseName, `SELECT * FROM "${entity}" WHERE id = $1`, [id]);
			return rows[0] ?? null;
		},

		async create(entity: string, data: Record<string, unknown>): Promise<unknown> {
			const keys = Object.keys(data);
			if (keys.length === 0) throw new Error("No fields provided for create");
			const fields = keys.map((k) => `"${k}"`).join(", ");
			const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
			const values = keys.map((k) => data[k]);
			const rows = await executeQuery(
				databaseName,
				`INSERT INTO "${entity}" (${fields}) VALUES (${placeholders}) RETURNING *`,
				values,
			);
			return rows[0];
		},

		async update(entity: string, id: number, data: Record<string, unknown>): Promise<unknown> {
			const keys = Object.keys(data);
			if (keys.length === 0) throw new Error("No fields provided for update");
			const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`);
			setClauses.push(`"updated_at" = NOW()`);
			const values = [...keys.map((k) => data[k]), id];
			const rows = await executeQuery(
				databaseName,
				`UPDATE "${entity}" SET ${setClauses.join(", ")} WHERE id = $${keys.length + 1} RETURNING *`,
				values,
			);
			return rows[0] ?? null;
		},

		async delete(entity: string, id: number): Promise<boolean> {
			const rows = await executeQuery(databaseName, `DELETE FROM "${entity}" WHERE id = $1 RETURNING id`, [id]);
			return rows.length > 0;
		},
	};

	const capturedConsole: FunctionContext["console"] = {
		log: (...args: unknown[]) => {
			consoleLogs.push(args.map(safeStringify).join(" "));
		},
		warn: (...args: unknown[]) => {
			consoleLogs.push(`[WARN] ${args.map(safeStringify).join(" ")}`);
		},
		error: (...args: unknown[]) => {
			consoleLogs.push(`[ERROR] ${args.map(safeStringify).join(" ")}`);
		},
	};

	const ctx: FunctionContext = {
		db: dbHelpers,
		auth: user ? { userId: user.userId, email: user.email, role: user.role } : null,
		env: secrets,
		fetch: globalThis.fetch,
		console: capturedConsole,
	};

	if (opts.request) ctx.request = opts.request;
	if (opts.entity) ctx.entity = opts.entity;
	if (opts.record) ctx.record = opts.record;
	if (opts.hookData) ctx.data = opts.hookData;
	if (opts.hookType) ctx.hookType = opts.hookType;

	return ctx;
}
