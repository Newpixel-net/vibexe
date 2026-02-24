/**
 * N8N Node Type -> Vibexe Node Type Mapping
 *
 * Maps N8N node types to either:
 * - Vibexe native V6 types (nativeIf, nativeCode, etc.)
 * - Vibexe legacy types (textGeneration, trigger, etc.)
 * - Integration nodes (backed by Activepieces pieces)
 */

export type VibexeNodeMapping =
	| { type: "trigger"; subtype: "manual" }
	| { type: "nativeTrigger"; provider: "schedule" | "webhook" }
	| {
			type: "textGeneration";
			provider: "openai" | "anthropic" | "google";
			modelId: string;
	  }
	| { type: "integration"; pieceName: string; actionName: string }
	| { type: "nativeIf" }
	| { type: "nativeSwitch" }
	| { type: "nativeMerge" }
	| { type: "nativeLoop" }
	| { type: "nativeCode" }
	| { type: "nativeFilter" }
	| { type: "nativeEditFields" }
	| { type: "nativeSort" }
	| { type: "nativeWait" }
	| { type: "nativeAggregate" }
	| { type: "nativeLimit" }
	| { type: "nativeRemoveDuplicates" }
	| { type: "nativeRenameKeys" }
	| { type: "nativeSplitOut" }
	| { type: "nativeCompareDatasets" }
	| { type: "nativeSummarize" }
	| { type: "nativeRespondToWebhook" }
	| { type: "aiAgent"; agentType: "tools" | "conversational" | "react" }
	| { type: "chatModel"; provider: "openai" | "anthropic" | "google" | "xai" | "nvidia"; defaultModelId: string }
	| { type: "toolNode"; toolType: string }
	| { type: "memoryNode"; memoryType: string }
	| { type: "text"; description: string }
	| { type: "unsupported"; originalType: string; reason: string }
	| { type: "skip"; reason: string }
	| { type: "end" };

/**
 * Map an N8N node type to a Vibexe node type.
 */
export function mapN8NNodeType(n8nType: string): VibexeNodeMapping {
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

	return { type: "unsupported", originalType: n8nType, reason: `Community/unsupported node: ${n8nType}` };
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

	// n8n-nodes-mcp.mcpClientTool -> mcpclienttool
	const mcpMatch = n8nType.match(/^n8n-nodes-mcp\.(.+)$/);
	if (mcpMatch) {
		return mcpMatch[1].toLowerCase();
	}

	return null;
}

// Exact N8N type -> Vibexe mapping
const EXACT_MAPPINGS: Record<string, VibexeNodeMapping> = {
	// Triggers
	"n8n-nodes-base.manualtrigger": { type: "trigger", subtype: "manual" },
	"n8n-nodes-base.scheduletrigger": { type: "nativeTrigger", provider: "schedule" },
	"n8n-nodes-base.webhooktrigger": { type: "nativeTrigger", provider: "webhook" },
	"n8n-nodes-base.webhook": { type: "nativeTrigger", provider: "webhook" },
	"n8n-nodes-base.start": { type: "trigger", subtype: "manual" },

	// Flow control - native V6
	"n8n-nodes-base.if": { type: "nativeIf" },
	"n8n-nodes-base.switch": { type: "nativeSwitch" },
	"n8n-nodes-base.merge": { type: "nativeMerge" },
	"n8n-nodes-base.wait": { type: "nativeWait" },
	"n8n-nodes-base.splitinbatches": { type: "nativeLoop" },

	// Data transform - native V6
	"n8n-nodes-base.set": { type: "nativeEditFields" },
	"n8n-nodes-base.code": { type: "nativeCode" },
	"n8n-nodes-base.function": { type: "nativeCode" },
	"n8n-nodes-base.functionitem": { type: "nativeCode" },
	"n8n-nodes-base.filter": { type: "nativeFilter" },
	"n8n-nodes-base.sort": { type: "nativeSort" },

	// Data transform - additional native V6
	"n8n-nodes-base.aggregate": { type: "nativeAggregate" },
	"n8n-nodes-base.limit": { type: "nativeLimit" },
	"n8n-nodes-base.removeduplicates": { type: "nativeRemoveDuplicates" },
	"n8n-nodes-base.renamekeys": { type: "nativeRenameKeys" },
	"n8n-nodes-base.splitout": { type: "nativeSplitOut" },
	"n8n-nodes-base.comparedatasets": { type: "nativeCompareDatasets" },
	"n8n-nodes-base.summarize": { type: "nativeSummarize" },

	// NoOp → end node (preserves incoming connections like If false branch)
	"n8n-nodes-base.noop": { type: "end" },
	"n8n-nodes-base.noopnode": { type: "end" },

	// Respond to Webhook (native node, not just "end")
	"n8n-nodes-base.respondtowebhook": { type: "nativeRespondToWebhook" },

	// Sticky notes
	"n8n-nodes-base.stickynote": {
		type: "text",
		description: "Converted from N8N sticky note",
	},

	// Integration nodes
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

	// LangChain Agent → native aiAgent node
	"@n8n/n8n-nodes-langchain.agent": { type: "aiAgent", agentType: "tools" },

	// LangChain LLM Chain → aiAgent (needs bottom handles for sub-node connections)
	// In N8N, chainLlm has ai_languageModel and ai_outputParser sub-node ports,
	// so it must be an aiAgent (WideNode) to render those connections correctly.
	"@n8n/n8n-nodes-langchain.chainllm": { type: "aiAgent", agentType: "tools" },

	// LangChain tool sub-nodes → toolNode (renders as round "Tool" circle)
	"@n8n/n8n-nodes-langchain.toolcode": { type: "toolNode", toolType: "builtinTool" },
	"@n8n/n8n-nodes-langchain.toolcalculator": { type: "toolNode", toolType: "builtinTool" },
	"@n8n/n8n-nodes-langchain.toolhttprequest": { type: "toolNode", toolType: "builtinTool" },
	"@n8n/n8n-nodes-langchain.toolwikipedia": { type: "toolNode", toolType: "builtinTool" },
	"@n8n/n8n-nodes-langchain.toolworkflow": { type: "toolNode", toolType: "builtinTool" },
	"@n8n/n8n-nodes-langchain.toolwolframalpha": { type: "toolNode", toolType: "builtinTool" },
	"@n8n/n8n-nodes-langchain.toolserpapi": { type: "toolNode", toolType: "builtinTool" },
	"@n8n/n8n-nodes-langchain.toolvectorstorelookup": { type: "toolNode", toolType: "builtinTool" },

	// LangChain memory sub-nodes → memoryNode (renders as round circle with "Memory" label)
	// Must be memoryNode (not toolNode) so v2-container routes to "memory" bottom handle
	"@n8n/n8n-nodes-langchain.memorybufferwindow": { type: "memoryNode", memoryType: "windowBuffer" },
	"@n8n/n8n-nodes-langchain.memorymotorhead": { type: "memoryNode", memoryType: "simpleMemory" },
	"@n8n/n8n-nodes-langchain.memoryxata": { type: "memoryNode", memoryType: "simpleMemory" },
	"@n8n/n8n-nodes-langchain.memoryzep": { type: "memoryNode", memoryType: "simpleMemory" },

	// LangChain output parser sub-nodes → toolNode (renders as round circle)
	"@n8n/n8n-nodes-langchain.outputparserautofixing": { type: "toolNode", toolType: "builtinTool" },
	"@n8n/n8n-nodes-langchain.outputparseritemlist": { type: "toolNode", toolType: "builtinTool" },

	// LLM nodes — standalone OpenAI node (renders as card)
	"@n8n/n8n-nodes-langchain.openai": {
		type: "textGeneration",
		provider: "openai",
		modelId: "gpt-4o",
	},

	// LangChain LM sub-nodes → chatModel (renders as round circle with "Model" label)
	// Model IDs must be in "provider/model-name" format matching the language-model-registry
	"@n8n/n8n-nodes-langchain.lmchatopenai": {
		type: "chatModel",
		provider: "openai",
		defaultModelId: "openai/gpt-5",
	},
	"@n8n/n8n-nodes-langchain.lmopenai": {
		type: "chatModel",
		provider: "openai",
		defaultModelId: "openai/gpt-5",
	},
	"@n8n/n8n-nodes-langchain.lmchatanthropic": {
		type: "chatModel",
		provider: "anthropic",
		defaultModelId: "anthropic/claude-sonnet-4.5",
	},
	"@n8n/n8n-nodes-langchain.lmchatgooglegenerativeai": {
		type: "chatModel",
		provider: "google",
		defaultModelId: "google/gemini-2.5-flash",
	},
	"@n8n/n8n-nodes-langchain.lmchatgooglegemini": {
		type: "chatModel",
		provider: "google",
		defaultModelId: "google/gemini-2.5-flash",
	},

	// Additional LangChain LM sub-nodes (showcase/alternative models in templates)
	"@n8n/n8n-nodes-langchain.lmchatmistralcloud": {
		type: "chatModel",
		provider: "openai",
		defaultModelId: "openai/gpt-5",
	},
	"@n8n/n8n-nodes-langchain.lmchatopenrouter": {
		type: "chatModel",
		provider: "openai",
		defaultModelId: "openai/gpt-5",
	},
	"@n8n/n8n-nodes-langchain.lmchatxaigrok": {
		type: "chatModel",
		provider: "xai",
		defaultModelId: "xai/grok-3",
	},
	"@n8n/n8n-nodes-langchain.lmchatdeepseek": {
		type: "chatModel",
		provider: "openai",
		defaultModelId: "openai/gpt-5",
	},
	"@n8n/n8n-nodes-langchain.lmopenhuggingfaceinference": {
		type: "chatModel",
		provider: "openai",
		defaultModelId: "openai/gpt-5",
	},
	"@n8n/n8n-nodes-langchain.lmchatollama": {
		type: "chatModel",
		provider: "openai",
		defaultModelId: "openai/gpt-5",
	},
	"@n8n/n8n-nodes-langchain.lmchatazureopenai": {
		type: "chatModel",
		provider: "openai",
		defaultModelId: "openai/gpt-5",
	},

	// LangChain tool/parser sub-nodes → toolNode (renders as round circle with "Tool" label)
	"@n8n/n8n-nodes-langchain.outputparserstructured": {
		type: "toolNode",
		toolType: "builtinTool",
	},
	"@n8n/n8n-nodes-langchain.toolthink": {
		type: "toolNode",
		toolType: "builtinTool",
	},

	// MCP Client nodes (community/Bright Data)
	"n8n-nodes-mcp.mcpclienttool": { type: "toolNode", toolType: "builtinTool" },
};

// Pattern-based mappings
const PATTERN_MAPPINGS: Array<[string, VibexeNodeMapping]> = [
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

// N8N credential type -> Vibexe piece name (for credential hints)
export const N8N_CREDENTIAL_TO_PIECE: Record<string, string> = {
	slackOAuth2Api: "slack",
	slackApi: "slack",
	googleSheetsOAuth2Api: "google-sheets",
	googleDriveOAuth2Api: "google-drive",
	gmailOAuth2: "gmail",
	notionApi: "notion",
	airtableApi: "airtable",
	airtableTokenApi: "airtable",
	hubspotOAuth2Api: "hubspot",
	discordOAuth2Api: "discord",
	discordWebhookApi: "discord",
	telegramApi: "telegram-bot",
	stripeApi: "stripe",
	mailchimpApi: "mailchimp",
	twitterOAuth2Api: "twitter",
	linkedInOAuth2Api: "linkedin",
	googleCalendarOAuth2Api: "google-calendar",
	dropboxOAuth2Api: "dropbox",
	zoomOAuth2Api: "zoom",
	googleContactsOAuth2Api: "google-contacts",
	shopifyApi: "shopify",
	jiraCloudApi: "jira-cloud",
	mondayComOAuth2Api: "monday",
	clickUpOAuth2Api: "clickup",
	asanaOAuth2Api: "asana",
	trelloApi: "trello",
	gitlabOAuth2Api: "gitlab",
	githubOAuth2Api: "github",
	boxOAuth2Api: "box",
	microsoftOutlookOAuth2Api: "microsoft-outlook",
	microsoftTeamsOAuth2Api: "microsoft-teams",
	openAiApi: "openai",
	anthropicApi: "openai", // Uses API key auth
	googlePalmApi: "google-generative-ai",
	httpBasicAuth: "http",
	httpDigestAuth: "http",
	httpHeaderAuth: "http",
	httpQueryAuth: "http",
};

// Langchain node name -> provider
const LANGCHAIN_TO_PIECE_NAME: Record<string, string> = {
	openai: "openai",
	lmopenai: "openai",
	lmchatanthropic: "openai", // Will be mapped to textGeneration instead
	lmchatgooglegenerativeai: "openai", // Will be mapped to textGeneration instead
};
