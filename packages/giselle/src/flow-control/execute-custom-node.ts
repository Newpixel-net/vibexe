import * as vm from "node:vm";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

interface CustomNodeContent {
	customNodeName: string;
	executeCode: string;
	properties?: Record<string, unknown>;
	inputs?: Array<{ name: string; displayName: string; type: string }>;
	outputs?: Array<{ name: string; displayName: string; type: string }>;
}

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

	// Build input data object
	const inputs: Record<string, unknown> = {};
	for (const [key, value] of inputData) {
		inputs[key] = value;
	}

	// Build properties from content
	const properties: Record<string, unknown> = content.properties ?? {};

	// Capture console output
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
				logs.push(message);
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
				logs.push(
					args
						.map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
						.join(" "),
				);
			},
			warn: (...args: unknown[]) => {
				logs.push(
					`[WARN] ${args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")}`,
				);
			},
			error: (...args: unknown[]) => {
				logs.push(
					`[ERROR] ${args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")}`,
				);
			},
		},
		fetch: executionContext.helpers.httpRequest,
		__result: undefined as unknown,
		__error: undefined as unknown,
	};

	const vmContext = vm.createContext(sandbox);

	// The executeCode is expected to be an async function expression that takes context
	// .catch() is critical: without it, async errors are silently swallowed
	// and __result stays undefined until timeout (same pattern as execute-code.ts)
	const wrappedCode = `
		(async () => {
			const executeFn = ${content.executeCode};
			return await executeFn(context);
		})().then(r => { __result = r; }).catch(e => { __error = e; });
	`;

	const script = new vm.Script(wrappedCode, {
		filename: `custom-node-${content.customNodeName ?? "unknown"}.js`,
	});

	const timeout = 30000; // 30s timeout for custom nodes

	try {
		script.runInContext(vmContext, { timeout });

		// Wait for async result
		const startTime = Date.now();
		while (
			sandbox.__result === undefined &&
			sandbox.__error === undefined &&
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
