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
				model: resolveModel(modelId),
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
		const lastUserMessage =
			[...messages].reverse().find((m) => m.role === "user")?.content || "";
		const userPrompt =
			typeof lastUserMessage === "string"
				? lastUserMessage
				: JSON.stringify(lastUserMessage);

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
		const agentPrompt = developerAgent
			? plan.agentPrompts.get(developerAgent.id)
			: undefined;

		// Build the system prompt: orchestrated agent prompt + file generation rules
		const fileGenerationRules = `
## File Tools Available
- create_file: Create files with path and content
- update_file: Modify existing files
- delete_file: Remove files

## CRITICAL WORKFLOW
When the user describes an app, create files using create_file tool calls.
You MUST create at minimum:
1. Blueprint.md — Architecture overview (component tree, data flow, tech decisions)
2. src/App.tsx — Main React component with COMPLETE working code
3. README.md — Comprehensive project documentation

For medium/complex apps, also create:
- src/components/*.tsx — Separate component files
- src/hooks/*.ts — Custom hooks
- src/utils/*.ts — Utility functions
- src/types/index.ts — Type definitions
- src/context/*.tsx — Context providers (if needed)

## Blueprint.md Format
\`\`\`markdown
# [App Name] — Architecture Blueprint

## Overview
[2-3 paragraph description of what the app does]

## Architecture
- Component tree with relationships
- Data flow description
- State management approach

## Tech Stack
| Layer | Technology | Rationale |
|-------|-----------|-----------|

## File Structure
[Tree of all files being generated]

## Implementation Phases
1. Phase 1: [description] — [files]
2. Phase 2: [description] — [files]
\`\`\`

## Code Requirements
- React functional components with TypeScript
- Tailwind CSS for all styling (CDN is preloaded — do NOT import CSS files)
- DO NOT use external packages (no framer-motion, no react-icons, etc.)
- For icons, use simple SVG or emoji characters
- Export components as default
- All code must be complete and render without errors

## IMPORTANT
DO NOT STOP until all required files are created.
Your response is INCOMPLETE unless Blueprint.md, src/App.tsx, and README.md all exist.`;

		const systemPrompt = agentPrompt
			? `${agentPrompt}\n\n${fileGenerationRules}`
			: fileGenerationRules;

		const tools = createFileTools(appId);
		const modelMessages = await convertToModelMessages(messages);

		// Use user-selected model if provided, otherwise use the agent's tier
		const model = modelId
			? resolveModel(modelId)
			: developerAgent
				? resolveModelByTier(developerAgent.modelTier)
				: resolveModel();

		const isReplication = plan.intent.suggestedFlow === "replicate";
		const maxSteps = isReplication ? 40 : 25;

		console.log(
			`[Chat API] Orchestration: complexity=${plan.intent.complexity}, flow=${plan.intent.suggestedFlow}, agents=${plan.agents.map((a) => a.id).join("->")}, model=${modelId || developerAgent?.modelTier || "default"}, maxSteps=${maxSteps}${detectedUrls.length > 0 ? `, url=${detectedUrls[0]}` : ""}`,
		);

		// Stream orchestration events + AI response via UI message stream
		const stream = createUIMessageStream({
			execute: async ({ writer }) => {
				// 1. Write orchestration-start event as data part
				writer.write({
					type: "data-agent-event" as const,
					data: {
						type: "orchestration-start",
						intent: {
							complexity: plan.intent.complexity,
							suggestedFlow: plan.intent.suggestedFlow,
							techStack: plan.intent.techStack,
						},
						agents: plan.agents.map((a) => ({
							id: a.id,
							name: a.name,
							modelTier: a.modelTier,
							readOnly: a.readOnly,
							icon: a.icon,
						})),
						timestamp: Date.now(),
					},
				} as never);

				// 2. Write agent-start events with skills as data parts
				for (const agent of plan.agents) {
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
				const result = streamText({
					model,
					system: systemPrompt,
					messages: modelMessages,
					tools,
					maxSteps,
					toolChoice: "required",
					onFinish: () => {
						console.log(
							`[Chat API] Stream finished - Chat: ${chatId || "new"}, Intent: ${plan.intent.complexity}`,
						);
					},
				});

				writer.merge(
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
