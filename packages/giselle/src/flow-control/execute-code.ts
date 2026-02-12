import type { CodeNodeContent } from "@giselles-ai/protocol";
import * as vm from "node:vm";
import type { DagNode, DagNodeResult } from "../tasks/dag-executor";

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

	// Create a sandboxed context — no access to require, process, fs, etc.
	const sandbox: Record<string, unknown> = {
		items: structuredClone(items),
		data: structuredClone(dataObj),
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
			log: () => {}, // no-op in production
		},
		__result: undefined as unknown,
	};

	const context = vm.createContext(sandbox);

	// Wrap user code in an async IIFE that assigns to __result
	const wrappedCode = `
		(async () => {
			${content.code}
		})().then(r => { __result = r; });
	`;

	const script = new vm.Script(wrappedCode, {
		filename: "user-code.js",
	});

	const timeout = content.timeout ?? 10000;

	try {
		script.runInContext(context, { timeout });

		// Wait for the async result (with a timeout)
		const startTime = Date.now();
		while (sandbox.__result === undefined && Date.now() - startTime < timeout) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		const result = sandbox.__result;

		return {
			outputs: new Map([["data", result ?? items]]),
		};
	} catch (error) {
		const errMsg =
			error instanceof Error ? error.message : "Code execution failed";
		throw new Error(`Code node execution failed: ${errMsg}`);
	}
}
