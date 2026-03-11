/**
 * Game Compiler — Server-side esbuild compilation for lightweight runtime.
 *
 * Replaces sandpack's in-browser bundler with server-side esbuild.
 * Produces an optimized IIFE bundle from GameScene3D.ts + modules.
 *
 * Based on the virtual-plugin pattern from builder.ts (deployment pipeline).
 */

import * as esbuild from "esbuild";
import { ALL_MODULE_MANIFESTS } from "@vibexe-ai/vibexe-engine";
import { patchGameFiles } from "./code-patcher";
import { generateRuntimeBootstrap } from "./runtime-bootstrap";

// In-memory LRU cache for compiled bundles
const bundleCache = new Map<string, { bundle: string; timestamp: number }>();
const CACHE_MAX = 50;
const CACHE_TTL = 60_000; // 60s

function normalizePath(p: string): string {
	const parts = p.split("/");
	const out: string[] = [];
	for (const seg of parts) {
		if (seg === "." || seg === "") continue;
		if (seg === "..") {
			if (out.length > 0) out.pop();
		} else {
			out.push(seg);
		}
	}
	return out.join("/");
}

function createVirtualPlugin(files: Map<string, string>): esbuild.Plugin {
	// Shim modules: Three.js + CANNON.js + React as window globals
	const shims: Record<string, string> = {
		three: "module.exports = window.THREE;",
		"cannon-es": "module.exports = window.CANNON;",
		react: "module.exports = window.React || {};",
		"react-dom": "module.exports = window.ReactDOM || {};",
		"react-dom/client": "module.exports = { createRoot: (window.ReactDOM||{}).createRoot };",
		"react/jsx-runtime": "module.exports = { jsx: (window.React||{}).createElement, jsxs: (window.React||{}).createElement, Fragment: (window.React||{}).Fragment };",
		"react/jsx-dev-runtime": "module.exports = { jsxDEV: (window.React||{}).createElement, Fragment: (window.React||{}).Fragment };",
	};

	// Add @vibexe/* module shims from module registry
	for (const mod of ALL_MODULE_MANIFESTS) {
		const pkgName = `@vibexe/${mod.id}`;
		if (!shims[pkgName]) {
			shims[pkgName] = mod.runtimeCode || "module.exports = {};";
		}
	}

	// Also add @vibexe/sdk shim
	shims["@vibexe/sdk"] = `
		var VibexeApp = window.VibexeApp || function(){};
		module.exports = { VibexeApp: VibexeApp, default: VibexeApp };
	`;

	return {
		name: "game-virtual-fs",
		setup(build) {
			// Resolve npm packages (bare imports)
			build.onResolve({ filter: /^[^./]/ }, (args) => {
				if (shims[args.path]) {
					return { path: args.path, namespace: "shim" };
				}
				// Check virtual files (bare paths like "components/Foo")
				for (const ext of ["", ".tsx", ".ts", ".jsx", ".js"]) {
					if (files.has(args.path + ext))
						return { path: args.path + ext, namespace: "virtual" };
				}
				// Unknown package → empty module
				return { path: args.path, namespace: "shim" };
			});

			// Resolve relative imports
			build.onResolve({ filter: /^\./ }, (args) => {
				const dir = args.importer ? args.importer.replace(/[^/]+$/, "") : "";
				const base = normalizePath(dir + args.path);
				const exts = [
					"", ".tsx", ".ts", ".jsx", ".js",
					"/index.tsx", "/index.ts", "/index.jsx", "/index.js",
				];
				for (const ext of exts) {
					if (files.has(base + ext))
						return { path: base + ext, namespace: "virtual" };
				}
				// Try without directory prefix
				const bare = args.path.replace(/^\.\//, "");
				for (const ext of exts) {
					if (files.has(bare + ext))
						return { path: bare + ext, namespace: "virtual" };
				}
				return { path: args.path, namespace: "shim" };
			});

			// Load shim modules
			build.onLoad({ filter: /.*/, namespace: "shim" }, (args) => ({
				contents: shims[args.path] || "module.exports = {};",
				loader: "js" as const,
			}));

			// Load virtual files
			build.onLoad({ filter: /.*/, namespace: "virtual" }, (args) => {
				const content = files.get(args.path);
				if (content === undefined)
					return { errors: [{ text: `Not found: ${args.path}` }] };
				const ext = args.path.split(".").pop() || "tsx";
				const loaders: Record<string, esbuild.Loader> = {
					tsx: "tsx", ts: "ts", jsx: "jsx", js: "js", css: "css",
				};
				return { contents: content, loader: loaders[ext] || "tsx" };
			});
		},
	};
}

function hashContent(content: string): string {
	// Simple hash for cache key
	let hash = 0;
	for (let i = 0; i < content.length; i++) {
		const chr = content.charCodeAt(i);
		hash = ((hash << 5) - hash) + chr;
		hash |= 0;
	}
	return hash.toString(36);
}

export interface CompileInput {
	files: Array<{ path: string; content: string }>;
	settings?: Record<string, unknown>;
	enabledModuleIds?: string[];
	apiOrigin?: string;
	appId?: string;
}

export interface CompileOutput {
	bundle: string;
	bootstrap: string;
	hash: string;
	errors?: string[];
	compiledMs: number;
}

export async function compileGameBundle(input: CompileInput): Promise<CompileOutput> {
	const startMs = Date.now();

	// Build the virtual filesystem
	const files = new Map<string, string>();
	for (const f of input.files) {
		// Normalize path: ensure leading slash removed for consistency
		const key = f.path.startsWith("/") ? f.path.slice(1) : f.path;
		files.set(key, f.content);
	}

	// Parse settings
	const settings = input.settings || {};

	// Apply code patches (inline physics constants, spawn positions, etc.)
	patchGameFiles(files, settings as Parameters<typeof patchGameFiles>[1]);

	// Find entry point
	let entryContent = "";
	let entryPath = "";
	for (const candidate of ["index.tsx", "index.ts", "index.jsx", "index.js"]) {
		if (files.has(candidate)) {
			entryPath = candidate;
			entryContent = files.get(candidate)!;
			break;
		}
	}

	if (!entryContent) {
		return {
			bundle: "",
			bootstrap: "",
			hash: "",
			errors: ["No entry point found (index.tsx/ts/jsx/js)"],
			compiledMs: Date.now() - startMs,
		};
	}

	// Generate cache key from all file contents + settings
	const cacheKey = hashContent(
		JSON.stringify(input.files.map((f) => f.content)) +
		JSON.stringify(settings) +
		JSON.stringify(input.enabledModuleIds || []),
	);

	// Check cache
	const cached = bundleCache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		const bootstrap = generateRuntimeBootstrap({
			apiOrigin: input.apiOrigin,
			appId: input.appId,
			enabledModuleIds: input.enabledModuleIds || [],
			gameSettings: settings,
		});
		return {
			bundle: cached.bundle,
			bootstrap,
			hash: cacheKey,
			compiledMs: Date.now() - startMs,
		};
	}

	// Compile with esbuild
	try {
		const result = await esbuild.build({
			stdin: {
				contents: entryContent,
				loader: entryPath.endsWith(".tsx") ? "tsx" :
					entryPath.endsWith(".ts") ? "ts" :
					entryPath.endsWith(".jsx") ? "jsx" : "js",
				resolveDir: "/",
				sourcefile: entryPath,
			},
			bundle: true,
			format: "iife",
			target: ["es2020"],
			jsx: "transform",
			jsxFactory: "React.createElement",
			jsxFragment: "React.Fragment",
			minify: false, // Keep readable for debugging; enable in production
			write: false,
			plugins: [createVirtualPlugin(files)],
			define: {
				"process.env.NODE_ENV": '"production"',
			},
			logLevel: "silent",
		});

		const bundle = result.outputFiles?.[0]?.text || "";
		const errors = result.errors.map((e) => e.text);

		// Cache the bundle
		if (bundleCache.size >= CACHE_MAX) {
			// Evict oldest entry
			const firstKey = bundleCache.keys().next().value;
			if (firstKey) bundleCache.delete(firstKey);
		}
		bundleCache.set(cacheKey, { bundle, timestamp: Date.now() });

		// Generate bootstrap
		const bootstrap = generateRuntimeBootstrap({
			apiOrigin: input.apiOrigin,
			appId: input.appId,
			enabledModuleIds: input.enabledModuleIds || [],
			gameSettings: settings,
		});

		return {
			bundle,
			bootstrap,
			hash: cacheKey,
			errors: errors.length > 0 ? errors : undefined,
			compiledMs: Date.now() - startMs,
		};
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return {
			bundle: "",
			bootstrap: "",
			hash: "",
			errors: [`Compilation failed: ${msg}`],
			compiledMs: Date.now() - startMs,
		};
	}
}
