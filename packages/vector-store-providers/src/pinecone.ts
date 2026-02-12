/**
 * Pinecone Vector Store Provider
 *
 * Uses the Pinecone REST API for vector operations.
 * Requires: PINECONE_API_KEY and PINECONE_ENDPOINT environment variables
 * or config passed via constructor.
 */

import type {
	VectorEntry,
	VectorResult,
	VectorStoreProvider,
} from "./types";

interface PineconeConfig {
	apiKey: string;
	endpoint: string; // e.g., "https://my-index-abc123.svc.pinecone.io"
	namespace?: string;
}

export class PineconeProvider implements VectorStoreProvider {
	name = "pinecone";
	private config: PineconeConfig;

	constructor(config: PineconeConfig) {
		this.config = config;
	}

	isConfigured(): boolean {
		return !!this.config.apiKey && !!this.config.endpoint;
	}

	async upsert(collection: string, entries: VectorEntry[]): Promise<void> {
		const vectors = entries.map((entry) => ({
			id: entry.id,
			values: entry.vector,
			metadata: {
				...entry.metadata,
				...(entry.content ? { content: entry.content } : {}),
			},
		}));

		const response = await fetch(`${this.config.endpoint}/vectors/upsert`, {
			method: "POST",
			headers: {
				"Api-Key": this.config.apiKey,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				vectors,
				namespace: this.config.namespace || collection,
			}),
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Pinecone upsert failed: ${response.status} ${text}`);
		}
	}

	async query(
		collection: string,
		vector: number[],
		topK: number,
	): Promise<VectorResult[]> {
		const response = await fetch(`${this.config.endpoint}/query`, {
			method: "POST",
			headers: {
				"Api-Key": this.config.apiKey,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				vector,
				topK,
				namespace: this.config.namespace || collection,
				includeMetadata: true,
			}),
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Pinecone query failed: ${response.status} ${text}`);
		}

		const data = await response.json();
		return (data.matches ?? []).map(
			(match: { id: string; score: number; metadata?: Record<string, unknown> }) => ({
				id: match.id,
				score: match.score,
				metadata: match.metadata,
				content: match.metadata?.content as string | undefined,
			}),
		);
	}

	async deleteCollection(collection: string): Promise<void> {
		const response = await fetch(`${this.config.endpoint}/vectors/delete`, {
			method: "POST",
			headers: {
				"Api-Key": this.config.apiKey,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				deleteAll: true,
				namespace: this.config.namespace || collection,
			}),
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Pinecone delete failed: ${response.status} ${text}`);
		}
	}
}
