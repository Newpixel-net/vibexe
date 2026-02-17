import { navigatePath } from "./evaluate";

/**
 * Lookup function: given a node name, returns its output data as a plain object.
 * Returns undefined if the node doesn't exist or hasn't completed.
 */
export type NodeOutputLookup = (name: string) => Record<string, unknown> | undefined;

/**
 * Resolve [NodeName.field.path] expression placeholders in all string values
 * of a config object, using a global node output lookup function.
 *
 * This supplements resolveConfigExpressions (which only searches direct inputs)
 * by resolving cross-node references against the full DAG execution state.
 *
 * Skips reserved prefixes: "input", "timestamp", "execution" (handled elsewhere).
 */
export function resolveDagExpressions(
	config: Record<string, unknown>,
	lookup: NodeOutputLookup,
): void {
	const RESERVED_PREFIXES = new Set(["input", "timestamp", "execution"]);

	function resolveInObject(obj: Record<string, unknown>): void {
		for (const [key, value] of Object.entries(obj)) {
			if (typeof value === "string" && value.includes("[")) {
				obj[key] = value.replace(
					/\[([^\]]+)\]/g,
					(match, fullExpr: string) => {
						const dotIndex = fullExpr.indexOf(".");
						if (dotIndex === -1) return match; // No dot = not a field access

						const nodeName = fullExpr.substring(0, dotIndex);
						if (RESERVED_PREFIXES.has(nodeName.toLowerCase())) return match;

						const fieldPath = fullExpr.substring(dotIndex + 1);
						const nodeData = lookup(nodeName);
						if (!nodeData) return match; // Node not found or not completed

						// Try navigatePath for deep access (handles array[0], nested.field)
						for (const outputVal of Object.values(nodeData)) {
							const resolved = navigatePath(outputVal, fieldPath);
							if (resolved !== undefined) {
								return typeof resolved === "string"
									? resolved
									: JSON.stringify(resolved);
							}
						}

						// Leaf-key fallback: try just the last segment
						const leafKey = fieldPath.split(".").pop() || fieldPath;
						for (const outputVal of Object.values(nodeData)) {
							if (outputVal && typeof outputVal === "object") {
								const found = findLeafKey(outputVal, leafKey);
								if (found !== undefined) {
									return typeof found === "string"
										? found
										: JSON.stringify(found);
								}
							}
						}

						return match; // Could not resolve
					},
				);
			} else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
				resolveInObject(value as Record<string, unknown>);
			}
		}
	}

	resolveInObject(config);
}

function findLeafKey(obj: unknown, key: string): unknown {
	if (obj == null || typeof obj !== "object") return undefined;
	const record = obj as Record<string, unknown>;
	if (key in record) return record[key];
	for (const v of Object.values(record)) {
		if (v && typeof v === "object") {
			const found = findLeafKey(v, key);
			if (found !== undefined) return found;
		}
	}
	return undefined;
}
