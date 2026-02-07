import * as Sentry from "@sentry/nextjs";

export async function register() {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		await import("./sentry.server.config");
		// Load AI provider API keys from database into process.env
		const { loadProviderKeysIntoEnv } = await import("@/lib/ai-provider-keys");
		await loadProviderKeysIntoEnv();

		// Override the default AI SDK global provider to prevent Vercel AI Gateway usage.
		// AI SDK v5 defaults to the Vercel AI Gateway when resolving string model IDs,
		// which fails without AI_GATEWAY_API_KEY. Replace with a provider that gives
		// a clear error instead of a confusing GatewayAuthenticationError.
		const noGatewayProvider = {
			languageModel(modelId: string) {
				throw new Error(
					`Cannot resolve string model "${modelId}" via AI Gateway (not configured). ` +
					`Use direct provider imports (e.g. openai("gpt-4o")) instead of string model IDs.`
				);
			},
			textEmbeddingModel(modelId: string) {
				throw new Error(
					`Cannot resolve string embedding model "${modelId}" via AI Gateway (not configured). ` +
					`Use direct provider imports instead of string model IDs.`
				);
			},
			imageModel(modelId: string) {
				throw new Error(
					`Cannot resolve string image model "${modelId}" via AI Gateway (not configured). ` +
					`Use direct provider imports instead of string model IDs.`
				);
			},
		};
		(globalThis as any).AI_SDK_DEFAULT_PROVIDER = noGatewayProvider;
		console.log("[instrumentation] Disabled Vercel AI Gateway (replaced with direct-provider-only fallback)");
	}

	if (process.env.NEXT_RUNTIME === "edge") {
		await import("./sentry.edge.config");
	}

	process.env.LANGFUSE_TRACING_ENVIRONMENT =
		process.env.VERCEL_ENV || "development";
}
export const onRequestError = Sentry.captureRequestError;
