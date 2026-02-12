/**
 * Vector Store Provider Interface
 *
 * Abstraction layer for external vector databases.
 * Providers implement this interface to be pluggable.
 */

export interface VectorEntry {
	id: string;
	vector: number[];
	metadata?: Record<string, unknown>;
	content?: string;
}

export interface VectorResult {
	id: string;
	score: number;
	metadata?: Record<string, unknown>;
	content?: string;
}

export interface VectorStoreProvider {
	name: string;

	/** Upsert vectors into a collection/index */
	upsert(collection: string, entries: VectorEntry[]): Promise<void>;

	/** Query vectors by similarity */
	query(
		collection: string,
		vector: number[],
		topK: number,
	): Promise<VectorResult[]>;

	/** Delete an entire collection/index */
	deleteCollection(collection: string): Promise<void>;

	/** Check if the provider is properly configured */
	isConfigured(): boolean;
}

export interface VectorStoreProviderConfig {
	type: "internal" | "pinecone" | "qdrant";
	apiKey?: string;
	endpoint?: string;
	indexName?: string;
	namespace?: string;
}
