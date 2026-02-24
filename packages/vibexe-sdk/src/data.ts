/**
 * Vibexe Data Client
 *
 * CRUD operations for app entities via the Vibexe REST API.
 * Each entity maps to a PostgreSQL table with auto-generated endpoints.
 */

/** Advanced filter operators for a single field */
export interface FilterOperator {
	eq?: string | number | boolean;
	ne?: string | number;
	gt?: number;
	gte?: number;
	lt?: number;
	lte?: number;
	like?: string;
	in?: (string | number)[];
}

export interface ListOptions {
	page?: number;
	limit?: number;
	sort?: string;
	order?: "asc" | "desc";
	filter?: Record<string, string | number | boolean | FilterOperator>;
	/** Full-text search across indexed fields */
	search?: string;
	/** Populate relation fields with nested objects (e.g., ["author", "category"]) */
	include?: string[];
}

export interface AggregateOptions {
	group?: string;
	count?: boolean;
	sum?: string;
	avg?: string;
	min?: string;
	max?: string;
	filter?: Record<string, string | number | boolean | FilterOperator>;
}

export interface AggregateResponse {
	data: Record<string, unknown>[];
}

export interface DataChangeEvent<T = Record<string, unknown>> {
	entity: string;
	action: "created" | "updated" | "deleted";
	record: T;
	timestamp: string;
}

export interface SubscribeOptions {
	filter?: Record<string, string | number | boolean>;
}

export interface PaginatedResponse<T> {
	data: T[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

export class DataClient {
	private baseUrl: string;
	private headers: Record<string, string>;

	constructor(baseUrl: string, headers: Record<string, string>) {
		this.baseUrl = baseUrl;
		this.headers = headers;
	}

	/**
	 * List rows from an entity with pagination, sorting, and filtering.
	 */
	async list<T = Record<string, unknown>>(
		entity: string,
		options: ListOptions = {},
	): Promise<PaginatedResponse<T>> {
		const params = new URLSearchParams();
		if (options.page) params.set("page", String(options.page));
		if (options.limit) params.set("limit", String(options.limit));
		if (options.sort) params.set("sort", options.sort);
		if (options.order) params.set("order", options.order);
		if (options.filter) {
			for (const [key, value] of Object.entries(options.filter)) {
				if (value !== null && typeof value === "object" && !Array.isArray(value)) {
					// Advanced operator: filter[price][gte]=100
					for (const [op, opVal] of Object.entries(value as FilterOperator)) {
						if (op === "in" && Array.isArray(opVal)) {
							params.set(`filter[${key}][in]`, (opVal as (string | number)[]).join(","));
						} else if (opVal !== undefined) {
							params.set(`filter[${key}][${op}]`, String(opVal));
						}
					}
				} else {
					params.set(`filter[${key}]`, String(value));
				}
			}
		}
		if (options.search) params.set("search", options.search);
		if (options.include?.length) params.set("include", options.include.join(","));

		const qs = params.toString();
		const url = `${this.baseUrl}/data/${entity}${qs ? `?${qs}` : ""}`;
		const res = await fetch(url, { headers: this.headers });

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.error || `Failed to list ${entity}: ${res.status}`);
		}

		return await res.json();
	}

	/**
	 * Get a single row by ID.
	 */
	async get<T = Record<string, unknown>>(
		entity: string,
		id: number | string,
		options?: { include?: string[] },
	): Promise<T> {
		const params = new URLSearchParams();
		if (options?.include?.length) params.set("include", options.include.join(","));
		const qs = params.toString();
		const url = `${this.baseUrl}/data/${entity}/${id}${qs ? `?${qs}` : ""}`;
		const res = await fetch(url, { headers: this.headers });

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.error || `Failed to get ${entity}/${id}: ${res.status}`);
		}

		const json = await res.json();
		return json.data;
	}

	/**
	 * Create a new row.
	 */
	async create<T = Record<string, unknown>>(
		entity: string,
		data: Record<string, unknown>,
	): Promise<T> {
		const url = `${this.baseUrl}/data/${entity}`;
		const res = await fetch(url, {
			method: "POST",
			headers: { ...this.headers, "Content-Type": "application/json" },
			body: JSON.stringify(data),
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.error || `Failed to create ${entity}: ${res.status}`);
		}

		const json = await res.json();
		return json.data;
	}

	/**
	 * Update an existing row.
	 */
	async update<T = Record<string, unknown>>(
		entity: string,
		id: number | string,
		data: Record<string, unknown>,
	): Promise<T> {
		const url = `${this.baseUrl}/data/${entity}/${id}`;
		const res = await fetch(url, {
			method: "PUT",
			headers: { ...this.headers, "Content-Type": "application/json" },
			body: JSON.stringify(data),
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.error || `Failed to update ${entity}/${id}: ${res.status}`);
		}

		const json = await res.json();
		return json.data;
	}

	/**
	 * Delete a row by ID.
	 */
	async delete(entity: string, id: number | string): Promise<void> {
		const url = `${this.baseUrl}/data/${entity}/${id}`;
		const res = await fetch(url, {
			method: "DELETE",
			headers: this.headers,
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.error || `Failed to delete ${entity}/${id}: ${res.status}`);
		}
	}

	/**
	 * List related child records via a reverse relation.
	 * Example: listRelated("posts", 1, "comments") → all comments where post_id = 1
	 */
	async listRelated<T = Record<string, unknown>>(
		entity: string,
		id: number | string,
		relation: string,
		options: ListOptions = {},
	): Promise<PaginatedResponse<T>> {
		const params = new URLSearchParams();
		if (options.page) params.set("page", String(options.page));
		if (options.limit) params.set("limit", String(options.limit));
		if (options.sort) params.set("sort", options.sort);
		if (options.order) params.set("order", options.order);
		if (options.filter) {
			for (const [key, value] of Object.entries(options.filter)) {
				if (value !== null && typeof value === "object" && !Array.isArray(value)) {
					for (const [op, opVal] of Object.entries(value as FilterOperator)) {
						if (op === "in" && Array.isArray(opVal)) {
							params.set(`filter[${key}][in]`, (opVal as (string | number)[]).join(","));
						} else if (opVal !== undefined) {
							params.set(`filter[${key}][${op}]`, String(opVal));
						}
					}
				} else {
					params.set(`filter[${key}]`, String(value));
				}
			}
		}

		const qs = params.toString();
		const url = `${this.baseUrl}/data/${entity}/${id}/${relation}${qs ? `?${qs}` : ""}`;
		const res = await fetch(url, { headers: this.headers });

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.error || `Failed to list ${entity}/${id}/${relation}: ${res.status}`);
		}

		return await res.json();
	}

	/**
	 * Create a child record under a parent, auto-injecting the parent FK.
	 * Example: createRelated("posts", 1, "comments", { text: "Great!" }) → comment with post_id = 1
	 */
	async createRelated<T = Record<string, unknown>>(
		entity: string,
		id: number | string,
		relation: string,
		data: Record<string, unknown>,
	): Promise<T> {
		const url = `${this.baseUrl}/data/${entity}/${id}/${relation}`;
		const res = await fetch(url, {
			method: "POST",
			headers: { ...this.headers, "Content-Type": "application/json" },
			body: JSON.stringify(data),
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.error || `Failed to create ${entity}/${id}/${relation}: ${res.status}`);
		}

		const json = await res.json();
		return json.data;
	}

	/**
	 * Delete a row with cascade impact information.
	 * Use dryRun: true to preview what would be affected without deleting.
	 */
	async deleteWithInfo(
		entity: string,
		id: number | string,
		options?: { dryRun?: boolean },
	): Promise<{
		deleted?: boolean;
		dryRun?: boolean;
		cascadeInfo?: Record<string, { count: number; action: string }>;
		wouldAffect?: Record<string, { count: number; action: string }>;
	}> {
		const params = new URLSearchParams();
		if (options?.dryRun) params.set("dryRun", "true");
		const qs = params.toString();
		const url = `${this.baseUrl}/data/${entity}/${id}${qs ? `?${qs}` : ""}`;
		const res = await fetch(url, {
			method: "DELETE",
			headers: this.headers,
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.error || `Failed to delete ${entity}/${id}: ${res.status}`);
		}

		return await res.json();
	}

	/**
	 * Subscribe to real-time data changes for an entity via SSE.
	 * Returns an unsubscribe function that closes the connection.
	 *
	 * EventSource cannot send custom headers, so auth is passed via query params:
	 * - API key → ?apiKey=xxx
	 * - End-user token → ?token=xxx (retrieved from localStorage)
	 */
	subscribe<T = Record<string, unknown>>(
		entity: string,
		optionsOrCallback: SubscribeOptions | ((event: DataChangeEvent<T>) => void),
		maybeCallback?: (event: DataChangeEvent<T>) => void,
	): () => void {
		const options = typeof optionsOrCallback === "function" ? {} : optionsOrCallback;
		const callback = typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback!;
		const filter = options.filter;

		// Build URL with auth via query params (EventSource can't send headers)
		const params = new URLSearchParams({ entities: entity });
		const apiKey = this.headers["X-Vibexe-Api-Key"];
		if (apiKey) {
			params.set("apiKey", apiKey);
		} else if (typeof localStorage !== "undefined") {
			const token = localStorage.getItem("vibexe_session");
			if (token) params.set("token", token);
		}

		const url = `${this.baseUrl}/data/subscribe?${params}`;
		const es = new EventSource(url);

		es.onmessage = (e) => {
			try {
				const event = JSON.parse(e.data) as DataChangeEvent<T>;
				// Skip the initial "connected" event
				if ((event as Record<string, unknown>).type === "connected") return;

				// Client-side filter matching
				if (filter && event.action !== "deleted") {
					const record = event.record as Record<string, unknown>;
					const matches = Object.entries(filter).every(
						([key, val]) => record[key] === val,
					);
					if (!matches) return;
				}

				callback(event);
			} catch {
				// Ignore malformed events
			}
		};

		return () => {
			es.close();
		};
	}

	/**
	 * Bulk create multiple rows in a single request.
	 * Uses a database transaction for atomicity.
	 */
	async createMany<T = Record<string, unknown>>(
		entity: string,
		records: Record<string, unknown>[],
	): Promise<{ created: number; data: T[] }> {
		const url = `${this.baseUrl}/data/${entity}/batch`;
		const res = await fetch(url, {
			method: "POST",
			headers: { ...this.headers, "Content-Type": "application/json" },
			body: JSON.stringify({ records }),
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.error || `Failed to batch create ${entity}: ${res.status}`);
		}

		return await res.json();
	}

	/**
	 * Bulk update multiple rows in a single request.
	 * Each item must include `id` and `data` with the fields to update.
	 */
	async updateMany<T = Record<string, unknown>>(
		entity: string,
		updates: Array<{ id: number | string; data: Record<string, unknown> }>,
	): Promise<{ updated: number; errors: number; results: Array<{ id: number | string; success: boolean; data?: T; error?: string }> }> {
		const url = `${this.baseUrl}/data/${entity}/batch`;
		const res = await fetch(url, {
			method: "PUT",
			headers: { ...this.headers, "Content-Type": "application/json" },
			body: JSON.stringify({ updates }),
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.error || `Failed to batch update ${entity}: ${res.status}`);
		}

		return await res.json();
	}

	/**
	 * Bulk delete multiple rows by IDs in a single request.
	 */
	async deleteMany(
		entity: string,
		ids: (number | string)[],
	): Promise<{ deleted: number }> {
		const url = `${this.baseUrl}/data/${entity}/batch`;
		const res = await fetch(url, {
			method: "DELETE",
			headers: { ...this.headers, "Content-Type": "application/json" },
			body: JSON.stringify({ ids }),
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.error || `Failed to batch delete ${entity}: ${res.status}`);
		}

		return await res.json();
	}

	/**
	 * Aggregate data with grouping and statistics.
	 */
	async aggregate(
		entity: string,
		options: AggregateOptions = {},
	): Promise<AggregateResponse> {
		const params = new URLSearchParams();
		if (options.group) params.set("group", options.group);
		if (options.count) params.set("count", "true");
		if (options.sum) params.set("sum", options.sum);
		if (options.avg) params.set("avg", options.avg);
		if (options.min) params.set("min", options.min);
		if (options.max) params.set("max", options.max);
		if (options.filter) {
			for (const [key, value] of Object.entries(options.filter)) {
				if (value !== null && typeof value === "object" && !Array.isArray(value)) {
					for (const [op, opVal] of Object.entries(value as FilterOperator)) {
						if (op === "in" && Array.isArray(opVal)) {
							params.set(`filter[${key}][in]`, (opVal as (string | number)[]).join(","));
						} else if (opVal !== undefined) {
							params.set(`filter[${key}][${op}]`, String(opVal));
						}
					}
				} else {
					params.set(`filter[${key}]`, String(value));
				}
			}
		}

		const qs = params.toString();
		const url = `${this.baseUrl}/data/${entity}/aggregate${qs ? `?${qs}` : ""}`;
		const res = await fetch(url, { headers: this.headers });

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.error || `Failed to aggregate ${entity}: ${res.status}`);
		}

		return await res.json();
	}
}
