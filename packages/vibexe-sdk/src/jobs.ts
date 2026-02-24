/**
 * Vibexe Jobs Client
 *
 * Manage scheduled background jobs via the Vibexe REST API.
 */

export interface RetryPolicy {
	maxRetries: number;
	initialDelayMs: number;
	maxDelayMs: number;
	backoffMultiplier: number;
}

export interface CreateJobInput {
	name: string;
	functionName: string;
	cronExpression: string;
	timezone?: string;
	description?: string;
	retryPolicy?: Partial<RetryPolicy>;
	timeoutMs?: number;
}

export interface UpdateJobInput {
	cronExpression?: string;
	enabled?: boolean;
	retryPolicy?: Partial<RetryPolicy>;
	timeoutMs?: number;
	description?: string;
	functionName?: string;
	timezone?: string;
}

export interface Job {
	id: number;
	name: string;
	description: string;
	function_name: string;
	cron_expression: string;
	timezone: string;
	enabled: boolean;
	retry_policy: RetryPolicy;
	timeout_ms: number;
	last_run_at: string | null;
	next_run_at: string | null;
	run_count: number;
	error_count: number;
	created_at: string;
	updated_at: string;
}

export interface JobRun {
	id: number;
	job_id: number;
	status: "pending" | "running" | "completed" | "failed" | "retrying";
	started_at: string;
	completed_at: string | null;
	duration_ms: number | null;
	result: unknown;
	error: string | null;
	logs: string | null;
	attempt: number;
	manual: boolean;
	created_at: string;
}

export interface DlqEntry {
	id: number;
	job_id: number | null;
	job_name: string;
	error: string;
	last_attempt_at: string;
	attempts: number;
	payload: unknown;
	acknowledged: boolean;
	created_at: string;
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

export class JobsClient {
	private baseUrl: string;
	private headers: Record<string, string>;

	constructor(baseUrl: string, headers: Record<string, string>) {
		this.baseUrl = baseUrl;
		this.headers = headers;
	}

	async create(job: CreateJobInput): Promise<Job> {
		const res = await fetch(`${this.baseUrl}/jobs`, {
			method: "POST",
			headers: { ...this.headers, "Content-Type": "application/json" },
			body: JSON.stringify(job),
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error((err as Record<string, string>).error || "Failed to create job");
		}
		return ((await res.json()) as { data: Job }).data;
	}

	async list(options?: { page?: number; limit?: number }): Promise<PaginatedResponse<Job>> {
		const params = new URLSearchParams();
		if (options?.page) params.set("page", String(options.page));
		if (options?.limit) params.set("limit", String(options.limit));
		const qs = params.toString();
		const res = await fetch(`${this.baseUrl}/jobs${qs ? `?${qs}` : ""}`, {
			headers: this.headers,
		});
		if (!res.ok) throw new Error("Failed to list jobs");
		return (await res.json()) as PaginatedResponse<Job>;
	}

	async get(jobId: number): Promise<Job & { recentRuns: JobRun[] }> {
		const res = await fetch(`${this.baseUrl}/jobs/${jobId}`, {
			headers: this.headers,
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error((err as Record<string, string>).error || "Job not found");
		}
		return ((await res.json()) as { data: Job & { recentRuns: JobRun[] } }).data;
	}

	async update(jobId: number, data: UpdateJobInput): Promise<Job> {
		const res = await fetch(`${this.baseUrl}/jobs/${jobId}`, {
			method: "PUT",
			headers: { ...this.headers, "Content-Type": "application/json" },
			body: JSON.stringify(data),
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error((err as Record<string, string>).error || "Failed to update job");
		}
		return ((await res.json()) as { data: Job }).data;
	}

	async delete(jobId: number): Promise<void> {
		const res = await fetch(`${this.baseUrl}/jobs/${jobId}`, {
			method: "DELETE",
			headers: this.headers,
		});
		if (!res.ok) throw new Error("Failed to delete job");
	}

	async trigger(jobId: number): Promise<{ status: string; durationMs: number; runId: number; error?: string }> {
		const res = await fetch(`${this.baseUrl}/jobs/${jobId}/trigger`, {
			method: "POST",
			headers: this.headers,
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error((err as Record<string, string>).error || "Failed to trigger job");
		}
		return ((await res.json()) as { data: { status: string; durationMs: number; runId: number; error?: string } }).data;
	}

	async runs(
		jobId: number,
		options?: { page?: number; limit?: number; status?: string },
	): Promise<PaginatedResponse<JobRun>> {
		const params = new URLSearchParams();
		if (options?.page) params.set("page", String(options.page));
		if (options?.limit) params.set("limit", String(options.limit));
		if (options?.status) params.set("status", options.status);
		const qs = params.toString();
		const res = await fetch(`${this.baseUrl}/jobs/${jobId}/runs${qs ? `?${qs}` : ""}`, {
			headers: this.headers,
		});
		if (!res.ok) throw new Error("Failed to list job runs");
		return (await res.json()) as PaginatedResponse<JobRun>;
	}

	async dlq(options?: { page?: number; all?: boolean }): Promise<PaginatedResponse<DlqEntry>> {
		const params = new URLSearchParams();
		if (options?.page) params.set("page", String(options.page));
		if (options?.all) params.set("all", "true");
		const qs = params.toString();
		const res = await fetch(`${this.baseUrl}/jobs/dlq${qs ? `?${qs}` : ""}`, {
			headers: this.headers,
		});
		if (!res.ok) throw new Error("Failed to list DLQ");
		return (await res.json()) as PaginatedResponse<DlqEntry>;
	}

	async acknowledgeDlq(dlqId: number): Promise<void> {
		const res = await fetch(`${this.baseUrl}/jobs/dlq`, {
			method: "POST",
			headers: { ...this.headers, "Content-Type": "application/json" },
			body: JSON.stringify({ dlqId }),
		});
		if (!res.ok) throw new Error("Failed to acknowledge DLQ entry");
	}
}
