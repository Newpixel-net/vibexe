import { parseConfiguration } from "@vibexe-ai/data-store-registry";
import { DataStore, type DataStoreId } from "@vibexe-ai/protocol";
import type { VibexeContext } from "../types";
import { dataStorePath } from "./paths";

export async function updateDataStore({
	context,
	dataStoreId,
	configuration,
}: {
	context: VibexeContext;
	dataStoreId: DataStoreId;
	configuration: DataStore["configuration"];
}): Promise<DataStore> {
	const path = dataStorePath(dataStoreId);

	const exists = await context.storage.exists(path);
	if (!exists) {
		throw new Error(`DataStore not found: ${dataStoreId}`);
	}

	const existingDataStore = await context.storage.getJson({
		path,
		schema: DataStore,
	});

	// Merge and validate configuration against provider schema
	const mergedConfiguration = {
		...existingDataStore.configuration,
		...configuration,
	};
	const validatedConfiguration = parseConfiguration(
		existingDataStore.provider,
		mergedConfiguration,
	);

	const updatedDataStore: DataStore = {
		...existingDataStore,
		configuration: validatedConfiguration,
	};

	await context.storage.setJson({
		path,
		data: updatedDataStore,
		schema: DataStore,
	});

	return updatedDataStore;
}
