/**
 * Vibexe Webhooks Client
 *
 * Manage webhook endpoints via the Vibexe REST API.
 */

export interface WebhookConfig {
	url: string;
	events: string[];
	description?: string;
	secret?: string;
	headers?: Record<string, string>;
}

export interface Webhook {
	dbId: number;
	url: string;
	description: string | null;
	events: string[];
	secret: string | null;
	headers: Record<string, string>;
	enabled: boolean;
	lastDeliveryAt: string | null;
	lastDeliveryOk: boolean | null;
	deliverySuccessCount: number;
	deliveryFailureCount: number;
	createdAt: string;
}

export class WebhooksClient {
	private baseUrl: string;
	private headers: Record<string, string>;

	constructor(baseUrl: string, headers: Record<string, string>) {
		this.baseUrl = baseUrl;
		this.headers = headers;
	}

	/** Create a new webhook */
	async create(config: WebhookConfig): Promise<Webhook> {
		const res = await fetch(`${this.baseUrl}/webhooks`, {
			method: "POST",
			headers: { ...this.headers, "Content-Type": "application/json" },
			body: JSON.stringify(config),
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(
				(err as Record<string, string>).error ||
					`Failed to create webhook: ${res.status}`,
			);
		}

		const json = await res.json();
		return (json as { webhook: Webhook }).webhook;
	}

	/** List all webhooks for this app */
	async list(): Promise<{ webhooks: Webhook[] }> {
		const res = await fetch(`${this.baseUrl}/webhooks`, {
			headers: this.headers,
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(
				(err as Record<string, string>).error ||
					`Failed to list webhooks: ${res.status}`,
			);
		}

		return res.json();
	}

	/** Delete a webhook by ID */
	async delete(webhookDbId: number): Promise<void> {
		const res = await fetch(`${this.baseUrl}/webhooks`, {
			method: "DELETE",
			headers: { ...this.headers, "Content-Type": "application/json" },
			body: JSON.stringify({ webhookDbId }),
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(
				(err as Record<string, string>).error ||
					`Failed to delete webhook: ${res.status}`,
			);
		}
	}
}
