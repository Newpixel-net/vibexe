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
} from "@vibexe-ai/vibexe-engine";
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
	getFileByPath,
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
			mode?: "generate" | "discussion" | "continue";
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

		// Continue mode — use the continuation-analyst agent from the engine
		if (mode === "continue") {
			// Gather project context for the continuation analyst
			let projectContext = fileContext;
			if (existingFiles.length > 0) {
				try {
					const blueprint = await getFileByPath(appId, "Blueprint.md");
					if (blueprint?.content) {
						projectContext += `\n\n## Blueprint.md\n\`\`\`markdown\n${blueprint.content.slice(0, 6000)}\n\`\`\``;
					}
					const appTsx = await getFileByPath(appId, "src/App.tsx");
					if (appTsx?.content) {
						projectContext += `\n\n## src/App.tsx\n\`\`\`tsx\n${appTsx.content.slice(0, 4000)}\n\`\`\``;
					}
					const types = await getFileByPath(appId, "src/types/index.ts");
					if (types?.content) {
						projectContext += `\n\n## src/types/index.ts\n\`\`\`typescript\n${types.content.slice(0, 3000)}\n\`\`\``;
					}
				} catch (_) {
					// Best-effort file reading
				}
			}

			// Use orchestration engine to get the continuation-analyst's assembled prompt
			const continuePlan = executeOrchestration("continue what next", ALL_FLOWS, projectContext);
			const continueAgent = continuePlan.agents[0];
			const continueSystemPrompt = continueAgent
				? (continuePlan.agentPrompts.get(continueAgent.id) || "")
				: "Analyze this project and suggest next steps.";

			const readOnlyTools = createFileTools(appId);
			const modelMessages = await convertToModelMessages(messages);
			const byok = hasByok ? byokKeys : undefined;
			const model = modelId
				? resolveModel(modelId, byok)
				: continueAgent
					? resolveModelByTier(continueAgent.modelTier, byok)
					: resolveModel(undefined, byok);

			console.log(`[Chat API] Continue mode: ${existingFiles.length} files, agent=${continueAgent?.id || "fallback"}, model=${modelId || continueAgent?.modelTier || "default"}`);

			const result = streamText({
				model,
				system: continueSystemPrompt,
				messages: modelMessages,
				tools: { read_file: readOnlyTools.read_file },
				stopWhen: stepCountIs(10),
				toolChoice: "auto",
			});

			return result.toUIMessageStreamResponse({
				originalMessages: messages,
				sendRoundtrips: true,
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

		// --- Pipeline action prefixes ---
		const isReviewCode = userPrompt.startsWith("[REVIEW CODE]");
		// Detect URLs in user prompt and fetch site analysis
		const URL_REGEX = /https?:\/\/[^\s"'<>]+/gi;
		const detectedUrls = userPrompt.match(URL_REGEX) || [];

		// Inject Blueprint.md content for returning users (gives AI full project context)
		let blueprintContext = "";
		if (existingFiles.length > 0) {
			try {
				const blueprint = await getFileByPath(appId, "Blueprint.md");
				if (blueprint?.content) {
					const truncated = blueprint.content.length > 4000
						? `${blueprint.content.slice(0, 4000)}\n... (truncated)`
						: blueprint.content;
					blueprintContext = `\n\n## Blueprint (Project Documentation)\n\`\`\`markdown\n${truncated}\n\`\`\``;
				}
			} catch (_) {
				// Blueprint read is best-effort
			}
		}

		let enrichedFileContext = fileContext + blueprintContext;
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

		// Detect Visual Edit mode — message format:
		// [VISUAL EDIT] Element: <tag> with classes "..."
		// Source: filepath:lineNumber
		// Text content: "..."
		// User request: ...
		const isVisualEdit = userPrompt.startsWith("[VISUAL EDIT]");
		let visualEditSystemAddendum = "";
		if (isVisualEdit) {
			// Extract source file hint from the message
			const sourceMatch = userPrompt.match(/Source:\s*([^\n]+)/);
			const sourceHint = sourceMatch
				? `\n- The element is located at: ${sourceMatch[1]}. Use read_file on that file first.`
				: "";
			visualEditSystemAddendum = `\n\n## VISUAL EDIT MODE
The user is using Visual Edit mode. They selected a specific element in the live preview and want a targeted change.
- The user message contains the element's tag name, CSS classes, text content, and source file location.${sourceHint}
- Use read_file to open the source file, then update_file with the MINIMAL change needed.
- Do NOT rewrite the entire file — only modify the specific element mentioned.
- Be precise: match the element by its tag, classes, and text content.
- Make the exact change requested and nothing else.
- Respond concisely — no need for lengthy explanations for visual edits.`;
		}

		// --- REVIEW CODE handler ---
		// When user clicks "Review Code", we read all project files and stream a
		// combined code quality + security review from the code-reviewer agent.
		if (isReviewCode) {
			const allFiles = await getFilesForApp(appId);
			const fileContents: string[] = [];
			for (const f of allFiles.slice(0, 15)) {
				try {
					const file = await getFileByPath(appId, f.path);
					if (file?.content) {
						const truncated = file.content.length > 4000
							? `${file.content.slice(0, 4000)}\n... (truncated)`
							: file.content;
						fileContents.push(`## ${f.path}\n\`\`\`\n${truncated}\n\`\`\``);
					}
				} catch (_) {
					// Best-effort file reading
				}
			}

			const reviewFileContext = fileContents.join("\n\n");
			const reviewPlan = executeOrchestration("review code quality security audit", ALL_FLOWS, reviewFileContext);
			const reviewer = reviewPlan.agents.find((a) => a.id === "code-reviewer") || reviewPlan.agents[0];
			let reviewPrompt = reviewer ? (reviewPlan.agentPrompts.get(reviewer.id) || "") : "";

			// Add security audit section
			reviewPrompt += `\n\n## ALSO: Security Audit
In addition to code quality, audit for: XSS (dangerouslySetInnerHTML, user input in DOM), auth bypass, hardcoded secrets, eval(), missing input validation, token exposure. Add a **Security Audit** section after the Code Review.`;

			// Add files to review
			reviewPrompt += `\n\n# Project Files to Review\n\n${reviewFileContext}`;

			// End instruction
			reviewPrompt += `\n\nEnd with a Combined Verdict section in this format:
\`\`\`
## Combined Verdict
- **Code Quality**: APPROVE / WARNING / BLOCK
- **Security**: PASS / WARNING / FAIL
- **Issues Found**: [count]
- **Recommended Fixes**: [1-sentence summary]
\`\`\`
If any issues need fixing, end with exactly: '---\\n*Click **Fix Issues** below to auto-fix these problems.*'`;

			const reviewByok = hasByok ? byokKeys : undefined;
			const reviewModel = modelId
				? resolveModel(modelId, reviewByok)
				: resolveModelByTier("sonnet", reviewByok);

			console.log(`[Chat API] Review mode: ${allFiles.length} files, reviewer=${reviewer?.id || "fallback"}`);

			const reviewResult = streamText({
				model: reviewModel,
				system: reviewPrompt,
				messages: await convertToModelMessages(messages),
				maxSteps: 1,
			});

			return reviewResult.toUIMessageStreamResponse({
				originalMessages: messages,
			});
		}

		// Run orchestration engine
		const plan = executeOrchestration(userPrompt, ALL_FLOWS, enrichedFileContext);

		// Find the developer agent (the one that actually writes files)
		const developerAgent = plan.agents.find((a) => !a.readOnly);

		// Detect backend type (native vs Supabase)
		const backendType = await getAppBackendType(appId);
		const supabaseConfig = backendType === "supabase" ? await getSupabaseConfig(appId) : null;

		// --- Build system prompt from orchestrated agent prompt + runtime addenda ---
		// The assembled prompt already contains: role, platform constraints, SDK docs,
		// code standards, skills content, complexity template, and project context.
		// We only add dynamic runtime-specific sections the agent couldn't know at definition time.

		const langInstructions = siteAnalysis && siteAnalysis.language.code !== "en"
			? buildLanguageInstructions(siteAnalysis)
			: "";

		const isReturningUser = existingFiles.length > 0;

		// Get the assembled prompt for the primary agent (developer or single-agent flow)
		const primaryAgent = developerAgent || plan.agents[0];
		let assembledPrompt = primaryAgent
			? plan.agentPrompts.get(primaryAgent.id) || ""
			: "";

		// Inject the actual appId into SDK examples (agent prompt has "..." placeholder)
		assembledPrompt = assembledPrompt.replace(
			/appId:\s*"\.\.\."/g,
			`appId: "${appId}"`,
		);

		// Build runtime addenda — only things not in the agent prompt
		const runtimeAddenda: string[] = [];

		// Supabase override: if app uses Supabase, override SDK instructions
		if (supabaseConfig) {
			runtimeAddenda.push(`## ⚠️ OVERRIDE: Supabase Connected (ignore @vibexe/sdk instructions)
This app is connected to a Supabase project. Use the Supabase client for ALL data access:
\`\`\`tsx
import { createClient } from "@supabase/supabase-js";
const supabase = createClient("${supabaseConfig.url}", "${supabaseConfig.anonKey}");
\`\`\`
- Use \`supabase.from("table").select()\` for queries
- Use \`supabase.from("table").insert()\` for inserts
- Use \`supabase.auth.signUp()\` / \`supabase.auth.signInWithPassword()\` for authentication
- Do NOT use \`@vibexe/sdk\` or \`define_entities\` — use Supabase directly
- You may import from \`@supabase/supabase-js\``);
		}

		// --- Plan-then-Execute Logic ---
		// Detect project state to implement two-phase generation:
		// Phase 1 (new project): Create ONLY Blueprint.md, stop, let user review
		// Phase 2 (user says "build it"): Execute the plan from Blueprint.md
		const hasCodeFiles = existingFiles.some(
			(f) =>
				f.path.endsWith(".tsx") ||
				f.path.endsWith(".ts") ||
				f.path.endsWith(".jsx") ||
				f.path.endsWith(".js"),
		);
		const hasBlueprintOnly =
			existingFiles.length > 0 &&
			existingFiles.some((f) => f.path === "Blueprint.md") &&
			!hasCodeFiles;
		const isNewProject = existingFiles.length === 0;

		if (isNewProject && !isVisualEdit) {
			// Phase 1: Plan only — create Blueprint.md and stop
			runtimeAddenda.push(`## ⚠️ PLAN FIRST (MANDATORY)

Create ONLY \`Blueprint.md\` with a comprehensive project plan. Include:
- **Overview**: What the app does, who it's for
- **Features**: Numbered list with acceptance criteria (F1, F2, F3...)
- **Data Model**: Entity schemas with fields, types, relationships
- **Auth Strategy**: No auth / Simple auth / Role-based
- **Component Architecture**: Component tree with parent→child relationships
- **File Map**: Every file to be created, in order, with purpose and dependencies
- **UX Flows**: Primary user journeys, empty/loading/error states
- **Getting Started**: If the app uses auth, include: "Sign up with any email and password (8+ characters) to create your first account. There are no default credentials — every user registers through the app."

Make Blueprint.md thorough and detailed — this is the plan the user will review.

After creating Blueprint.md, **STOP**. Do NOT create any code files (.ts, .tsx, .js, .jsx).

End your response with:
"📋 **Project plan created!** Review it in the **Documents tab**, then say **'build it'** when you're ready for me to generate the code."

CRITICAL: Only create Blueprint.md. No other files.`);
		} else if (hasBlueprintOnly) {
			// Phase 2: Execute the plan — Blueprint.md exists, no code yet
			runtimeAddenda.push(`## EXECUTE THE PLAN

The user has reviewed the Blueprint.md plan (available in the Documents tab). Now execute it:
1. Read Blueprint.md to understand the full plan
2. **CRITICAL: Create src/App.tsx FIRST** — this is the entry point that Sandpack needs to render the preview. Import all main page/layout components. Without App.tsx the preview will be blank.
3. Then create ALL remaining code files following the plan's File Map
4. Do NOT recreate or modify Blueprint.md — it's already done
5. Use define_entities to register data entities if the plan includes a Data Model section
6. **Auth UX**: If the app has auth, the Login/Register page MUST default to showing the **Sign Up** form (not Sign In), since new apps have zero users. Include a toggle to switch between Sign Up and Sign In.

Start immediately with file creation. Do not re-explain the plan.

After creating ALL files, end with a short summary. If the app has auth, include:
"To get started, **sign up** with any email and password (8+ characters) to create your first account."`);
		} else if (isReturningUser) {
			// Normal existing project — edit/add files
			runtimeAddenda.push(`## Existing Project (${existingFiles.length} files)
This is an EXISTING project. Use \`read_file\` to inspect existing files BEFORE modifying them with \`update_file\`. Never blindly overwrite files without reading them first.`);
		}

		// --- FIX FLOW: Inject existing file contents so the error resolver has full context ---
		if (plan.intent.suggestedFlow === "fix" && existingFiles.length > 0) {
			const fileContents: string[] = [];
			for (const f of existingFiles.slice(0, 12)) {
				try {
					const file = await getFileByPath(appId, f.path);
					if (file?.content) {
						const truncated = file.content.length > 3000
							? `${file.content.slice(0, 3000)}\n... (truncated)`
							: file.content;
						fileContents.push(`### ${f.path}\n\`\`\`\n${truncated}\n\`\`\``);
					}
				} catch (_) {
					// Best-effort
				}
			}
			if (fileContents.length > 0) {
				runtimeAddenda.push(`## Current Project Files (for diagnosis)\n\n${fileContents.join("\n\n")}`);
			}
		}

		// Language/RTL instructions from URL analysis
		if (langInstructions) {
			runtimeAddenda.push(langInstructions);
		}

		// Visual edit mode addendum
		if (visualEditSystemAddendum) {
			runtimeAddenda.push(visualEditSystemAddendum);
		}

		// Combine: assembled agent prompt + runtime addenda
		let systemPrompt = runtimeAddenda.length > 0
			? `${assembledPrompt}\n\n${runtimeAddenda.join("\n\n")}`
			: assembledPrompt;

		const allTools = createFileTools(appId);

		// Agent-specific tool filtering: only pass tools the primary agent is allowed to use
		const agentToolIds = primaryAgent?.tools || [];
		const tools: Record<string, unknown> = {};
		for (const [toolId, toolDef] of Object.entries(allTools)) {
			if (agentToolIds.length === 0 || agentToolIds.includes(toolId)) {
				tools[toolId] = toolDef;
			}
		}

		const modelMessages = await convertToModelMessages(messages);
		const byok = hasByok ? byokKeys : undefined;

		// Use user-selected model if provided, otherwise use the primary agent's tier
		const model = modelId
			? resolveModel(modelId, byok)
			: developerAgent
				? resolveModelByTier(developerAgent.modelTier, byok)
				: resolveModel(undefined, byok);

		const isReplication = plan.intent.suggestedFlow === "replicate";
		const isFix = plan.intent.suggestedFlow === "fix";
		const isPlanOnly = isNewProject && !isVisualEdit;
		const maxSteps = isPlanOnly
			? 5 // Plan-only: just Blueprint.md creation
			: hasBlueprintOnly
				? 100 // Execute-plan: full project build from Blueprint needs many steps
				: isVisualEdit
					? 10
					: isFix
						? 30 // Fix flow: read + diagnose + fix (may need multiple read/update cycles)
						: isReplication
							? 100
							: plan.intent.complexity === "complex"
								? 100
								: plan.intent.complexity === "medium"
									? 60
									: 35;

		const upstreamCount = plan.agents.filter((a) => a.readOnly).length;
		console.log(
			`[Chat API] Orchestration: complexity=${plan.intent.complexity}, flow=${plan.intent.suggestedFlow}, agents=${plan.agents.map((a) => a.id).join("->")}, chained=${upstreamCount}, model=${modelId || primaryAgent?.modelTier || "default"}, maxSteps=${maxSteps}${isPlanOnly ? ", mode=plan-only" : hasBlueprintOnly ? ", mode=execute-plan" : ""}${detectedUrls.length > 0 ? `, url=${detectedUrls[0]}` : ""}`,
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
				const fileToolNames = ["create_file", "update_file", "delete_file", "define_entities", "read_file"];
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
