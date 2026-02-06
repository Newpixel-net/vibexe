/**
 * Message Adapter
 *
 * Converts between AI SDK's UIMessage format and VibeSDK's
 * ChatMessage format for the message components.
 */

import type { UIMessage } from "@ai-sdk/react";
import { isTextUIPart, isToolUIPart } from "ai";
import type { ChatMessage, ToolEvent } from "../types/vibesdk";

/**
 * AI SDK v6 tool part shape for type extraction.
 * Uses toolCallId instead of toolInvocationId, and input/output instead of args/result.
 */
interface AISDKToolPart {
	type: string;
	toolCallId: string;
	toolName?: string;
	input?: unknown;
	output?: unknown;
	state: string;
	title?: string;
}

/**
 * Extract text content from AI SDK message parts.
 */
function extractTextContent(message: UIMessage): string {
	if (!message.parts || message.parts.length === 0) {
		return "";
	}

	return message.parts
		.filter(isTextUIPart)
		.map((part) => part.text)
		.join("\n");
}

/**
 * Extract tool events from AI SDK message parts.
 * AI SDK v6 uses different state names than previous versions.
 */
function extractToolEvents(message: UIMessage): ToolEvent[] {
	if (!message.parts) return [];

	return message.parts.filter(isToolUIPart).map((part) => {
		// Cast to our known shape - AI SDK v6 uses this structure
		const toolPart = part as unknown as AISDKToolPart;
		// Extract tool name from type field if not directly available
		// Format is "tool-{toolName}" or available directly as toolName
		const toolName = toolPart.toolName || toolPart.type.replace(/^tool-/, "");

		return {
			id: toolPart.toolCallId,
			toolName,
			args: (toolPart.input as Record<string, unknown>) || {},
			result: toolPart.output,
			status: mapToolState(toolPart.state),
		};
	});
}

/**
 * Map AI SDK v6 tool state to our ToolEvent status.
 * AI SDK v6 states: input-streaming, input-available, output-available, output-error, etc.
 */
function mapToolState(state?: string): ToolEvent["status"] {
	switch (state) {
		case "input-streaming":
		case "input-available":
		case "approval-requested":
		case "approval-responded":
			return "running";
		case "output-available":
			return "completed";
		case "output-error":
		case "output-denied":
			return "error";
		default:
			return "pending";
	}
}

/**
 * Convert a single AI SDK message to ChatMessage.
 */
export function toChatMessage(message: UIMessage): ChatMessage {
	return {
		id: message.id,
		role: message.role as "user" | "assistant",
		content: extractTextContent(message),
		timestamp: Date.now(), // UIMessage doesn't have createdAt in v6
		toolEvents:
			message.role === "assistant" ? extractToolEvents(message) : undefined,
		images: undefined, // TODO: Extract images from file parts if needed
	};
}

/**
 * Convert an array of AI SDK messages to ChatMessages.
 */
export function toChatMessages(messages: UIMessage[]): ChatMessage[] {
	return messages.map(toChatMessage);
}

/**
 * Check if a message has any tool events.
 */
export function hasToolEvents(message: ChatMessage): boolean {
	return !!message.toolEvents && message.toolEvents.length > 0;
}

/**
 * Get completed tool events from a message.
 */
export function getCompletedToolEvents(message: ChatMessage): ToolEvent[] {
	return message.toolEvents?.filter((e) => e.status === "completed") || [];
}
