/**
 * Qdrant Vector Store Provider
 *
 * Uses the Qdrant REST API for vector operations.
 * Requires: QDRANT_URL and optionally QDRANT_API_KEY.
 */

import type {
	VectorEntry,
	VectorResult,
	VectorStoreProvider,
} from "./types";

interface QdrantConfig {
	url: string; // e.g., "http://localhost:6333" or "https://my-cluster.qdrant.io"
	apiKey?: string;
}

export class QdrantProvider implements VectorStoreProvider {
	name = "qdrant";
	private config: QdrantConfig;

	constructor(config: QdrantConfig) {
		this.config = config;
	}

	isConfigured(): boolean {
		return !!this.config.url;
	}

	private headers(): Record<string, string> {
		const h: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (this.config.apiKey) {
			h["api-key"] = this.config.apiKey;
		}
		return h;
	}

	private async ensureCollection(
		collection: string,
		vectorSize: number,
	): Promise<void> {
		// Check if collection exists
		const checkRes = await fetch(
			`${this.config.url}/collections/${collection}`,
			{ headers: this.headers() },
		);

		if (checkRes.status === 404) {
			// Create collection
			const createRes = await fetch(
				`${this.config.url}/collections/${collection}`,
				{
					method: "PUT",
					headers: this.headers(),
					body: JSON.stringify({
						vectors: {
							size: vectorSize,
							distance: "Cosine",
						},
					}),
				},
			);
			if (!createRes.ok) {
				const text = await createRes.text();
				throw new Error(
					`Qdrant create collection failed: ${createRes.status} ${text}`,
				);
			}
		}
	}

	async upsert(collection: string, entries: VectorEntry[]): Promise<void> {
		if (entries.length === 0) return;

		await this.ensureCollection(collection, entries[0].vector.length);

		const points = entries.map((entry) => ({
			id: entry.id,
			vector: entry.vector,
			payload: {
				...entry.metadata,
				...(entry.content ? { content: entry.content } : {}),
			},
		}));

		const response = await fetch(
			`${this.config.url}/collections/${collection}/points`,
			{
				method: "PUT",
				headers: this.headers(),
				body: JSON.stringify({ points }),
			},
		);

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Qdrant upsert failed: ${response.status} ${text}`);
		}
	}

	async query(
		collection: string,
		vector: number[],
		topK: number,
	): Promise<VectorResult[]> {
		const response = await fetch(
			`${this.config.url}/collections/${collection}/points/search`,
			{
				method: "POST",
				headers: this.headers(),
				body: JSON.stringify({
					vector,
					limit: topK,
					with_payload: true,
				}),
			},
		);

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Qdrant query failed: ${response.status} ${text}`);
		}

		const data = await response.json();
		return (data.result ?? []).map(
			(point: { id: string; score: number; payload?: Record<string, unknown> }) => ({
				id: String(point.id),
				score: point.score,
				metadata: point.payload,
				content: point.payload?.content as string | undefined,
			}),
		);
	}

	async deleteCollection(collection: string): Promise<void> {
		const response = await fetch(
			`${this.config.url}/collections/${collection}`,
			{
				method: "DELETE",
				headers: this.headers(),
			},
		);

		if (!response.ok && response.status !== 404) {
			const text = await response.text();
			throw new Error(`Qdrant delete failed: ${response.status} ${text}`);
		}
	}
}
