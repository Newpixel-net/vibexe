import * as Sentry from "@sentry/nextjs";

export async function register() {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		await import("./sentry.server.config");
		// Load AI provider API keys from database into process.env
		const { loadProviderKeysIntoEnv } = await import("@/lib/ai-provider-keys");
		await loadProviderKeysIntoEnv();
	}

	if (process.env.NEXT_RUNTIME === "edge") {
		await import("./sentry.edge.config");
	}

	process.env.LANGFUSE_TRACING_ENVIRONMENT =
		process.env.VERCEL_ENV || "development";
}
export const onRequestError = Sentry.captureRequestError;
