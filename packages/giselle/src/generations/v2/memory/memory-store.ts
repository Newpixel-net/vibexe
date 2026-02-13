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
	summary: z.string().optional(),
});

type MemoryMessage = z.infer<typeof CoreMessageSchema>;

function getMemoryPath(sessionKey: string): string {
	return `memory/${sessionKey}/history.json`;
}

/**
 * Estimate token count from text (rough approximation: ~4 chars per token).
 */
function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

/**
 * Load memory messages based on memory type.
 * - simpleMemory / windowBuffer: return last N messages by count
 * - tokenBuffer: return last messages fitting within maxTokens
 * - summary: return summary + last N messages
 */
export async function loadMemory(
	storage: GiselleStorage,
	sessionKey: string,
	limit: number,
	options?: {
		memoryType?: string;
		maxTokens?: number;
	},
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

	const messages = data.messages;
	const memoryType = options?.memoryType ?? "windowBuffer";

	switch (memoryType) {
		case "tokenBuffer": {
			// Return messages that fit within token budget
			const maxTokens = options?.maxTokens ?? 4000;
			let tokenCount = 0;
			const result: MemoryMessage[] = [];
			// Walk backwards to get most recent messages first
			for (let i = messages.length - 1; i >= 0; i--) {
				const msgTokens = estimateTokens(messages[i].content);
				if (tokenCount + msgTokens > maxTokens) break;
				tokenCount += msgTokens;
				result.unshift(messages[i]);
			}
			return result;
		}
		case "summary": {
			// Return summary as system message + last N messages
			const result: MemoryMessage[] = [];
			if (data.summary) {
				result.push({
					role: "system",
					content: `Previous conversation summary:\n${data.summary}`,
					timestamp: data.updatedAt,
				});
			}
			const recentMessages =
				limit > 0 && messages.length > limit
					? messages.slice(-limit)
					: messages;
			result.push(...recentMessages);
			return result;
		}
		default: {
			// simpleMemory / windowBuffer: return last N messages
			if (limit > 0 && messages.length > limit) {
				return messages.slice(-limit);
			}
			return messages;
		}
	}
}

export async function saveMemory(
	storage: GiselleStorage,
	sessionKey: string,
	newMessages: MemoryMessage[],
	maxMessages: number,
	options?: {
		memoryType?: string;
		maxTokens?: number;
	},
): Promise<void> {
	const path = getMemoryPath(sessionKey);

	// Load existing data
	let existingMessages: MemoryMessage[] = [];
	let existingSummary: string | undefined;
	const exists = await storage.exists(path);
	if (exists) {
		const data = await storage.getJson({
			path,
			schema: MemoryDataSchema,
		});
		existingMessages = data.messages;
		existingSummary = data.summary;
	}

	// Append new messages
	const allMessages = [...existingMessages, ...newMessages];

	const memoryType = options?.memoryType ?? "windowBuffer";

	let trimmedMessages: MemoryMessage[];
	let summary = existingSummary;

	if (memoryType === "summary" && allMessages.length > maxMessages * 2) {
		// For summary memory: summarize old messages when buffer gets too large
		const oldMessages = allMessages.slice(0, -maxMessages);
		const recentMessages = allMessages.slice(-maxMessages);

		// Build a simple extractive summary from old messages
		const oldContent = oldMessages
			.filter((m) => m.role !== "system")
			.map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
			.join("\n");
		summary = existingSummary
			? `${existingSummary}\n\n---\n${oldContent}`
			: oldContent;
		// Keep summary under 2000 chars
		if (summary.length > 2000) {
			summary = summary.slice(-2000);
		}
		trimmedMessages = recentMessages;
	} else if (memoryType === "tokenBuffer") {
		// Token buffer: trim by token count
		const maxTokens = options?.maxTokens ?? 4000;
		let tokenCount = 0;
		trimmedMessages = [];
		for (let i = allMessages.length - 1; i >= 0; i--) {
			const msgTokens = estimateTokens(allMessages[i].content);
			if (tokenCount + msgTokens > maxTokens) break;
			tokenCount += msgTokens;
			trimmedMessages.unshift(allMessages[i]);
		}
	} else {
		// Window buffer / simple: trim by count
		trimmedMessages =
			maxMessages > 0 && allMessages.length > maxMessages
				? allMessages.slice(-maxMessages)
				: allMessages;
	}

	await storage.setJson({
		path,
		schema: MemoryDataSchema,
		data: {
			messages: trimmedMessages,
			updatedAt: Date.now(),
			...(summary ? { summary } : {}),
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
