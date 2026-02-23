/**
 * Serverless Function Runner
 *
 * Executes user TypeScript functions in a sandboxed node:vm context.
 * TypeScript is transpiled to JS via esbuild's transform() API.
 * Functions receive a context object with db, auth, env, fetch, console.
 *
 * Security: No require, process, __dirname, __filename, Buffer, global access.
 * Only safe globals are exposed (JSON, Math, Date, Promise, etc.).
 */

import * as vm from "node:vm";
import { transform } from "esbuild";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { builderFiles, builderApps, builderAppDatabases } from "@/db/schema";
import type { BuilderAppId } from "@/db/schema";
import { logAppEvent } from "@/lib/app-database/app-logger";
import type { AppUser } from "@/lib/app-database/rls";
import { buildFunctionContext, type BuildContextOpts } from "./context";
import { loadAppSecrets } from "./secrets";

// ---- Types ----

export interface ExecuteFunctionOpts {
	appId: string;
	appDbId: number;
	databaseName: string;
	/** Function source code (TypeScript) */
	source: string;
	/** Timeout in milliseconds */
	timeoutMs?: number;
	/** Current user (from auth) */
	user?: AppUser | null;
	/** HTTP request context (for HTTP triggers) */
	request?: BuildContextOpts["request"];
	/** Entity hook context */
	entity?: string;
	record?: Record<string, unknown>;
	hookData?: Record<string, unknown>;
	hookType?: string;
}

export interface ExecuteFunctionResult {
	result: unknown;
	logs: string[];
	durationMs: number;
}

// ---- Transpile ----

async function transpileTS(source: string): Promise<string> {
	const result = await transform(source, {
		loader: "ts",
		format: "esm",
		target: "es2022",
	});
	return result.code;
}

// ---- Static analysis ----

const DANGEROUS_PATTERNS = [
	/\bwhile\s*\(\s*true\s*\)/,     // while(true)
	/\bwhile\s*\(\s*1\s*\)/,         // while(1)
	/\bfor\s*\(\s*;\s*;\s*\)/,       // for(;;)
	/\bfor\s*\(\s*;;\s*\)/,          // for(;;)
	/\bwhile\s*\(\s*!0\s*\)/,        // while(!0)
	/\bwhile\s*\(\s*!false\s*\)/,    // while(!false)
];

function checkForDangerousCode(code: string): string | null {
	for (const pattern of DANGEROUS_PATTERNS) {
		if (pattern.test(code)) {
			return `Function contains a potential infinite loop pattern: ${pattern.source}`;
		}
	}
	// Reject require/import of dangerous modules
	if (/\brequire\s*\(/.test(code) || /\bprocess\b/.test(code)) {
		return "Function cannot use require() or access process";
	}
	// Block constructor-chain sandbox escape attempts
	if (/\.constructor\s*\.\s*constructor/.test(code)) {
		return "Function cannot access constructor chain (sandbox violation)";
	}
	// Block dynamic import()
	if (/\bimport\s*\(/.test(code)) {
		return "Function cannot use dynamic import()";
	}
	return null;
}

// ---- Execute ----

export async function executeFunction(opts: ExecuteFunctionOpts): Promise<ExecuteFunctionResult> {
	const startTime = Date.now();
	const timeoutMs = Math.min(opts.timeoutMs ?? 10000, 30000);
	const consoleLogs: string[] = [];

	// 1. Transpile TS → JS
	let jsCode: string;
	try {
		jsCode = await transpileTS(opts.source);
	} catch (err) {
		throw new Error(`TypeScript compilation failed: ${err instanceof Error ? err.message : String(err)}`);
	}

	// 1.5. Static analysis — reject dangerous patterns
	const danger = checkForDangerousCode(jsCode);
	if (danger) {
		throw new Error(danger);
	}

	// 2. Load app secrets
	const secrets = await loadAppSecrets(opts.appDbId);

	// 3. Build function context
	const ctx = buildFunctionContext({
		databaseName: opts.databaseName,
		user: opts.user ?? null,
		secrets,
		consoleLogs,
		appId: opts.appId,
		request: opts.request,
		entity: opts.entity,
		record: opts.record,
		hookData: opts.hookData,
		hookType: opts.hookType,
	});

	// 4. Create sandbox with safe globals + context
	const sandbox: Record<string, unknown> = {
		// Function context exposed as `ctx`
		ctx,
		// Also expose top-level for convenience
		db: ctx.db,
		auth: ctx.auth,
		env: ctx.env,
		storage: ctx.storage,
		console: ctx.console,
		// HTTP trigger
		request: ctx.request,
		// Entity hook
		entity: ctx.entity,
		record: ctx.record,
		data: ctx.data,
		hookType: ctx.hookType,
		// Safe JS globals
		JSON,
		Math,
		Date,
		String,
		Number,
		Boolean,
		Array,
		Object,
		Map,
		Set,
		RegExp,
		Error,
		TypeError,
		RangeError,
		Promise,
		parseInt,
		parseFloat,
		isNaN,
		isFinite,
		encodeURIComponent,
		decodeURIComponent,
		encodeURI,
		decodeURI,
		atob,
		btoa,
		URL,
		URLSearchParams,
		setTimeout: (() => {
			let timerCount = 0;
			const MAX_TIMERS = 10;
			return (fn: () => void, ms: number) => {
				if (timerCount >= MAX_TIMERS) {
					throw new Error(`Timer limit exceeded (max ${MAX_TIMERS} concurrent timers)`);
				}
				timerCount++;
				return setTimeout(() => { timerCount--; fn(); }, Math.min(ms, 30000));
			};
		})(),
		clearTimeout,
		fetch: ctx.fetch, // Use sandboxed fetch from context (blocks internal IPs)
		// Async completion tracking
		__result: undefined as unknown,
		__error: undefined as unknown,
		__done: false,
	};

	// Freeze context objects to prevent prototype pollution
	Object.freeze(ctx.db);
	Object.freeze(ctx.auth);
	Object.freeze(ctx.env);
	Object.freeze(ctx.console);
	Object.freeze(ctx.storage);
	if (ctx.request) Object.freeze(ctx.request);

	const vmContext = vm.createContext(sandbox);

	// 4.5. Block constructor-chain sandbox escapes
	// In node:vm, `({}).constructor.constructor('return process')()` escapes the sandbox.
	// We redefine Function.prototype.constructor inside the VM context so the chain breaks.
	// Also block eval, Function, and import() to prevent code generation from strings.
	const sandboxSetup = new vm.Script(`
		(function() {
			'use strict';
			// Block Function constructor access (the main escape vector)
			var _Fn = Function;
			Object.defineProperty(_Fn.prototype, 'constructor', {
				get: function() { throw new Error('Sandbox: Function constructor access is blocked'); },
				set: function() {},
				configurable: false
			});
			// Block GeneratorFunction and AsyncFunction constructors
			try {
				var _Gen = Object.getPrototypeOf(function*(){}).constructor;
				Object.defineProperty(_Gen.prototype, 'constructor', {
					get: function() { throw new Error('Sandbox: GeneratorFunction constructor access is blocked'); },
					set: function() {},
					configurable: false
				});
			} catch(e) {}
			try {
				var _Async = Object.getPrototypeOf(async function(){}).constructor;
				Object.defineProperty(_Async.prototype, 'constructor', {
					get: function() { throw new Error('Sandbox: AsyncFunction constructor access is blocked'); },
					set: function() {},
					configurable: false
				});
			} catch(e) {}
		})();
	`, { filename: "sandbox-setup.js" });
	sandboxSetup.runInContext(vmContext, { timeout: 1000 });

	// 5. Wrap user code in async IIFE
	// esbuild converts `export default async function(ctx)` to:
	//   function stdin_default(ctx) { ... }
	//   export { stdin_default as default };
	// We need to capture the default export name and call it with ctx.
	const processedCode = jsCode
		.replace(/export\s+default\s+/g, "__defaultFn = ")
		.replace(/export\s*\{([^}]*)\}/g, (_match, contents: string) => {
			const defaultMatch = contents.match(/(\w+)\s+as\s+default/);
			if (defaultMatch) {
				return `__defaultFn = ${defaultMatch[1]};`;
			}
			return "";
		});

	const wrappedCode = `
		(async () => {
			let __defaultFn;

			${processedCode}

			if (typeof __defaultFn === 'function') {
				return await __defaultFn(ctx);
			}
			return undefined;
		})().then(r => { __result = r; __done = true; }).catch(e => { __error = e; __done = true; });
	`;

	const script = new vm.Script(wrappedCode, { filename: "user-function.js" });

	// 6. Execute
	try {
		script.runInContext(vmContext, { timeout: timeoutMs });

		// Wait for async completion with a hard timeout via Promise.race
		const waitForCompletion = async (): Promise<void> => {
			const deadline = Date.now() + timeoutMs;
			while (!sandbox.__done && Date.now() < deadline) {
				await new Promise((resolve) => setTimeout(resolve, 50));
			}
		};

		await Promise.race([
			waitForCompletion(),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error(`Function execution timed out after ${timeoutMs}ms`)), timeoutMs + 500),
			),
		]);

		if (sandbox.__error !== undefined) {
			const err = sandbox.__error;
			throw new Error(err instanceof Error ? err.message : String(err));
		}

		if (!sandbox.__done) {
			throw new Error(`Function execution timed out after ${timeoutMs}ms`);
		}

		const durationMs = Date.now() - startTime;

		// Fire-and-forget: log console output
		if (consoleLogs.length > 0) {
			logAppEvent(opts.databaseName, {
				level: "info",
				category: "system",
				eventType: "app.function.log",
				message: consoleLogs.join("\n"),
				metadata: { appId: opts.appId },
			});
		}

		return {
			result: sandbox.__result,
			logs: consoleLogs,
			durationMs,
		};
	} catch (error) {
		const durationMs = Date.now() - startTime;
		const errMsg = error instanceof Error ? error.message : "Function execution failed";

		// Log error
		logAppEvent(opts.databaseName, {
			level: "error",
			category: "system",
			eventType: "app.function.error",
			message: errMsg,
			metadata: { appId: opts.appId, logs: consoleLogs },
		});

		throw new Error(errMsg);
	}
}

// ---- Load function source from builder_files ----

export async function loadFunctionSource(appDbId: number, filePath: string): Promise<string | null> {
	const file = await db.query.builderFiles.findFirst({
		where: and(
			eq(builderFiles.appDbId, appDbId),
			eq(builderFiles.path, filePath),
		),
		columns: { content: true },
	});
	return file?.content ?? null;
}

// ---- Resolve app context for function execution ----

export async function resolveAppContext(appId: string): Promise<{
	appDbId: number;
	databaseName: string;
} | null> {
	const app = await db.query.builderApps.findFirst({
		where: eq(builderApps.id, appId as BuilderAppId),
		columns: { dbId: true },
	});
	if (!app) return null;

	const appDb = await db.query.builderAppDatabases.findFirst({
		where: eq(builderAppDatabases.appDbId, app.dbId),
	});
	if (!appDb || appDb.status !== "active") return null;

	return { appDbId: app.dbId, databaseName: appDb.databaseName };
}
