/**
 * Vibexe Data Client
 *
 * CRUD operations for app entities via the Vibexe REST API.
 * Each entity maps to a PostgreSQL table with auto-generated endpoints.
 */

export interface ListOptions {
	page?: number;
	limit?: number;
	sort?: string;
	order?: "asc" | "desc";
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
				params.set(`filter[${key}]`, String(value));
			}
		}

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
	): Promise<T> {
		const url = `${this.baseUrl}/data/${entity}/${id}`;
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
}
