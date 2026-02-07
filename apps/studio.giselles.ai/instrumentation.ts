import * as Sentry from "@sentry/nextjs";

export async function register() {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		await import("./sentry.server.config");
		// Load AI provider API keys from database into process.env
		const { loadProviderKeysIntoEnv } = await import("@/lib/ai-provider-keys");
		await loadProviderKeysIntoEnv();

		// Override the default AI SDK global provider to prevent Vercel AI Gateway usage.
		// AI SDK v5 defaults to the Vercel AI Gateway when resolving string model IDs,
		// which fails without AI_GATEWAY_API_KEY. This registers direct providers instead.
		const { createProviderRegistry } = await import("ai");
		const { openai } = await import("@ai-sdk/openai");
		const { anthropic } = await import("@ai-sdk/anthropic");
		const { google } = await import("@ai-sdk/google");
		(globalThis as any).AI_SDK_DEFAULT_PROVIDER = createProviderRegistry({
			openai,
			anthropic,
			google,
		});
		console.log("[instrumentation] Registered direct AI providers as global default (bypassing Vercel AI Gateway)");
	}

	if (process.env.NEXT_RUNTIME === "edge") {
		await import("./sentry.edge.config");
	}

	process.env.LANGFUSE_TRACING_ENVIRONMENT =
		process.env.VERCEL_ENV || "development";
}
export const onRequestError = Sentry.captureRequestError;
