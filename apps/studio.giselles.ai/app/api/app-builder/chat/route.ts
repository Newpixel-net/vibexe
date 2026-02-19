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
	createUIMessageStream,
	createUIMessageStreamResponse,
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
	analyzeUrl,
	formatSiteAnalysis,
} from "@/app/(main)/app-builder/lib/url-analyzer";
import { getUser } from "@/lib/auth/get-user";
import { resolveAllProviderApiKeys } from "@/lib/team-ai-provider-keys";

// Initialize engine registries (runs once at module load)
registerAgents(DEFAULT_AGENTS);
registerSkills(DEFAULT_SKILLS);

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
		if (detectedUrls.length > 0) {
			try {
				const analysis = await analyzeUrl(detectedUrls[0]);
				if (analysis) {
					enrichedFileContext = `${fileContext}\n\n${formatSiteAnalysis(analysis)}`;
					console.log(
						`[Chat API] URL analysis complete: ${detectedUrls[0]} — ${analysis.fonts.length} fonts, ${analysis.colors.length} colors, ${analysis.layout.sections.length} sections`,
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

		// Build the system prompt — Plan first (Blueprint.md), then build
		const systemPrompt = `You are an expert fullstack developer. Your job is to PLAN and BUILD working applications.

## WORKFLOW: Plan First, Then Build

### Phase 1: Blueprint (ALWAYS DO THIS FIRST)
Create a **Blueprint.md** file using create_file with a comprehensive project plan:
- **App Overview**: What the app does, target users, and core value proposition
- **Features**: Detailed list of ALL features with descriptions and acceptance criteria
- **Architecture**: Component hierarchy, data flow, and state management approach
- **Data Models**: Entity definitions with fields, types, and relationships (if using backend)
- **File Structure**: Complete list of ALL files that will be created with descriptions
- **Tech Stack**: React + TypeScript + Tailwind CSS, plus any patterns used
- **UI/UX Plan**: Layout structure, navigation, color scheme, responsive design approach

### Phase 2: Code Generation (AFTER Blueprint.md is created)
Create ALL code files using create_file.
BATCH multiple create_file calls in a single response when files are independent.

**File creation order:**
1. Blueprint.md — Full project documentation (ALWAYS FIRST)
2. src/App.tsx — Main React component
3. src/components/*.tsx — Feature components (one per file)
4. src/hooks/*.ts — Custom hooks
5. src/types/index.ts — TypeScript types
6. src/utils/*.ts — Utility functions
7. src/context/*.tsx — Context providers if needed

## Data Management
- For most apps: use React state (useState) and localStorage for persistence. This works immediately.
- When the user asks for a SaaS, multi-user app, or backend: call define_entities to create real database tables.
- If define_entities returns an error, fall back to localStorage instead.

## Backend SDK (only when define_entities succeeds)
\`\`\`tsx
import { VibexeApp } from "@vibexe/sdk";
const app = new VibexeApp({ appId: "${appId}" });
// app.data.list("entity"), app.data.create("entity", data), etc.
\`\`\`

## Code Standards
- React + TypeScript + Tailwind CSS (CDN preloaded, NO CSS imports needed)
- NO external packages — use inline SVG or emoji for icons
- Every file must be COMPLETE and render without errors

## IMPORTANT
- ALWAYS create Blueprint.md first with the full project plan.
- Create ALL code files. Do NOT stop after 1-2 files.
- Every create_file call must contain COMPLETE, working code.
- For complex apps: create 8-15+ files with proper component separation.

## COMPLETION
After creating ALL files, write a brief summary (3-5 lines) of what was built and list all features.
Your FINAL message MUST be text-only with NO tool calls.
${enrichedFileContext ? `\n## Project Context\n${enrichedFileContext}` : ""}`;

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

		// Stream orchestration events + AI response via UI message stream
		const stream = createUIMessageStream({
			execute: async ({ writer }) => {
				// 1. Write orchestration-start event as data part
				const activeAgents = developerAgent ? [developerAgent] : plan.agents.filter((a) => !a.readOnly);
				writer.write({
					type: "data-agent-event" as const,
					data: {
						type: "orchestration-start",
						intent: {
							complexity: plan.intent.complexity,
							suggestedFlow: plan.intent.suggestedFlow,
							techStack: plan.intent.techStack,
						},
						agents: activeAgents.map((a) => ({
							id: a.id,
							name: a.name,
							modelTier: a.modelTier,
							readOnly: a.readOnly,
							icon: a.icon,
						})),
						timestamp: Date.now(),
					},
				} as never);

				// 2. Write agent-start event for the developer agent only
				for (const agent of activeAgents) {
					const skills = plan.agentSkills.get(agent.id) || [];
					writer.write({
						type: "data-agent-event" as const,
						data: {
							type: "agent-start",
							agentId: agent.id,
							agentName: agent.name,
							modelTier: agent.modelTier,
							icon: agent.icon,
							readOnly: agent.readOnly,
							skills: skills.map((s) => ({
								id: s.id,
								name: s.name,
								category: s.category,
							})),
							timestamp: Date.now(),
						},
					} as never);
				}

				// 3. Run the AI stream and merge into writer
				let stepCount = 0;
				let totalFileCalls = 0;
				const result = streamText({
					model,
					system: systemPrompt,
					messages: modelMessages,
					tools,
					maxSteps,
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

				await writer.merge(
					result.toUIMessageStream({ originalMessages: messages }),
				);
			},
			onError: (error) => {
				console.error("[Chat API] Stream error:", error);
				return String(error);
			},
		});

		return createUIMessageStreamResponse({ stream });
	} catch (error) {
		console.error("[Chat API] Error:", error);
		return new Response(JSON.stringify({ error: "Internal server error" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
