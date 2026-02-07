/**
 * Property Resolver: Resolves Activepieces Property types to actual values.
 *
 * Activepieces pieces define properties with specific types (ShortText, LongText,
 * Number, Dropdown, OAuth2, etc.). This module resolves user-provided values
 * to the format expected by the piece action.
 */

export type PropertyType =
	| "SHORT_TEXT"
	| "LONG_TEXT"
	| "NUMBER"
	| "CHECKBOX"
	| "DROPDOWN"
	| "STATIC_DROPDOWN"
	| "MULTI_SELECT_DROPDOWN"
	| "DYNAMIC"
	| "ARRAY"
	| "OBJECT"
	| "JSON"
	| "FILE"
	| "DATE_TIME"
	| "MARKDOWN"
	| "CUSTOM_AUTH"
	| "OAUTH2"
	| "SECRET_TEXT"
	| "BASIC_AUTH";

/**
 * Resolve a property value based on its type.
 * Converts user-provided values to the format expected by Activepieces.
 */
export function resolvePropertyValue(
	type: PropertyType,
	value: unknown,
): unknown {
	switch (type) {
		case "SHORT_TEXT":
		case "LONG_TEXT":
		case "MARKDOWN":
			return typeof value === "string" ? value : String(value ?? "");

		case "NUMBER":
			if (typeof value === "number") return value;
			if (typeof value === "string") {
				const parsed = Number.parseFloat(value);
				return Number.isNaN(parsed) ? 0 : parsed;
			}
			return 0;

		case "CHECKBOX":
			if (typeof value === "boolean") return value;
			if (typeof value === "string")
				return value === "true" || value === "1" || value === "yes";
			return Boolean(value);

		case "DROPDOWN":
		case "STATIC_DROPDOWN":
			return value;

		case "MULTI_SELECT_DROPDOWN":
			if (Array.isArray(value)) return value;
			if (typeof value === "string") {
				try {
					const parsed = JSON.parse(value);
					return Array.isArray(parsed) ? parsed : [value];
				} catch {
					return [value];
				}
			}
			return [];

		case "DYNAMIC":
		case "OBJECT":
			if (typeof value === "object" && value !== null) return value;
			if (typeof value === "string") {
				try {
					return JSON.parse(value);
				} catch {
					return {};
				}
			}
			return {};

		case "ARRAY":
			if (Array.isArray(value)) return value;
			if (typeof value === "string") {
				try {
					const parsed = JSON.parse(value);
					return Array.isArray(parsed) ? parsed : [value];
				} catch {
					return [value];
				}
			}
			return [];

		case "JSON":
			if (typeof value === "string") {
				try {
					return JSON.parse(value);
				} catch {
					return value;
				}
			}
			return value;

		case "FILE":
			return value;

		case "DATE_TIME":
			return typeof value === "string" ? value : String(value ?? "");

		case "CUSTOM_AUTH":
		case "OAUTH2":
		case "SECRET_TEXT":
		case "BASIC_AUTH":
			return value;

		default:
			return value;
	}
}

/**
 * Resolve all properties for an action based on its property definitions.
 */
export function resolveProperties(
	propertyDefs: Record<string, { type: PropertyType }>,
	values: Record<string, unknown>,
): Record<string, unknown> {
	const resolved: Record<string, unknown> = {};
	for (const [key, def] of Object.entries(propertyDefs)) {
		if (key in values) {
			resolved[key] = resolvePropertyValue(def.type, values[key]);
		}
	}
	// Also pass through any values not in property defs (for dynamic props)
	for (const [key, value] of Object.entries(values)) {
		if (!(key in resolved)) {
			resolved[key] = value;
		}
	}
	return resolved;
}
