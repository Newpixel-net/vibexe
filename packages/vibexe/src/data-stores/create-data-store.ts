import {
	type DataStoreProvider,
	parseConfiguration,
} from "@vibexe-ai/data-store-registry";
import { DataStore, DataStoreId } from "@vibexe-ai/protocol";
import type { VibexeContext } from "../types";
import { dataStorePath } from "./paths";

export async function createDataStore({
	context,
	provider,
	configuration,
}: {
	context: VibexeContext;
	provider: DataStoreProvider;
	configuration: DataStore["configuration"];
}): Promise<DataStore> {
	const validatedConfiguration = parseConfiguration(provider, configuration);
	const dataStoreId = DataStoreId.generate();
	const dataStore: DataStore = {
		id: dataStoreId,
		provider,
		configuration: validatedConfiguration,
	};

	await context.storage.setJson({
		path: dataStorePath(dataStoreId),
		data: dataStore,
		schema: DataStore,
	});

	return dataStore;
}
