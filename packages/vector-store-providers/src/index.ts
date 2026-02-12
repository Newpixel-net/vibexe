export type {
	VectorEntry,
	VectorResult,
	VectorStoreProvider,
	VectorStoreProviderConfig,
} from "./types";

export { PineconeProvider } from "./pinecone";
export { QdrantProvider } from "./qdrant";

import type { VectorStoreProvider, VectorStoreProviderConfig } from "./types";
import { PineconeProvider } from "./pinecone";
import { QdrantProvider } from "./qdrant";

/**
 * Factory function to create a vector store provider from config.
 * Returns null for "internal" type (uses built-in pgvector).
 */
export function createVectorStoreProvider(
	config: VectorStoreProviderConfig,
): VectorStoreProvider | null {
	switch (config.type) {
		case "pinecone":
			if (!config.apiKey || !config.endpoint) return null;
			return new PineconeProvider({
				apiKey: config.apiKey,
				endpoint: config.endpoint,
				namespace: config.namespace,
			});
		case "qdrant":
			if (!config.endpoint) return null;
			return new QdrantProvider({
				url: config.endpoint,
				apiKey: config.apiKey,
			});
		case "internal":
		default:
			return null; // Use built-in pgvector
	}
}
