/**
 * N8N Node Type -> Giselle Node Type Mapping
 *
 * Maps N8N node types to either:
 * - Giselle native types (textGeneration, trigger, etc.)
 * - Integration nodes (backed by Activepieces pieces)
 */

export type GiselleNodeMapping =
	| { type: "trigger"; subtype: "manual" }
	| {
			type: "textGeneration";
			provider: "openai" | "anthropic" | "google";
			modelId: string;
	  }
	| { type: "integration"; pieceName: string; actionName: string }
	| { type: "delay" }
	| { type: "conditional"; subtype: "if" | "switch" }
	| {
			type: "dataTransform";
			subtype: "set" | "code" | "merge" | "splitInBatches";
	  }
	| { type: "text"; description: string }
	| { type: "skip"; reason: string }
	| { type: "end" };

/**
 * Map an N8N node type to a Giselle node type.
 */
export function mapN8NNodeType(n8nType: string): GiselleNodeMapping {
	// Normalize the type
	const type = n8nType.toLowerCase();

	// Exact matches first
	if (type in EXACT_MAPPINGS) {
		return EXACT_MAPPINGS[type];
	}

	// Pattern matches
	for (const [pattern, mapping] of PATTERN_MAPPINGS) {
		if (type.includes(pattern)) {
			return mapping;
		}
	}

	// Try to extract piece name from n8n type
	const pieceName = extractPieceNameFromN8NType(n8nType);
	if (pieceName) {
		return {
			type: "integration",
			pieceName,
			actionName: "default",
		};
	}

	return { type: "skip", reason: `Unsupported N8N node type: ${n8nType}` };
}

function extractPieceNameFromN8NType(n8nType: string): string | null {
	// n8n-nodes-base.slack -> slack
	const baseMatch = n8nType.match(/^n8n-nodes-base\.(.+)$/);
	if (baseMatch) {
		const nameLower = baseMatch[1].toLowerCase();
		if (nameLower in N8N_TO_PIECE_NAME) {
			return N8N_TO_PIECE_NAME[nameLower];
		}
		return nameLower;
	}

	// @n8n/n8n-nodes-langchain.lmOpenAi -> openai
	const langchainMatch = n8nType.match(
		/^@n8n\/n8n-nodes-langchain\.(.+)$/,
	);
	if (langchainMatch) {
		const nameLower = langchainMatch[1].toLowerCase();
		if (nameLower in LANGCHAIN_TO_PIECE_NAME) {
			return LANGCHAIN_TO_PIECE_NAME[nameLower];
		}
	}

	return null;
}

// Exact N8N type -> Giselle mapping
const EXACT_MAPPINGS: Record<string, GiselleNodeMapping> = {
	"n8n-nodes-base.manualtrigger": { type: "trigger", subtype: "manual" },
	"n8n-nodes-base.scheduletrigger": { type: "trigger", subtype: "manual" },
	"n8n-nodes-base.webhooktrigger": { type: "trigger", subtype: "manual" },
	"n8n-nodes-base.webhook": { type: "trigger", subtype: "manual" },
	"n8n-nodes-base.start": { type: "trigger", subtype: "manual" },
	"n8n-nodes-base.noop": { type: "skip", reason: "No-op node" },
	"n8n-nodes-base.noopnode": { type: "skip", reason: "No-op node" },
	"n8n-nodes-base.wait": { type: "delay" },
	"n8n-nodes-base.if": { type: "conditional", subtype: "if" },
	"n8n-nodes-base.switch": { type: "conditional", subtype: "switch" },
	"n8n-nodes-base.set": { type: "dataTransform", subtype: "set" },
	"n8n-nodes-base.code": { type: "dataTransform", subtype: "code" },
	"n8n-nodes-base.function": { type: "dataTransform", subtype: "code" },
	"n8n-nodes-base.functionitem": { type: "dataTransform", subtype: "code" },
	"n8n-nodes-base.merge": { type: "dataTransform", subtype: "merge" },
	"n8n-nodes-base.splitinbatches": {
		type: "dataTransform",
		subtype: "splitInBatches",
	},
	"n8n-nodes-base.stickynote": {
		type: "text",
		description: "Converted from N8N sticky note",
	},
	"n8n-nodes-base.respondtowebhook": { type: "end" },
	"n8n-nodes-base.httprequest": {
		type: "integration",
		pieceName: "http",
		actionName: "send_request",
	},
	"n8n-nodes-base.emailsend": {
		type: "integration",
		pieceName: "gmail",
		actionName: "send_email",
	},
	"@n8n/n8n-nodes-langchain.openai": {
		type: "textGeneration",
		provider: "openai",
		modelId: "gpt-4o",
	},
	"@n8n/n8n-nodes-langchain.lmopenai": {
		type: "textGeneration",
		provider: "openai",
		modelId: "gpt-4o",
	},
	"@n8n/n8n-nodes-langchain.lmchatanthropic": {
		type: "textGeneration",
		provider: "anthropic",
		modelId: "claude-sonnet-4-5-20250929",
	},
	"@n8n/n8n-nodes-langchain.lmchatgooglegenerativeai": {
		type: "textGeneration",
		provider: "google",
		modelId: "gemini-2.0-flash",
	},
};

// Pattern-based mappings
const PATTERN_MAPPINGS: Array<[string, GiselleNodeMapping]> = [
	[
		"trigger",
		{ type: "trigger", subtype: "manual" },
	],
	[
		"openai",
		{
			type: "textGeneration",
			provider: "openai",
			modelId: "gpt-4o",
		},
	],
	[
		"anthropic",
		{
			type: "textGeneration",
			provider: "anthropic",
			modelId: "claude-sonnet-4-5-20250929",
		},
	],
];

// N8N base node name -> Activepieces piece name
const N8N_TO_PIECE_NAME: Record<string, string> = {
	slack: "slack",
	googlesheets: "google-sheets",
	googledrive: "google-drive",
	gmail: "gmail",
	discord: "discord",
	telegram: "telegram-bot",
	notion: "notion",
	airtable: "airtable",
	stripe: "stripe",
	hubspot: "hubspot",
	mailchimp: "mailchimp",
	twitter: "twitter",
	linkedin: "linkedin",
	googlecalendar: "google-calendar",
	dropbox: "dropbox",
	zoom: "zoom",
	googlecontacts: "google-contacts",
	httprequest: "http",
	emailsend: "gmail",
};

// Langchain node name -> provider
const LANGCHAIN_TO_PIECE_NAME: Record<string, string> = {
	openai: "openai",
	lmopenai: "openai",
	lmchatanthropic: "openai", // Will be mapped to textGeneration instead
	lmchatgooglegenerativeai: "openai", // Will be mapped to textGeneration instead
};
