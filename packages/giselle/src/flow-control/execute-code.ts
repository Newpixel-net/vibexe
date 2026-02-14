import type { CodeNodeContent } from "@giselles-ai/protocol";
import * as vm from "node:vm";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

/**
 * Safely stringify a value, handling circular references and non-serializable values.
 */
function safeStringify(val: unknown): string {
	if (typeof val === "string") return val;
	try {
		return JSON.stringify(val);
	} catch {
		return String(val);
	}
}

/**
 * Safely clone data for the sandbox. structuredClone can throw on non-cloneable
 * values (functions, WeakMaps, Symbols, etc.), so fall back to JSON roundtrip.
 */
function safeClone<T>(value: T): T {
	try {
		return structuredClone(value);
	} catch {
		try {
			return JSON.parse(JSON.stringify(value));
		} catch {
			// Last resort: return the original (not isolated, but won't crash)
			return value;
		}
	}
}

/**
 * Execute a Code node: run user JavaScript in a sandboxed vm context.
 * Input data is available as `items` (array) and `data` (raw input object).
 * The code must return a value which becomes the output.
 */
export async function executeCode(
	node: DagNode,
	inputData: Map<string, unknown>,
): Promise<DagNodeResult> {
	const content = node.operationNode.content as CodeNodeContent;

	// Build the items array from input data
	const items: unknown[] = [];
	const dataObj: Record<string, unknown> = {};

	for (const [key, value] of inputData) {
		dataObj[key] = value;
		if (Array.isArray(value)) {
			items.push(...value);
		} else {
			items.push(value);
		}
	}

	// Capture console.log output for execution logs
	const consoleLogs: string[] = [];

	// Create a sandboxed context — no access to require, process, fs, etc.
	// Includes N8N-compatible special variables: $input, $json, $now, $today, $execution, $node
	const clonedItems = safeClone(items);
	const clonedData = safeClone(dataObj);
	const firstItem = clonedItems[0] ?? {};
	const sandbox: Record<string, unknown> = {
		items: clonedItems,
		data: clonedData,
		// N8N-compatible variables
		$input: {
			all: () => clonedItems,
			first: () => clonedItems[0],
			last: () => clonedItems[clonedItems.length - 1],
			item: firstItem,
		},
		$json: typeof firstItem === "object" && firstItem !== null ? firstItem : {},
		$now: new Date(),
		$today: new Date().toISOString().split("T")[0],
		$execution: {
			id: node.nodeId,
			timestamp: Date.now(),
		},
		$node: {
			name: node.operationNode.name ?? node.nodeId,
		},
		// Standard JS globals
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
		structuredClone,
		setTimeout: (fn: () => void, ms: number) => setTimeout(fn, Math.min(ms, 30000)),
		clearTimeout,
		console: {
			log: (...args: unknown[]) => {
				consoleLogs.push(args.map(safeStringify).join(" "));
			},
			warn: (...args: unknown[]) => {
				consoleLogs.push(`[WARN] ${args.map(safeStringify).join(" ")}`);
			},
			error: (...args: unknown[]) => {
				consoleLogs.push(`[ERROR] ${args.map(safeStringify).join(" ")}`);
			},
		},
		__result: undefined as unknown,
		__error: undefined as unknown,
		__done: false,
	};

	const context = vm.createContext(sandbox);

	// Wrap user code in an async IIFE that assigns to __result.
	// __done flag prevents spinning on undefined returns (GLITCH #25 + undefined race fix).
	// .catch() is critical: without it, async errors are silently swallowed.
	const wrappedCode = `
		(async () => {
			${content.code}
		})().then(r => { __result = r; __done = true; }).catch(e => { __error = e; __done = true; });
	`;

	const script = new vm.Script(wrappedCode, {
		filename: "user-code.js",
	});

	const timeout = content.timeout ?? 10000;

	try {
		script.runInContext(context, { timeout });

		// Wait for the async result (with a timeout).
		// Uses __done flag instead of checking __result === undefined,
		// because user code may legitimately return undefined.
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

		const result = sandbox.__result;

		return {
			outputs: new Map([
				["output", result ?? items], // matches factory accessor "output"
				["data", result ?? items],
				...(consoleLogs.length > 0 ? [["_logs", consoleLogs] as [string, unknown]] : []),
			]),
		};
	} catch (error) {
		const errMsg =
			error instanceof Error ? error.message : "Code execution failed";
		throw new Error(`Code node execution failed: ${errMsg}`);
	}
}
