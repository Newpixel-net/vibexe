import type { KnipConfig } from "knip";

const config: KnipConfig = {
	biome: false,
	ignoreIssues: {
		"apps/studio.giselles.ai/emails/**/*.tsx": ["duplicates"],
		// App builder is a new feature under development - ignore all issues
		"apps/studio.giselles.ai/app/\\(main\\)/app-builder/**": [
			"files",
			"exports",
			"types",
		],
		// Session management utilities exported for runtime use
		"apps/studio.giselles.ai/lib/session-store.ts": ["exports", "types"],
		// Auth utilities exported for runtime use
		"apps/studio.giselles.ai/lib/auth/get-user.ts": ["types"],
		// UI components exported for composition
		"apps/studio.giselles.ai/components/ui/scroll-area.tsx": ["exports"],
		// Utility functions exported for runtime use
		"apps/studio.giselles.ai/lib/utils.ts": ["exports"],
	},
	workspaces: {
		"apps/playground": {
			ignoreDependencies: [
				"@aws-sdk/client-s3",
				"happy-dom",
				"jsdom",
				"pg",
			],
		},
		"apps/studio.giselles.ai": {
			entry: ["emails/**/*.tsx"],
			ignore: [
				"scripts/**",
				"trigger.config.ts",
				"trigger/investigate-private-key-job.ts",
			],
			// Ignore deps that are resolved dynamically in next.config or used only at build/runtime
			ignoreDependencies: [
				"@aws-sdk/client-s3",
				"@embedpdf/pdfium",
				"import-in-the-middle",
				"require-in-the-middle",
				"@react-email/preview-server",
				"pino-pretty",
				"prettier",
				"shiki",
				// Disabled for self-hosted mode
				"@vercel/edge-config",
			],
		},
		"apps/ui.giselles.ai": {
			ignoreDependencies: ["tailwindcss"],
		},
		"internal-packages/ui": {
			ignoreDependencies: ["tailwindcss"],
		},
		"internal-packages/workflow-designer-ui": {
			ignoreDependencies: ["tailwindcss"],
			ignore: [
				// Not currently used in the product, but kept as a reference implementation for future use
				"src/editor/properties-panel/content-generation-node-properties-panel/**/*",
				// Will be used in the future
				"src/editor/properties-panel/app-entry-node-properties-panel/app-icon-select.tsx",
			],
		},
		"packages/rag": {
			ignore: ["src/chunker/__fixtures__/code-sample.ts"],
		},
	},
	ignore: ["turbo/generators/config.ts", ".github/**"],
	ignoreBinaries: ["vercel"],
};

export default config;
