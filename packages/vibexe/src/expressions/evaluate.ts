import type { Condition, ConditionGroup, ConditionOperator } from "@vibexe-ai/protocol";

/**
 * Safe expression evaluation system.
 * Supports:
 * - {{nodeId:outputId}} — full output value (text or JSON)
 * - {{nodeId:outputId.field}} — field access on structured data
 * - {{nodeId:outputId.field.nested}} — deep field access
 * - {{nodeId:outputId.array[0]}} — array index access
 * - {{$now}} — current ISO timestamp
 * - {{$execution.id}} — current execution/task ID
 *
 * NO eval() is ever used. Only safe JSON navigation.
 */

/**
 * Navigate into a value using a dot-separated path.
 * Supports: field.nested, array[0], field[0].nested
 */
export function navigatePath(value: unknown, path: string): unknown {
	if (!path || value === undefined || value === null) return value;

	const segments = parsePath(path);
	let current: unknown = value;

	for (const segment of segments) {
		if (current === undefined || current === null) return undefined;

		if (segment.type === "field") {
			if (typeof current === "object" && current !== null) {
				current = (current as Record<string, unknown>)[segment.name];
			} else {
				return undefined;
			}
		} else if (segment.type === "index") {
			if (Array.isArray(current)) {
				current = current[segment.index];
			} else {
				return undefined;
			}
		}
	}

	return current;
}

interface PathSegment {
	type: "field" | "index";
	name: string;
	index: number;
}

function parsePath(path: string): PathSegment[] {
	const segments: PathSegment[] = [];
	// Match: fieldName, [0], fieldName[0]
	const regex = /([^.\[\]]+)|\[(\d+)\]/g;
	let match: RegExpExecArray | null;

	while ((match = regex.exec(path)) !== null) {
		if (match[1] !== undefined) {
			segments.push({ type: "field", name: match[1], index: 0 });
		} else if (match[2] !== undefined) {
			segments.push({
				type: "index",
				name: "",
				index: Number.parseInt(match[2], 10),
			});
		}
	}

	return segments;
}

/**
 * Resolve expression references in a template string.
 * Pattern: {{nodeId:outputId}} or {{nodeId:outputId.path.to.field}}
 * Also supports: {{$now}}, {{$execution.id}}
 */
export function resolveExpressions(
	template: string,
	resolver: (nodeId: string, outputId: string, fieldPath?: string) => unknown,
	executionContext?: { taskId?: string },
): string {
	return template.replace(
		/\{\{([^}]+)\}\}/g,
		(_match, expression: string) => {
			const trimmed = expression.trim();

			// Built-in variables
			if (trimmed === "$now") {
				return new Date().toISOString();
			}
			if (trimmed === "$execution.id") {
				return executionContext?.taskId ?? "";
			}

			// Node reference: nodeId:outputId or nodeId:outputId.field.path
			const colonIndex = trimmed.indexOf(":");
			if (colonIndex === -1) return _match; // Not a valid reference

			const nodeId = trimmed.substring(0, colonIndex);
			const rest = trimmed.substring(colonIndex + 1);

			// Split on first dot to get outputId and optional field path
			const dotIndex = rest.indexOf(".");
			let outputId: string;
			let fieldPath: string | undefined;

			if (dotIndex === -1) {
				outputId = rest;
			} else {
				outputId = rest.substring(0, dotIndex);
				fieldPath = rest.substring(dotIndex + 1);
			}

			const value = resolver(nodeId, outputId, fieldPath);
			if (value === undefined || value === null) return "";
			if (typeof value === "string") return value;
			try { return JSON.stringify(value); } catch { return String(value); }
		},
	);
}

/**
 * Evaluate a single condition against a data value.
 */
export function evaluateCondition(
	condition: Condition,
	data: unknown,
): boolean {
	const fieldValue = navigatePath(data, condition.field);
	const compareValue = condition.value;

	return evaluateOperator(
		condition.operator,
		fieldValue,
		compareValue,
	);
}

function evaluateOperator(
	operator: ConditionOperator,
	fieldValue: unknown,
	compareValue?: string,
): boolean {
	const strField = fieldValue !== undefined && fieldValue !== null
		? String(fieldValue)
		: "";

	switch (operator) {
		case "equals":
			return strField === (compareValue ?? "");
		case "notEquals":
			return strField !== (compareValue ?? "");
		case "contains":
			return strField.includes(compareValue ?? "");
		case "notContains":
			return !strField.includes(compareValue ?? "");
		case "greaterThan": {
			const a = Number(fieldValue);
			const b = Number(compareValue);
			return !Number.isNaN(a) && !Number.isNaN(b) && a > b;
		}
		case "lessThan": {
			const a = Number(fieldValue);
			const b = Number(compareValue);
			return !Number.isNaN(a) && !Number.isNaN(b) && a < b;
		}
		case "greaterThanOrEqual": {
			const a = Number(fieldValue);
			const b = Number(compareValue);
			return !Number.isNaN(a) && !Number.isNaN(b) && a >= b;
		}
		case "lessThanOrEqual": {
			const a = Number(fieldValue);
			const b = Number(compareValue);
			return !Number.isNaN(a) && !Number.isNaN(b) && a <= b;
		}
		case "isEmpty": {
			if (fieldValue === undefined || fieldValue === null || strField === "") return true;
			if (Array.isArray(fieldValue)) return fieldValue.length === 0;
			if (typeof fieldValue === "object" && fieldValue !== null) {
				return Object.keys(fieldValue).length === 0;
			}
			return false;
		}
		case "isNotEmpty": {
			if (fieldValue === undefined || fieldValue === null || strField === "") return false;
			if (Array.isArray(fieldValue)) return fieldValue.length > 0;
			if (typeof fieldValue === "object" && fieldValue !== null) {
				return Object.keys(fieldValue).length > 0;
			}
			return true;
		}
		case "isTrue": {
			const lower = strField.toLowerCase();
			return fieldValue === true || lower === "true" || lower === "1" || lower === "yes";
		}
		case "isFalse": {
			const lower = strField.toLowerCase();
			return fieldValue === false || lower === "false" || lower === "0" || lower === "no";
		}
		case "regex": {
			try {
				const pattern = compareValue ?? "";
				// Guard against ReDoS: reject overly long or deeply nested patterns
				if (pattern.length > 500) return false;
				const re = new RegExp(pattern);
				// Test against a limited-length string to prevent hangs
				return re.test(strField.length > 10000 ? strField.slice(0, 10000) : strField);
			} catch {
				return false;
			}
		}
		case "startsWith":
			return strField.startsWith(compareValue ?? "");
		case "endsWith":
			return strField.endsWith(compareValue ?? "");
		default:
			return false;
	}
}

/**
 * Evaluate a condition group (AND/OR logic) against data.
 */
export function evaluateConditionGroup(
	group: ConditionGroup,
	data: unknown,
): boolean {
	if (group.conditions.length === 0) {
		// AND of nothing = true (vacuous truth), OR of nothing = false
		return group.combineWith !== "or";
	}

	if (group.combineWith === "or") {
		return group.conditions.some((c) => evaluateCondition(c, data));
	}
	// Default: AND
	return group.conditions.every((c) => evaluateCondition(c, data));
}
