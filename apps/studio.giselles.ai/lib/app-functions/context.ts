/**
 * Function Context Builder
 *
 * Builds the sandboxed context object that user functions receive.
 * Provides: db (query + CRUD helpers), auth, env, fetch, console (captured).
 */

import { executeQuery } from "@/lib/app-database/pool-manager";
import { logAppEvent } from "@/lib/app-database/app-logger";
import type { AppUser } from "@/lib/app-database/rls";
import {
	uploadFile as s3Upload,
	downloadFile as s3Download,
	listFiles as s3List,
	deleteFile as s3Delete,
	getPublicUrl,
} from "@/lib/app-storage/storage-manager";

// ─── Sandboxed fetch — block requests to internal/private networks ──────────

const BLOCKED_HOSTS = new Set([
	"localhost",
	"127.0.0.1",
	"[::1]",
	"0.0.0.0",
	"metadata.google.internal",
	"169.254.169.254", // AWS/GCP metadata endpoint
]);

function isPrivateIP(hostname: string): boolean {
	// IPv4 private ranges: 10.x, 172.16-31.x, 192.168.x
	const parts = hostname.split(".").map(Number);
	if (parts.length === 4 && parts.every((p) => !Number.isNaN(p))) {
		if (parts[0] === 10) return true;
		if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
		if (parts[0] === 192 && parts[1] === 168) return true;
		if (parts[0] === 0) return true;
	}
	return false;
}

function createSandboxedFetch(): typeof globalThis.fetch {
	return async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = typeof input === "string" ? new URL(input) : input instanceof URL ? input : new URL(input.url);

		if (url.protocol !== "http:" && url.protocol !== "https:") {
			throw new Error(`Blocked: fetch only supports http/https (got ${url.protocol})`);
		}

		if (BLOCKED_HOSTS.has(url.hostname) || isPrivateIP(url.hostname)) {
			throw new Error(`Blocked: cannot fetch internal/private address ${url.hostname}`);
		}

		return globalThis.fetch(input, init);
	};
}

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
	storage: {
		upload(path: string, data: Buffer, contentType: string): Promise<{ url: string; path: string; size: number; contentType: string }>;
		download(path: string): Promise<Buffer>;
		list(prefix?: string): Promise<{ path: string; size: number; url: string }[]>;
		delete(path: string): Promise<void>;
		getUrl(path: string, transforms?: { width?: number; height?: number; format?: string; quality?: number }): string;
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

/** Only allow safe SQL identifier chars (letters, digits, underscore, dash) */
const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_-]{0,63}$/;

function assertSafeIdentifier(value: string, label: string): void {
	if (!SAFE_IDENTIFIER.test(value)) {
		throw new Error(`Invalid ${label}: "${value}". Only letters, digits, underscore, and dash are allowed.`);
	}
}

/** Max total size for captured console logs (10 KB) */
const MAX_LOG_BYTES = 10 * 1024;

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
			assertSafeIdentifier(entity, "entity name");
			const page = Math.max(1, options.page ?? 1);
			const limit = Math.min(100, Math.max(1, options.limit ?? 20));
			const offset = (page - 1) * limit;
			const sort = options.sort ?? "created_at";
			assertSafeIdentifier(sort, "sort column");
			const order = options.order === "asc" ? "ASC" : "DESC";

			const filters: string[] = [];
			const params: unknown[] = [];
			let paramIdx = 1;

			if (options.filter) {
				for (const [key, value] of Object.entries(options.filter)) {
					assertSafeIdentifier(key, "filter key");
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
			assertSafeIdentifier(entity, "entity name");
			const rows = await executeQuery(databaseName, `SELECT * FROM "${entity}" WHERE id = $1`, [id]);
			return rows[0] ?? null;
		},

		async create(entity: string, data: Record<string, unknown>): Promise<unknown> {
			assertSafeIdentifier(entity, "entity name");
			const keys = Object.keys(data);
			if (keys.length === 0) throw new Error("No fields provided for create");
			for (const k of keys) assertSafeIdentifier(k, "field name");
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
			assertSafeIdentifier(entity, "entity name");
			const keys = Object.keys(data);
			if (keys.length === 0) throw new Error("No fields provided for update");
			for (const k of keys) assertSafeIdentifier(k, "field name");
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
			assertSafeIdentifier(entity, "entity name");
			const rows = await executeQuery(databaseName, `DELETE FROM "${entity}" WHERE id = $1 RETURNING id`, [id]);
			return rows.length > 0;
		},
	};

	let logBytes = 0;
	let logTruncated = false;
	const pushLog = (msg: string) => {
		if (logTruncated) return;
		logBytes += msg.length;
		if (logBytes > MAX_LOG_BYTES) {
			consoleLogs.push("[truncated — log output exceeded 10 KB]");
			logTruncated = true;
			return;
		}
		consoleLogs.push(msg);
	};

	const capturedConsole: FunctionContext["console"] = {
		log: (...args: unknown[]) => {
			pushLog(args.map(safeStringify).join(" "));
		},
		warn: (...args: unknown[]) => {
			pushLog(`[WARN] ${args.map(safeStringify).join(" ")}`);
		},
		error: (...args: unknown[]) => {
			pushLog(`[ERROR] ${args.map(safeStringify).join(" ")}`);
		},
	};

	const appId = opts.appId ?? "";

	const storageHelpers: FunctionContext["storage"] = {
		async upload(path: string, data: Buffer, contentType: string) {
			return s3Upload(appId, path, data, contentType);
		},
		async download(path: string): Promise<Buffer> {
			const result = await s3Download(appId, path);
			return result.data;
		},
		async list(prefix?: string) {
			const result = await s3List(appId, prefix);
			return result.files.map((f) => ({ path: f.path, size: f.size, url: f.url }));
		},
		async delete(path: string): Promise<void> {
			return s3Delete(appId, path);
		},
		getUrl(path: string, transforms?: { width?: number; height?: number; format?: string; quality?: number }): string {
			let url = getPublicUrl(appId, path);
			if (transforms) {
				const params = new URLSearchParams();
				if (transforms.width) params.set("width", String(transforms.width));
				if (transforms.height) params.set("height", String(transforms.height));
				if (transforms.format) params.set("format", transforms.format);
				if (transforms.quality) params.set("quality", String(transforms.quality));
				const qs = params.toString();
				if (qs) url += `?${qs}`;
			}
			return url;
		},
	};

	const ctx: FunctionContext = {
		db: dbHelpers,
		auth: user ? { userId: user.userId, email: user.email, role: user.role } : null,
		env: secrets,
		fetch: createSandboxedFetch(),
		console: capturedConsole,
		storage: storageHelpers,
	};

	if (opts.request) ctx.request = opts.request;
	if (opts.entity) ctx.entity = opts.entity;
	if (opts.record) ctx.record = opts.record;
	if (opts.hookData) ctx.data = opts.hookData;
	if (opts.hookType) ctx.hookType = opts.hookType;

	return ctx;
}
