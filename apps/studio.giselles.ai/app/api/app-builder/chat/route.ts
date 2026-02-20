// Chat API endpoint with AI SDK streaming for App Builder
// Uses ECC multi-agent orchestration engine with skill-enriched prompts.
// Streams orchestration events (agent activations, skills, verdicts) via data channel.

import {
	ALL_FLOWS,
	DEFAULT_AGENTS,
	DEFAULT_SKILLS,
	executeOrchestration,
	registerAgents,
	registerSkills,
} from "@giselles-ai/vibexe-engine";
import type { UIMessage } from "ai";
import {
	convertToModelMessages,
	stepCountIs,
	streamText,
} from "ai";
import { createFileTools } from "@/app/(main)/app-builder/lib/file-tools";
import {
	type ByokApiKeys,
	resolveModel,
	resolveModelByTier,
} from "@/app/(main)/app-builder/lib/model-resolver";
import {
	getAppById,
	getFilesForApp,
} from "@/app/(main)/app-builder/lib/queries";
import {
	type SiteAnalysis,
	analyzeUrl,
	formatSiteAnalysis,
} from "@/app/(main)/app-builder/lib/url-analyzer";
import { getUser } from "@/lib/auth/get-user";
import { getSupabaseConfig, getAppBackendType } from "@/lib/app-database/supabase-connect";
import { resolveAllProviderApiKeys } from "@/lib/team-ai-provider-keys";

// Initialize engine registries (runs once at module load)
registerAgents(DEFAULT_AGENTS);
registerSkills(DEFAULT_SKILLS);

/**
 * Build language-specific instructions for the AI system prompt.
 * Ensures the AI generates content in the detected language with proper RTL support.
 */
function buildLanguageInstructions(analysis: SiteAnalysis): string {
	const { language } = analysis;
	const isRtl = language.direction === "rtl";

	let instructions = `\n## ⚠️ LANGUAGE & LOCALIZATION (MANDATORY)

**Detected language: ${language.label} (${language.code})**
**Text direction: ${language.direction.toUpperCase()}**

### CRITICAL RULES — YOU MUST FOLLOW ALL:
1. ALL visible text (headings, paragraphs, buttons, labels, navigation, footer, placeholders, tooltips, error messages) MUST be written in **${language.label}**
2. Do NOT translate content to English — keep everything in the original language
3. Variable names, function names, and code comments may remain in English
4. Use proper ${language.label} typography and punctuation conventions`;

	if (isRtl) {
		instructions += `

### RTL LAYOUT REQUIREMENTS (${language.label} is RTL):
1. The \`<html>\` element already has \`dir="rtl"\` set — Tailwind will handle most RTL automatically
2. Use Tailwind RTL utilities where available: \`rtl:mr-4\`, \`rtl:text-right\`, etc.
3. Navigation menus should flow right-to-left
4. Icons that indicate direction (arrows, chevrons) must be mirrored for RTL
5. Use \`flex-row-reverse\` for horizontal layouts that need RTL flow
6. Phone numbers and URLs remain left-to-right (use \`dir="ltr"\` inline)
7. For flexbox layouts, the browser's RTL mode will automatically reverse \`flex-row\` — use this instead of manually reversing
8. Text alignment defaults to right in RTL — only override when needed
9. Padding/margin: use logical properties when possible (\`ps-4\`/\`pe-4\` instead of \`pl-4\`/\`pr-4\`)`;
	}

	return instructions;
}

// Discussion mode prompt (no file tools)
const DISCUSSION_SYSTEM_PROMPT = `You are an expert full-stack developer helping users plan and discuss web applications.

Help the user:
- Understand their requirements
- Plan the architecture and features
- Suggest best practices and technologies
- Answer technical questions
- Review and explain code

You are in discussion mode - you cannot create or modify files directly.
When the user is ready to generate code, they should switch to generation mode.`;

export async function POST(request: Request) {
	try {
		const user = await getUser();
		if (!user) {
			return new Response(JSON.stringify({ error: "Unauthorized" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			});
		}

		const body = await request.json();
		const {
			messages,
			appId,
			chatId,
			mode = "generate",
			modelId,
		} = body as {
			messages: UIMessage[];
			appId: string;
			chatId?: string;
			mode?: "generate" | "discussion";
			modelId?: string;
		};

		if (!appId) {
			return new Response(JSON.stringify({ error: "Missing appId" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		if (!messages || !Array.isArray(messages) || messages.length === 0) {
			return new Response(JSON.stringify({ error: "Messages are required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		const app = await getAppById(appId, user.id);
		if (!app) {
			return new Response(JSON.stringify({ error: "App not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Resolve BYOK keys for the team (empty object if no team keys configured)
		const byokKeys: ByokApiKeys = await resolveAllProviderApiKeys(app.teamDbId);
		const hasByok = Object.keys(byokKeys).length > 0;

		// Log file attachments if present
		const fileParts = messages.flatMap((m: UIMessage) =>
			(m.parts || []).filter((p: { type: string }) => p.type === "file"),
		);
		if (fileParts.length > 0) {
			console.log(`[Chat API] ${fileParts.length} file attachment(s) included`);
		}

		// Get existing files for context
		const existingFiles = await getFilesForApp(appId);
		const fileContext =
			existingFiles.length > 0
				? `Existing files in the project:\n${existingFiles.map((f) => `- ${f.path}`).join("\n")}`
				: "";

		// Discussion mode — simple pass-through (no orchestration)
		if (mode === "discussion") {
			const modelMessages = await convertToModelMessages(messages);
			const result = streamText({
				model: resolveModel(modelId, hasByok ? byokKeys : undefined),
				system: DISCUSSION_SYSTEM_PROMPT,
				messages: modelMessages,
				toolChoice: "auto",
			});
			return result.toUIMessageStreamResponse({
				originalMessages: messages,
			});
		}

		// --- GENERATE MODE: Multi-agent orchestration ---

		// Extract latest user message for intent classification
		// AI SDK v5: content may be empty with text in parts[].text
		const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
		let userPrompt = "";
		if (lastUserMsg) {
			const content = lastUserMsg.content;
			if (typeof content === "string" && content.length > 0) {
				userPrompt = content;
			} else {
				// Fallback: extract text from parts array (AI SDK v5+ format)
				const parts = (lastUserMsg as Record<string, unknown>).parts;
				if (Array.isArray(parts)) {
					userPrompt = parts
						.filter((p: Record<string, unknown>) => p.type === "text" && typeof p.text === "string")
						.map((p: Record<string, unknown>) => p.text)
						.join("\n");
				}
				if (!userPrompt) {
					userPrompt = typeof content === "string" ? content : JSON.stringify(content);
				}
			}
		}
		// Detect URLs in user prompt and fetch site analysis
		const URL_REGEX = /https?:\/\/[^\s"'<>]+/gi;
		const detectedUrls = userPrompt.match(URL_REGEX) || [];

		let enrichedFileContext = fileContext;
		let siteAnalysis: SiteAnalysis | null = null;
		if (detectedUrls.length > 0) {
			try {
				siteAnalysis = await analyzeUrl(detectedUrls[0]);
				if (siteAnalysis) {
					enrichedFileContext = `${fileContext}\n\n${formatSiteAnalysis(siteAnalysis)}`;
					console.log(
						`[Chat API] URL analysis complete: ${detectedUrls[0]} — lang=${siteAnalysis.language.code} (${siteAnalysis.language.direction}), ${siteAnalysis.fonts.length} fonts, ${siteAnalysis.colors.length} colors, ${siteAnalysis.layout.sections.length} sections`,
					);
				}
			} catch (error) {
				console.error("[Chat API] URL analysis failed:", error);
			}
		}

		// Run orchestration engine
		const plan = executeOrchestration(userPrompt, ALL_FLOWS, enrichedFileContext);

		// Find the developer agent (the one that actually writes files)
		const developerAgent = plan.agents.find((a) => !a.readOnly);

		// Detect backend type (native vs Supabase)
		const backendType = await getAppBackendType(appId);
		const supabaseConfig = backendType === "supabase" ? await getSupabaseConfig(appId) : null;

		const dataManagementSection = supabaseConfig
			? `## Data Management — Supabase Connected
This app is connected to a Supabase project. Use the Supabase client for ALL data access:
\`\`\`tsx
import { createClient } from "@supabase/supabase-js";
const supabase = createClient("${supabaseConfig.url}", "${supabaseConfig.anonKey}");
\`\`\`
- Use \`supabase.from("table").select()\` for queries
- Use \`supabase.from("table").insert()\` for inserts
- Use \`supabase.auth.signUp()\` / \`supabase.auth.signInWithPassword()\` for authentication
- Do NOT use \`@vibexe/sdk\` or \`define_entities\` — use Supabase directly
- Do NOT call define_entities — the user manages their schema through Supabase Dashboard`
			: `## Data Management
- Default: React state (useState) + localStorage for persistence
- SaaS/multi-user apps: call define_entities to create database tables, then use:
\`\`\`tsx
import { VibexeApp } from "@vibexe/sdk";
const app = new VibexeApp({ appId: "${appId}" });
\`\`\``;

		// Build the system prompt — all files created via consecutive create_file calls
		// Build language-specific instructions when a non-English site is detected
		const langInstructions = siteAnalysis && siteAnalysis.language.code !== "en"
			? buildLanguageInstructions(siteAnalysis)
			: "";

		const systemPrompt = `You are an expert fullstack developer. Create COMPLETE web applications.
You support 100+ languages including RTL languages like Hebrew, Arabic, Persian, and Urdu.

## TASK

Call create_file for EVERY file the application needs. A typical app requires 8-15+ files.

## Required Files (call create_file for ALL)

1. **Blueprint.md** — Full project documentation: overview, features with acceptance criteria, architecture, data flow, component structure, complete file list, tech stack, UI/UX notes
2. **src/types/index.ts** — TypeScript interfaces and type definitions
3. **Utility files** — src/utils/*.ts for helpers, constants, mock data
4. **React hooks** — src/hooks/*.ts for data management, localStorage, state
5. **Components** — src/components/*.tsx, one file per UI component, well-separated by feature
6. **src/App.tsx** — Main component importing and rendering all components

You MUST call create_file for items 1-6 above. Do NOT stop after creating Blueprint.md — keep calling create_file for every remaining file. Aim for 8-15+ total create_file calls.

After ALL create_file calls are done, write a SHORT summary (2-3 sentences) of what was built.

${dataManagementSection}

## Code Standards
- React + TypeScript + Tailwind CSS (CDN preloaded, NO CSS imports needed)
- NO external packages — use inline SVG or emoji for icons${supabaseConfig ? "\n- EXCEPTION: You may import from `@supabase/supabase-js`" : ""}
- Every file must be COMPLETE and render without errors
- Complex apps need 8-15+ well-separated component files
${langInstructions}${enrichedFileContext ? `\n## Project Context\n${enrichedFileContext}` : ""}`;

		const tools = createFileTools(appId);
		const modelMessages = await convertToModelMessages(messages);

		// Use user-selected model if provided, otherwise use the agent's tier
		const byok = hasByok ? byokKeys : undefined;
		const model = modelId
			? resolveModel(modelId, byok)
			: developerAgent
				? resolveModelByTier(developerAgent.modelTier, byok)
				: resolveModel(undefined, byok);

		const isReplication = plan.intent.suggestedFlow === "replicate";
		const maxSteps = isReplication
			? 100
			: plan.intent.complexity === "complex"
				? 100
				: plan.intent.complexity === "medium"
					? 60
					: 35;

		console.log(
			`[Chat API] Orchestration: complexity=${plan.intent.complexity}, flow=${plan.intent.suggestedFlow}, agents=${plan.agents.map((a) => a.id).join("->")}, model=${modelId || developerAgent?.modelTier || "default"}, maxSteps=${maxSteps}${detectedUrls.length > 0 ? `, url=${detectedUrls[0]}` : ""}`,
		);

		// Use streamText directly with toUIMessageStreamResponse for proper multi-step support.
		// The createUIMessageStream + writer.merge() pattern breaks multi-step: the model
		// gets finishReason=tool-calls (wants to continue) but the stream closes after step 1.
		let stepCount = 0;
		let totalFileCalls = 0;
		const result = streamText({
			model,
			system: systemPrompt,
			messages: modelMessages,
			tools,
			stopWhen: stepCountIs(maxSteps),
			toolChoice: "auto",
			onStepFinish: ({ toolCalls, finishReason, usage }) => {
				stepCount++;
				const fileToolNames = ["create_file", "update_file", "delete_file", "define_entities"];
				const fileCallsInStep = (toolCalls || []).filter(
					(tc) => fileToolNames.includes(tc.toolName),
				).length;
				totalFileCalls += fileCallsInStep;
				const toolNames = (toolCalls || []).map((tc) => tc.toolName).join(",") || "text-only";
				console.log(
					`[Chat API] Step ${stepCount}: tools=${toolNames}, files=${totalFileCalls}, tokens=${usage?.totalTokens || 0}, finish=${finishReason}`,
				);
			},
			onFinish: (event) => {
				console.log(
					`[Chat API] Stream finished - Chat: ${chatId || "new"}, steps=${stepCount}, files=${totalFileCalls}, maxSteps=${maxSteps}, finishReason=${event.finishReason}`,
				);
			},
		});

		return result.toUIMessageStreamResponse({
			originalMessages: messages,
			sendRoundtrips: true,
		});
	} catch (error) {
		console.error("[Chat API] Error:", error);
		return new Response(JSON.stringify({ error: "Internal server error" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
