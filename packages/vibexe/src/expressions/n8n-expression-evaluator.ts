import vm from "node:vm";
import type { NodeOutputLookup } from "./resolve-dag-expressions";

/**
 * Detection pattern: raw N8N expression syntax left by partial converter translation.
 * Matches $json[, $json., $('..., $input. that the converter couldn't fully translate.
 */
const N8N_RAW_PATTERN = /\$json[\[.]|\$\(['"]|\$input\./;

/**
 * Evaluate raw N8N expression strings left by partial converter translation.
 * Runs in a sandboxed VM context with N8N-compatible globals ($json, $input, $()).
 *
 * Scans all string values in a config object. If a string contains
 * raw N8N patterns that weren't converted to bracket notation, evaluates them.
 *
 * This is the FINAL stage in the expression resolution pipeline:
 *   Stage 1: resolveConfigExpressions()  — [input.field] from direct inputs
 *   Stage 2: resolveDagExpressions()     — [NodeName.field] from DAG
 *   Stage 3: evaluateN8NExpressions()    — $json['key'], $().json, JS expressions
 */
export function evaluateN8NExpressions(
	config: Record<string, unknown>,
	inputData: Record<string, unknown>,
	nodeLookup?: NodeOutputLookup,
): void {
	// Flatten all input data into a single $json object
	const $json: Record<string, unknown> = {};
	for (const v of Object.values(inputData)) {
		if (v && typeof v === "object" && !Array.isArray(v)) {
			Object.assign($json, v);
		} else if (typeof v === "string") {
			try {
				const parsed = JSON.parse(v);
				if (parsed && typeof parsed === "object") {
					Object.assign($json, parsed);
				}
			} catch {
				/* not JSON, skip */
			}
		}
	}

	const $input = {
		first: () => ({ json: $json }),
		last: () => ({ json: $json }),
		all: () => [{ json: $json }],
		item: { json: $json },
	};

	const $ = (name: string) => {
		const data = nodeLookup?.(name) ?? {};
		const flat: Record<string, unknown> = {};
		for (const v of Object.values(data)) {
			if (v && typeof v === "object") Object.assign(flat, v);
		}
		const item = { json: flat };
		return {
			item,
			first: () => item,
			last: () => item,
			all: () => [item],
		};
	};

	const sandbox = {
		$json,
		$input,
		$,
		JSON,
		Math,
		String,
		Number,
		parseInt,
		parseFloat,
		RegExp,
		Array,
		Object,
		Date,
		encodeURIComponent,
		decodeURIComponent,
		undefined,
		null: null,
		true: true,
		false: false,
	};

	function evaluateExpr(expr: string): string {
		try {
			const result = vm.runInNewContext(expr, sandbox, { timeout: 1000 });
			if (result === undefined || result === null) return "";
			return typeof result === "string" ? result : JSON.stringify(result);
		} catch {
			return expr; // evaluation failed, return original
		}
	}

	function processValue(val: string): string {
		if (!N8N_RAW_PATTERN.test(val)) return val;

		// Handle {{ expression }} wrappers
		if (val.includes("{{")) {
			return val.replace(/\{\{\s*([\s\S]*?)\s*\}\}/g, (_, inner: string) =>
				evaluateExpr(inner),
			);
		}

		// Bare expression without {{ }} wrappers
		return evaluateExpr(val);
	}

	function resolveInObject(obj: Record<string, unknown>): void {
		for (const [key, value] of Object.entries(obj)) {
			if (typeof value === "string") {
				obj[key] = processValue(value);
			} else if (
				typeof value === "object" &&
				value !== null &&
				!Array.isArray(value)
			) {
				resolveInObject(value as Record<string, unknown>);
			}
		}
	}

	resolveInObject(config);
}
