import type { GiselleStorage } from "@giselles-ai/storage";
import * as z from "zod/v4";

const CoreMessageSchema = z.object({
	role: z.enum(["user", "assistant", "system"]),
	content: z.string(),
	timestamp: z.number().optional(),
});

const MemoryDataSchema = z.object({
	messages: z.array(CoreMessageSchema),
	updatedAt: z.number(),
});

type MemoryMessage = z.infer<typeof CoreMessageSchema>;

function getMemoryPath(sessionKey: string): string {
	return `memory/${sessionKey}/history.json`;
}

export async function loadMemory(
	storage: GiselleStorage,
	sessionKey: string,
	limit: number,
): Promise<MemoryMessage[]> {
	const path = getMemoryPath(sessionKey);
	const exists = await storage.exists(path);
	if (!exists) {
		return [];
	}

	const data = await storage.getJson({
		path,
		schema: MemoryDataSchema,
	});

	// Return the last N messages based on limit
	const messages = data.messages;
	if (limit > 0 && messages.length > limit) {
		return messages.slice(-limit);
	}
	return messages;
}

export async function saveMemory(
	storage: GiselleStorage,
	sessionKey: string,
	newMessages: MemoryMessage[],
	maxMessages: number,
): Promise<void> {
	const path = getMemoryPath(sessionKey);

	// Load existing messages
	let existingMessages: MemoryMessage[] = [];
	const exists = await storage.exists(path);
	if (exists) {
		const data = await storage.getJson({
			path,
			schema: MemoryDataSchema,
		});
		existingMessages = data.messages;
	}

	// Append new messages
	const allMessages = [...existingMessages, ...newMessages];

	// Trim to maxMessages
	const trimmedMessages =
		maxMessages > 0 && allMessages.length > maxMessages
			? allMessages.slice(-maxMessages)
			: allMessages;

	await storage.setJson({
		path,
		schema: MemoryDataSchema,
		data: {
			messages: trimmedMessages,
			updatedAt: Date.now(),
		},
	});
}

export function buildSessionKey(
	workspaceId: string,
	agentNodeId: string,
	scope: "agent" | "workspace",
): string {
	if (scope === "workspace") {
		return workspaceId;
	}
	return `${workspaceId}/${agentNodeId}`;
}
