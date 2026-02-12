/**
 * Custom Node SDK Types
 *
 * Developers use these types to define custom nodes that can be
 * registered and executed within the Vibexe workflow engine.
 */

export type PropertyType =
	| "string"
	| "number"
	| "boolean"
	| "select"
	| "json"
	| "code"
	| "textarea";

export interface PropertyDefinition {
	name: string;
	displayName: string;
	type: PropertyType;
	description?: string;
	required?: boolean;
	default?: unknown;
	options?: { label: string; value: string }[]; // For "select" type
	placeholder?: string;
}

export interface PortDefinition {
	name: string;
	displayName: string;
	type: "any" | "string" | "number" | "boolean" | "object" | "array";
	description?: string;
}

export interface ExecutionContext {
	/** Input data keyed by input port name */
	inputs: Record<string, unknown>;
	/** Property values set by the user */
	properties: Record<string, unknown>;
	/** Node metadata */
	node: {
		id: string;
		name: string;
	};
	/** Helpers */
	helpers: {
		/** Make an HTTP request */
		httpRequest(
			url: string,
			options?: {
				method?: string;
				headers?: Record<string, string>;
				body?: unknown;
			},
		): Promise<{
			status: number;
			headers: Record<string, string>;
			body: unknown;
		}>;
		/** Log a message (appears in execution logs) */
		log(message: string): void;
	};
}

export interface NodeOutput {
	/** Output data keyed by output port name */
	[portName: string]: unknown;
}

export interface CustomNodeDefinition {
	/** Unique identifier for this node type */
	name: string;
	/** Display name shown in the UI */
	displayName: string;
	/** Description of what this node does */
	description: string;
	/** Lucide icon name (e.g., "Box", "Zap", "Globe") */
	icon: string;
	/** Category for grouping in the node palette */
	category: string;
	/** Version string */
	version: string;
	/** Input port definitions */
	inputs: PortDefinition[];
	/** Output port definitions */
	outputs: PortDefinition[];
	/** User-configurable properties */
	properties: PropertyDefinition[];
	/** The execution function (as a string for JSON-serializable definitions) */
	executeCode: string;
}
