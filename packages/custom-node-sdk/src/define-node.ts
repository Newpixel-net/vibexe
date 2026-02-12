import type { CustomNodeDefinition } from "./types";

/**
 * Helper function to define a custom node with type checking.
 *
 * @example
 * ```typescript
 * const myNode = defineNode({
 *   name: "my-custom-node",
 *   displayName: "My Custom Node",
 *   description: "Does something custom",
 *   icon: "Box",
 *   category: "Custom",
 *   version: "1.0.0",
 *   inputs: [
 *     { name: "data", displayName: "Data", type: "any" },
 *   ],
 *   outputs: [
 *     { name: "result", displayName: "Result", type: "any" },
 *   ],
 *   properties: [
 *     { name: "apiUrl", displayName: "API URL", type: "string", required: true },
 *   ],
 *   executeCode: `
 *     async (context) => {
 *       const response = await context.helpers.httpRequest(context.properties.apiUrl);
 *       return { result: response.body };
 *     }
 *   `,
 * });
 * ```
 */
export function defineNode(
	definition: CustomNodeDefinition,
): CustomNodeDefinition {
	// Validate required fields
	if (!definition.name) throw new Error("Custom node must have a name");
	if (!definition.displayName)
		throw new Error("Custom node must have a displayName");
	if (!definition.executeCode)
		throw new Error("Custom node must have executeCode");

	// Validate name format (lowercase, dashes allowed)
	if (!/^[a-z0-9][a-z0-9-]*$/.test(definition.name)) {
		throw new Error(
			"Custom node name must be lowercase alphanumeric with dashes",
		);
	}

	return { ...definition };
}
