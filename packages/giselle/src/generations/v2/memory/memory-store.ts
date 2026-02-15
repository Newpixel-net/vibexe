import type { GiselleStorage } from "@giselles-ai/storage";
import * as z from "zod/v4";
import { Pool } from "pg";

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

// ── Postgres Memory ──

let pgPool: Pool | null = null;
let pgTableEnsured = false;

function getPgPool(): Pool {
	if (!pgPool) {
		const url = process.env.POSTGRES_URL ?? "";
		if (!url) throw new Error("POSTGRES_URL not set — cannot use Postgres memory");
		pgPool = new Pool({ connectionString: url, max: 3 });
	}
	return pgPool;
}

async function ensurePgTable(): Promise<void> {
	if (pgTableEnsured) return;
	const pool = getPgPool();
	await pool.query(`
		CREATE TABLE IF NOT EXISTS chat_memory_messages (
			id SERIAL PRIMARY KEY,
			session_key TEXT NOT NULL,
			role TEXT NOT NULL,
			content TEXT NOT NULL,
			timestamp BIGINT,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)
	`);
	await pool.query(`
		CREATE INDEX IF NOT EXISTS idx_chat_memory_session ON chat_memory_messages(session_key)
	`);
	pgTableEnsured = true;
}

export async function loadPostgresMemory(
	sessionKey: string,
	limit: number,
): Promise<MemoryMessage[]> {
	await ensurePgTable();
	const pool = getPgPool();
	const query = limit > 0
		? `SELECT role, content, timestamp FROM chat_memory_messages WHERE session_key = $1 ORDER BY id DESC LIMIT $2`
		: `SELECT role, content, timestamp FROM chat_memory_messages WHERE session_key = $1 ORDER BY id ASC`;
	const params = limit > 0 ? [sessionKey, limit] : [sessionKey];
	const result = await pool.query(query, params);
	const rows = result.rows as Array<{ role: string; content: string; timestamp: string | null }>;
	// If limited, rows come DESC — reverse to chronological
	if (limit > 0) rows.reverse();
	return rows.map((r) => ({
		role: r.role as "user" | "assistant" | "system",
		content: r.content,
		timestamp: r.timestamp ? Number(r.timestamp) : undefined,
	}));
}

export async function savePostgresMemory(
	sessionKey: string,
	newMessages: MemoryMessage[],
	maxMessages: number,
): Promise<void> {
	if (newMessages.length === 0) return;
	await ensurePgTable();
	const pool = getPgPool();

	// Insert new messages
	const values: string[] = [];
	const params: unknown[] = [];
	let idx = 1;
	for (const msg of newMessages) {
		values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++})`);
		params.push(sessionKey, msg.role, msg.content, msg.timestamp ?? Date.now());
	}
	await pool.query(
		`INSERT INTO chat_memory_messages (session_key, role, content, timestamp) VALUES ${values.join(", ")}`,
		params,
	);

	// Trim old messages if over limit
	if (maxMessages > 0) {
		await pool.query(
			`DELETE FROM chat_memory_messages
			 WHERE session_key = $1 AND id NOT IN (
				SELECT id FROM chat_memory_messages WHERE session_key = $1 ORDER BY id DESC LIMIT $2
			 )`,
			[sessionKey, maxMessages],
		);
	}
}
