import { createRequire } from "node:module";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import createBundleAnalyzer from "@next/bundle-analyzer";
import type { SentryBuildOptions } from "@sentry/nextjs";
import type { NextConfig } from "next";

const moduleRequire = createRequire(import.meta.url);
const projectDir = fileURLToPath(new URL(".", import.meta.url));

const pdfiumWasmPath = moduleRequire.resolve("@embedpdf/pdfium/pdfium.wasm");

export const serverExternalPackages = [
	"esbuild",
	"@embedpdf/pdfium",
	"pino",
	"pino-pretty",
	"happy-dom",
	"@activepieces/pieces-framework",
	"@activepieces/pieces-common",
	"@activepieces/shared",
	"@activepieces/piece-slack",
	"@activepieces/piece-google-sheets",
	"@activepieces/piece-gmail",
	"@activepieces/piece-discord",
	"@activepieces/piece-telegram-bot",
	"@activepieces/piece-notion",
	"@activepieces/piece-airtable",
	"@activepieces/piece-openai",
	"@activepieces/piece-google-drive",
	"@activepieces/piece-http",
	"@activepieces/piece-github",
	"@activepieces/piece-stripe",
	"@activepieces/piece-hubspot",
	"@activepieces/piece-mailchimp",
	"@activepieces/piece-google-calendar",
	"@activepieces/piece-dropbox",
	"@activepieces/piece-trello",
	"@activepieces/piece-asana",
	"@activepieces/piece-jira-cloud",
	"@activepieces/piece-sendgrid",
	"@activepieces/piece-zoom",
	"@activepieces/piece-twitter",
	"@activepieces/piece-linkedin",
	"@activepieces/piece-microsoft-teams",
	"@activepieces/piece-microsoft-outlook",
	"@activepieces/piece-salesforce",
	"@activepieces/piece-shopify",
	"@activepieces/piece-wordpress",
	"@activepieces/piece-todoist",
	"@activepieces/piece-clickup",
	"@activepieces/piece-monday",
	"@activepieces/piece-linear",
	"@activepieces/piece-intercom",
	"@activepieces/piece-freshdesk",
	"@activepieces/piece-zendesk",
	"@activepieces/piece-google-contacts",
	"@activepieces/piece-google-forms",
	"@activepieces/piece-typeform",
	"@activepieces/piece-twilio",
	"@activepieces/piece-figma",
	"@activepieces/piece-supabase",
	"@activepieces/piece-postgres",
	"@activepieces/piece-mysql",
	"@activepieces/piece-csv",
	"@activepieces/piece-rss",
	"@activepieces/piece-schedule",
	"@activepieces/piece-webhook",
	"@activepieces/piece-data-mapper",
	"@activepieces/piece-store",
	"@activepieces/piece-connections",
	// Transitive dependencies of @activepieces packages that Turbopack can't resolve
	"pg-format",
	"pg",
	"pg-pool",
	"pg-types",
	"pg-connection-string",
	"pgpass",
	"mysql2",
	"googleapis",
	"google-auth-library",
	"gaxios",
	"gcp-metadata",
	"node-fetch",
];
const pdfiumWasmInclude = relative(projectDir, pdfiumWasmPath).replace(
	/\\/g,
	"/",
);

const pdfiumTracingConfig = {
	outputFileTracingIncludes: {
		"/api/vector-stores/document/[documentVectorStoreId]/documents": [
			pdfiumWasmInclude,
		],
		"/api/vector-stores/cron/document/ingest": [pdfiumWasmInclude],
	},
};

const nextConfig: NextConfig = {
	turbopack: {
		root: join(__dirname, "../../"),
	},
	serverExternalPackages,
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "avatars.githubusercontent.com",
			},
			{
				protocol: "https",
				hostname: "lh3.googleusercontent.com",
			},
			...(process.env.S3_STORAGE_URL
				? [
						{
							protocol: "https" as const,
							hostname: new URL(process.env.S3_STORAGE_URL).hostname,
						},
					]
				: []),
		],
	},
	// biome-ignore lint/suspicious/useAwait: Next.js specification
	async redirects() {
		return [
			{
				source: "/",
				destination: "/dashboard",
				permanent: false,
			},
			{
				source: "/workspaces",
				destination: "/workflows",
				permanent: false,
			},
		];
	},
	// biome-ignore lint/suspicious/useAwait: Next.js specification
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					{
						key: "X-Frame-Options",
						value: "DENY",
					},
					{
						key: "X-DNS-Prefetch-Control",
						value: "on",
					},
					{
						key: "X-XSS-Protection",
						value: "1; mode=block",
					},
					{
						key: "X-Content-Type-Options",
						value: "nosniff",
					},
					{
						key: "Referrer-Policy",
						value: "origin-when-cross-origin",
					},
					{
						key: "X-Accel-Buffering",
						value: "no",
					},
				],
			},
			{
				// Allow preview pages to be iframed from same origin (dashboard carousel)
				source: "/preview/:path*",
				headers: [
					{
						key: "X-Frame-Options",
						value: "SAMEORIGIN",
					},
				],
			},
			{
				// Allow deployed apps to be iframed from same origin (dashboard carousel)
				source: "/apps/:path*",
				headers: [
					{
						key: "X-Frame-Options",
						value: "SAMEORIGIN",
					},
				],
			},
			{
				// CORS for app API routes — called from Sandpack iframe (codesandbox.io origin)
				source: "/api/apps/:path*",
				headers: [
					{ key: "Access-Control-Allow-Origin", value: "*" },
					{ key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
					{ key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Vibexe-Api-Key" },
					{ key: "Access-Control-Max-Age", value: "86400" },
				],
			},
			{
				// CORS for media-stock assets — loaded from Sandpack iframe via Image() with crossOrigin
				source: "/api/app-builder/media-stock/:path*",
				headers: [
					{ key: "Access-Control-Allow-Origin", value: "*" },
					{ key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
					{ key: "Access-Control-Allow-Headers", value: "Content-Type" },
					{ key: "Access-Control-Max-Age", value: "86400" },
				],
			},
		];
	},
	typescript: {
		// Pre-existing type errors from partially-implemented integration node protocol
		// TODO: Remove once integration node types are fully wired up
		ignoreBuildErrors: true,
	},
	experimental: {
		typedEnv: true,
		webpackMemoryOptimizations: true,
		webpackBuildWorker: true,
	},
	...pdfiumTracingConfig,
};

const sentryBuildOptions: SentryBuildOptions = {
	// For all available options, see:
	// https://www.npmjs.com/package/@sentry/webpack-plugin#options

	org: "route06cojp",
	project: "edge",

	// Only print logs for uploading source maps in CI
	silent: !process.env.CI,

	// For all available options, see:
	// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

	// Upload a larger set of source maps for prettier stack traces (increases build time)
	widenClientFileUpload: true,

	// Automatically annotate React components to show their full name in breadcrumbs and session replay
	reactComponentAnnotation: {
		enabled: true,
	},

	// Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
	// This can increase your server load as well as your hosting bill.
	// Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
	// side errors will fail.
	// Turn it off for now. Will reconsider if issues arise.
	// tunnelRoute: "/monitoring",

	// Hides source maps from generated client bundles
	sourcemaps: {
		deleteSourcemapsAfterUpload: true,
	},

	// Automatically tree-shake Sentry logger statements to reduce bundle size
	disableLogger: true,

	// Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
	// See the following for more information:
	// https://docs.sentry.io/product/crons/
	// https://vercel.com/docs/cron-jobs
	automaticVercelMonitors: true,
};

const withAnalyzer = createBundleAnalyzer({
	enabled: process.env.ANALYZE === "true",
});
export default async function () {
	const enableSentry = process.env.VERCEL_ENV !== undefined;
	if (enableSentry) {
		return await import("@sentry/nextjs").then((mod) =>
			withAnalyzer(mod.withSentryConfig(nextConfig, sentryBuildOptions)),
		);
	}
	return withAnalyzer(nextConfig);
}
