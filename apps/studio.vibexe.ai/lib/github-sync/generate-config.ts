/**
 * Generate .vibexe/config.json — Platform metadata for the app.
 */

import type { AppSchema } from "@/lib/app-database/schema-types";

interface GenerateConfigOptions {
	appId: string;
	appName: string;
	schema: AppSchema | null;
	apiOrigin: string;
}

export function generateConfig(options: GenerateConfigOptions): string {
	const config = {
		platform: "vibexe",
		version: "1.0.0",
		appId: options.appId,
		appName: options.appName,
		apiOrigin: options.apiOrigin,
		schema: options.schema ?? { version: 0, entities: [] },
		generatedAt: new Date().toISOString(),
	};

	return JSON.stringify(config, null, 2);
}
