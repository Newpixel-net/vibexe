import * as vm from "node:vm";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

interface CustomNodeContent {
	customNodeName: string;
	executeCode: string;
	properties?: Record<string, unknown>;
	inputs?: Array<{ name: string; displayName: string; type: string }>;
	outputs?: Array<{ name: string; displayName: string; type: string }>;
}

// ---- Static analysis — reject dangerous patterns before VM execution ----

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
			return `Custom node contains a potential infinite loop pattern: ${pattern.source}`;
		}
	}
	if (/\brequire\s*\(/.test(code) || /\bprocess\b/.test(code)) {
		return "Custom node cannot use require() or access process";
	}
	if (/\.constructor\s*\.\s*constructor/.test(code)) {
		return "Custom node cannot access constructor chain (sandbox violation)";
	}
	if (/\bimport\s*\(/.test(code)) {
		return "Custom node cannot use dynamic import()";
	}
	return null;
}

// ---- SSRF protection — block requests to internal/private networks ----

const BLOCKED_HOSTS = new Set([
	"localhost",
	"127.0.0.1",
	"[::1]",
	"0.0.0.0",
	"metadata.google.internal",
	"169.254.169.254", // AWS/GCP metadata endpoint
]);

function isPrivateIP(hostname: string): boolean {
	const parts = hostname.split(".").map(Number);
	if (parts.length === 4 && parts.every((p) => !Number.isNaN(p))) {
		if (parts[0] === 10) return true;
		if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
		if (parts[0] === 192 && parts[1] === 168) return true;
		if (parts[0] === 127) return true;
		if (parts[0] === 0) return true;
	}
	return false;
}

/** Maximum executeCode size (100 KB) — prevents CPU exhaustion */
const MAX_SOURCE_SIZE = 100 * 1024;

/**
 * Execute a Custom Node: run user-defined executeCode in a sandboxed vm context.
 * The code receives an ExecutionContext with inputs, properties, node info, and helpers.
 */
export async function executeCustomNode(
	node: DagNode,
	inputData: Map<string, unknown>,
): Promise<DagNodeResult> {
	const content = node.operationNode.content as CustomNodeContent;

	if (!content.executeCode) {
		throw new Error("Custom node has no executeCode defined");
	}

	// 0. Source size check
	if (content.executeCode.length > MAX_SOURCE_SIZE) {
		throw new Error(`Custom node code exceeds maximum size (${MAX_SOURCE_SIZE} bytes)`);
	}

	// 1. Static analysis — reject dangerous patterns
	const danger = checkForDangerousCode(content.executeCode);
	if (danger) {
		throw new Error(danger);
	}

	// Build input data object
	const inputs: Record<string, unknown> = {};
	for (const [key, value] of inputData) {
		inputs[key] = value;
	}

	// Build properties from content
	const properties: Record<string, unknown> = content.properties ?? {};

	// Capture console output (capped at 10 KB to prevent memory exhaustion)
	const MAX_LOG_BYTES = 10 * 1024;
	let logBytes = 0;
	const logs: string[] = [];

	// Build the execution context matching the SDK's ExecutionContext interface
	const executionContext = {
		inputs,
		properties,
		node: {
			id: node.nodeId,
			name: node.operationNode.name ?? node.nodeId,
		},
		helpers: {
			httpRequest: async (
				url: string,
				options?: {
					method?: string;
					headers?: Record<string, string>;
					body?: unknown;
				},
			) => {
				// SSRF protection: block internal/private addresses
				let parsed: URL;
				try {
					parsed = new URL(url);
				} catch {
					throw new Error(`Invalid URL: ${url}`);
				}
				if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
					throw new Error(`Blocked: fetch only supports http/https (got ${parsed.protocol})`);
				}
				if (BLOCKED_HOSTS.has(parsed.hostname) || isPrivateIP(parsed.hostname)) {
					throw new Error(`Blocked: cannot fetch internal/private address ${parsed.hostname}`);
				}

				const fetchOptions: RequestInit = {
					method: options?.method ?? "GET",
					headers: options?.headers,
				};
				if (options?.body) {
					fetchOptions.body =
						typeof options.body === "string"
							? options.body
							: JSON.stringify(options.body);
					if (!options?.headers?.["Content-Type"]) {
						(fetchOptions.headers as Record<string, string>)["Content-Type"] =
							"application/json";
					}
				}
				const response = await fetch(url, fetchOptions);
				const responseHeaders: Record<string, string> = {};
				response.headers.forEach((v, k) => {
					responseHeaders[k] = v;
				});
				let body: unknown;
				const contentType = response.headers.get("content-type") ?? "";
				if (contentType.includes("application/json")) {
					body = await response.json();
				} else {
					body = await response.text();
				}
				return {
					status: response.status,
					headers: responseHeaders,
					body,
				};
			},
			log: (message: string) => {
				if (logBytes < MAX_LOG_BYTES) {
					logs.push(message);
					logBytes += message.length;
				}
			},
		},
	};

	// Create sandboxed context
	const sandbox: Record<string, unknown> = {
		context: executionContext,
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
		parseInt,
		parseFloat,
		isNaN: Number.isNaN,
		isFinite: Number.isFinite,
		console: {
			log: (...args: unknown[]) => {
				if (logBytes >= MAX_LOG_BYTES) return;
				const line = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
				logs.push(line);
				logBytes += line.length;
			},
			warn: (...args: unknown[]) => {
				if (logBytes >= MAX_LOG_BYTES) return;
				const line = `[WARN] ${args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")}`;
				logs.push(line);
				logBytes += line.length;
			},
			error: (...args: unknown[]) => {
				if (logBytes >= MAX_LOG_BYTES) return;
				const line = `[ERROR] ${args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")}`;
				logs.push(line);
				logBytes += line.length;
			},
		},
		fetch: executionContext.helpers.httpRequest,
		__result: undefined as unknown,
		__error: undefined as unknown,
		__done: false,
	};

	// Freeze context objects to prevent prototype pollution
	Object.freeze(executionContext);
	Object.freeze(executionContext.inputs);
	Object.freeze(executionContext.properties);
	Object.freeze(executionContext.node);
	Object.freeze(executionContext.helpers);

	const vmContext = vm.createContext(sandbox);

	// Block constructor-chain sandbox escapes
	// In node:vm, `({}).constructor.constructor('return process')()` escapes the sandbox.
	const sandboxSetup = new vm.Script(`
		(function() {
			'use strict';
			var _Fn = Function;
			Object.defineProperty(_Fn.prototype, 'constructor', {
				get: function() { throw new Error('Sandbox: Function constructor access is blocked'); },
				set: function() {},
				configurable: false
			});
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

	// The executeCode is expected to be an async function expression that takes context
	// .catch() is critical: without it, async errors are silently swallowed
	// and __result stays undefined until timeout (same pattern as execute-code.ts)
	const wrappedCode = `
		(async () => {
			const executeFn = ${content.executeCode};
			return await executeFn(context);
		})().then(r => { __result = r; __done = true; }).catch(e => { __error = e; __done = true; });
	`;

	const script = new vm.Script(wrappedCode, {
		filename: `custom-node-${content.customNodeName ?? "unknown"}.js`,
	});

	const timeout = 30000; // 30s timeout for custom nodes

	try {
		script.runInContext(vmContext, { timeout });

		// Wait for async result using __done flag (not __result === undefined,
		// because user code may legitimately return undefined)
		const startTime = Date.now();
		while (
			!sandbox.__done &&
			Date.now() - startTime < timeout
		) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		// If async code threw an error, surface it immediately
		if (sandbox.__error !== undefined) {
			const asyncErr = sandbox.__error;
			const errMsg = asyncErr instanceof Error ? asyncErr.message : String(asyncErr);
			throw new Error(errMsg);
		}

		// If code didn't complete within the timeout, throw rather than silently returning undefined
		if (!sandbox.__done) {
			throw new Error(`Custom node execution timed out after ${timeout}ms`);
		}

		const result = sandbox.__result;

		// Build output map from result object
		const outputs = new Map<string, unknown>();

		if (result && typeof result === "object" && !Array.isArray(result)) {
			// Result is an object keyed by output port name
			for (const [key, value] of Object.entries(
				result as Record<string, unknown>,
			)) {
				outputs.set(key, value);
			}
		} else {
			// Single return value goes to "output" port
			outputs.set("output", result);
		}

		if (logs.length > 0) {
			outputs.set("_logs", logs);
		}

		return { outputs };
	} catch (error) {
		const errMsg =
			error instanceof Error ? error.message : "Custom node execution failed";
		throw new Error(
			`Custom node "${content.customNodeName}" execution failed: ${errMsg}`,
		);
	}
}
