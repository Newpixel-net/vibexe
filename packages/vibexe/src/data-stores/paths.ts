import type { DataStoreId } from "@vibexe-ai/protocol";

export function dataStorePath(dataStoreId: DataStoreId) {
	return `data-stores/${dataStoreId}/data-store.json`;
}
