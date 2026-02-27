// Chat API endpoint with AI SDK streaming for App Builder
// Uses ECC multi-agent orchestration engine with skill-enriched prompts.
// Streams orchestration events (agent activations, skills, verdicts) via data channel.

import {
	ALL_FLOWS,
	DEFAULT_AGENTS,
	DEFAULT_SKILLS,
	assemblePrompt,
	executeOrchestration,
	getAgent,
	registerAgents,
	registerSkills,
	resolveSkills,
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
	getFallbackChain,
	validateModelConfig,
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
import {
	type AppStoreAnalysis,
	isAppStoreUrl,
	analyzeAppStoreUrl,
	formatAppStoreAnalysis,
} from "@/app/(main)/app-builder/lib/app-store-analyzer";
import { getUser } from "@/lib/auth/get-user";
import { getSupabaseConfig, getAppBackendType } from "@/lib/app-database/supabase-connect";
import { resolveAllProviderApiKeys } from "@/lib/team-ai-provider-keys";
import { syncWiki } from "@/lib/wiki/wiki-sync";
import { buildWikiContext } from "@/lib/wiki/context-selector";

// Initialize engine registries (runs once at module load)
registerAgents(DEFAULT_AGENTS);
registerSkills(DEFAULT_SKILLS);

// appendToDevLog removed — replaced by syncWiki() from lib/wiki/wiki-sync.ts

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

// --- Visual Review helpers ---

function detectProjectType(filePaths: string, allContent: string): "game-mobile" | "game" | "mobile-app" | "webapp" {
	const hasCanvas = allContent.includes("canvas") && (allContent.includes("requestanimationframe") || allContent.includes("getcontext"));
	const hasGameKeywords = filePaths.includes("game") || allContent.includes("sprite") || allContent.includes("score") || allContent.includes("gameloop") || allContent.includes("game over");
	const hasTouchControls = allContent.includes("touchstart") || allContent.includes("touch-action") || allContent.includes("ontouchstart");
	const hasMobileKeywords = allContent.includes("9:16") || allContent.includes("mobile") || allContent.includes("portrait") || filePaths.includes("mobile");

	if ((hasCanvas || hasGameKeywords) && (hasTouchControls || hasMobileKeywords)) {
		return "game-mobile";
	}
	if (hasCanvas || hasGameKeywords) {
		return "game";
	}
	if (hasTouchControls || hasMobileKeywords) {
		return "mobile-app";
	}
	return "webapp";
}

function buildVisualReviewPrompt(projectType: string, fileContext: string): string {
	const baseIntro = `You are a visual QA reviewer with vision capabilities. You will receive a screenshot of a running app preview along with its source code. Analyze BOTH the screenshot and the code to identify visual issues.`;

	const typeSpecificChecks: Record<string, string> = {
		"game-mobile": `
## Game (Mobile) — Visual Checks:
1. **Canvas rendering** — Is the game visible or is it a blank/black screen?
2. **Portrait orientation** — Does the game fill 9:16 aspect ratio properly? Is content cut off or letterboxed?
3. **Sprite/asset loading** — Are characters and environments visible (not broken image icons or empty rectangles)?
4. **Touch controls** — Are on-screen D-pad/buttons visible in the bottom 25% of screen?
5. **HUD** — Is score/lives/level info visible at the top?
6. **Loading state** — Is the user stuck on a loading screen or "Loading..." text?
7. **Game Over on start** — Is the game immediately showing Game Over without gameplay?
8. **Overflow** — Is any content overflowing the viewport boundaries?`,

		"game": `
## Game (Desktop) — Visual Checks:
1. **Canvas rendering** — Is the game visible or is it a blank/black screen?
2. **Aspect ratio** — Does the game fill the viewport properly (16:9 or responsive)?
3. **Sprite/asset loading** — Are characters, environments, and UI elements visible?
4. **Controls info** — Are keyboard control hints shown to the player?
5. **HUD** — Is score/lives/level info visible?
6. **Loading state** — Is the user stuck on a loading screen?
7. **Game Over on start** — Is the game immediately showing Game Over without gameplay?`,

		"mobile-app": `
## Mobile App — Visual Checks:
1. **Content rendering** — Is the main content visible or is the screen blank/empty?
2. **Layout** — Is the layout appropriate for mobile (no horizontal overflow)?
3. **Navigation** — Is the navigation accessible (bottom tabs, hamburger menu, or sidebar)?
4. **Touch targets** — Are buttons and interactive elements large enough (min 44px)?
5. **Text readability** — Is text legible (not too small, proper contrast)?
6. **Safe areas** — Is content not hidden behind status bar or bottom indicators?
7. **Scrolling** — Is content that needs scrolling properly scrollable?`,

		"webapp": `
## Web App — Visual Checks:
1. **Content rendering** — Is the main content visible or is the screen blank/white?
2. **Layout** — Is the page layout structured properly (header, main content, footer)?
3. **Navigation** — Is the navigation bar/menu visible and functional-looking?
4. **Forms** — Are form elements (inputs, buttons) visible and properly styled?
5. **Typography** — Is text readable with proper hierarchy (headings, body)?
6. **Spacing** — Are elements properly spaced (not overlapping, not cramped)?
7. **Colors** — Are colors applied correctly (not default browser styles)?
8. **Responsive** — Does the content adapt to the viewport width?`,
	};

	const checks = typeSpecificChecks[projectType] || typeSpecificChecks["webapp"];

	return `${baseIntro}
${checks}

## Source Code
${fileContext}

## Instructions
1. Analyze the screenshot carefully — describe what you see
2. Cross-reference with the source code to identify root causes
3. List each visual issue with severity (CRITICAL/WARNING/INFO)
4. For each issue, suggest the specific fix (which file, what CSS/code change)

End with:
## Visual Verdict
- **Visual Quality**: APPROVE / WARNING / BLOCK
- **Issues Found**: [count]
- **Summary**: [1-sentence summary]

Rules:
- APPROVE = the app looks functional, content is visible, layout is reasonable
- WARNING = minor visual issues but the app is usable
- BLOCK = blank screen, completely broken layout, missing critical content, or game not rendering

If verdict is WARNING or BLOCK, end with exactly:
---
*Click **Fix Issues** below to auto-fix these visual problems.*`;
}

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
			activeAgentId,
		} = body as {
			messages: UIMessage[];
			appId: string;
			chatId?: string;
			mode?: "generate" | "discussion" | "continue";
			modelId?: string;
			activeAgentId?: string;
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
		const hasDesignImages = fileParts.length > 0;

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
					// Use wiki context for continuation analyst
					const continueWiki = await buildWikiContext(appId, "continuation-analyst");
					if (continueWiki) {
						projectContext += continueWiki;
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

		// Inject wiki context for returning users — agent-specific pages with per-page budgets
		// Replaces the old fixed Blueprint.md (4K) + DEVLOG.md (3K) injection
		let wikiContext = "";
		if (existingFiles.length > 0) {
			try {
				// Determine which agent will run (best guess before orchestration)
				const guessAgentId = activeAgentId || "fullstack-developer";
				wikiContext = await buildWikiContext(appId, guessAgentId);
			} catch (_) {
				// Wiki context is best-effort
			}
		}

		let enrichedFileContext = fileContext + wikiContext;
		let siteAnalysis: SiteAnalysis | null = null;
		let appStoreAnalysis: AppStoreAnalysis | null = null;
		if (detectedUrls.length > 0) {
			// Check if any URL is an App Store / Google Play link
			const appStoreUrlMatch = detectedUrls.find((u) => isAppStoreUrl(u));
			if (appStoreUrlMatch) {
				try {
					appStoreAnalysis = await analyzeAppStoreUrl(appStoreUrlMatch);
					if (appStoreAnalysis) {
						enrichedFileContext = `${fileContext}\n\n${formatAppStoreAnalysis(appStoreAnalysis)}${wikiContext}`;
						console.log(
							`[Chat API] App Store analysis: ${appStoreAnalysis.appName} (${appStoreAnalysis.platform}), ${appStoreAnalysis.screenshotUrls.length} screenshots`,
						);
					}
				} catch (error) {
					console.error("[Chat API] App Store analysis failed:", error);
				}
			} else {
				try {
					siteAnalysis = await analyzeUrl(detectedUrls[0]);
					if (siteAnalysis) {
						enrichedFileContext = `${fileContext}\n\n${formatSiteAnalysis(siteAnalysis)}${wikiContext}`;
						console.log(
							`[Chat API] URL analysis complete: ${detectedUrls[0]} — lang=${siteAnalysis.language.code} (${siteAnalysis.language.direction}), ${siteAnalysis.fonts.length} fonts, ${siteAnalysis.colors.length} colors, ${siteAnalysis.layout.sections.length} sections`,
						);
					}
				} catch (error) {
					console.error("[Chat API] URL analysis failed:", error);
				}
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

		// --- VISUAL REVIEW handler ---
		// Deep Think visual review: analyze screenshot + code files with task-specific prompts
		const isVisualReview = userPrompt.startsWith("[VISUAL REVIEW]");
		if (isVisualReview) {
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
				} catch (_) {}
			}

			const allContent = fileContents.join("\n").toLowerCase();
			const filePaths = allFiles.map((f) => f.path.toLowerCase()).join("\n");
			const projectType = detectProjectType(filePaths, allContent);
			const visualPrompt = buildVisualReviewPrompt(projectType, fileContents.join("\n\n"));

			const visualByok = hasByok ? byokKeys : undefined;
			const visualModel = modelId
				? resolveModel(modelId, visualByok)
				: resolveModelByTier("sonnet", visualByok);

			console.log(`[Chat API] Visual Review: ${allFiles.length} files, projectType=${projectType}`);

			const visualResult = streamText({
				model: visualModel,
				system: visualPrompt,
				messages: await convertToModelMessages(messages),
				maxSteps: 1,
			});

			return visualResult.toUIMessageStreamResponse({ originalMessages: messages });
		}

		// --- VISUAL FIX handler ---
		// Deep Think visual fix: apply CSS/layout fixes for visual issues found in review
		const isVisualFix = userPrompt.startsWith("[VISUAL FIX]");
		if (isVisualFix) {
			const fileTools = createFileTools(appId);
			const visualFixByok = hasByok ? byokKeys : undefined;
			const visualFixModel = modelId
				? resolveModel(modelId, visualFixByok)
				: resolveModelByTier("sonnet", visualFixByok);

			console.log("[Chat API] Visual Fix mode");

			const visualFixResult = streamText({
				model: visualFixModel,
				system: `You are a UI/CSS specialist fixing visual issues in a web application.
The previous message contains a visual review with specific issues found in the live preview screenshot.

Rules:
- Use read_file to inspect each file before modifying it
- Use update_file with MINIMAL surgical changes — only fix the visual issues mentioned
- Focus on CSS: sizing, positioning, colors, spacing, overflow, visibility
- For blank screens: ensure the main component renders visible content
- For layout overflow: fix width/height constraints, add overflow-hidden where needed
- For missing content: check conditional rendering, ensure data is displayed
- Do NOT refactor or restructure code — only fix the visual problems
- Do NOT add new features or change functionality
- After fixes, briefly summarize what you changed`,
				messages: await convertToModelMessages(messages),
				tools: fileTools,
				stopWhen: stepCountIs(15),
				toolChoice: "auto",
			});

			return visualFixResult.toUIMessageStreamResponse({
				originalMessages: messages,
				sendRoundtrips: true,
			});
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

		// --- PINNED AGENT MODE: bypass orchestration when a user has activated a specific agent ---
		let pinnedAgent = activeAgentId ? getAgent(activeAgentId) : undefined;

		// Run orchestration engine (skipped for display-only data when pinned agent is set)
		const plan = executeOrchestration(userPrompt, ALL_FLOWS, enrichedFileContext);

		// Find the developer agent (the one that actually writes files)
		const developerAgent = pinnedAgent || plan.agents.find((a) => !a.readOnly);

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
		const primaryAgent = pinnedAgent || developerAgent || plan.agents[0];
		let assembledPrompt = "";
		if (pinnedAgent) {
			// Directly assemble prompt for the pinned agent (bypass orchestration routing)
			const skills = resolveSkills(pinnedAgent, plan.intent.techStack || []);
			assembledPrompt = assemblePrompt(
				pinnedAgent,
				skills,
				enrichedFileContext,
				userPrompt,
				plan.intent.complexity,
			);
			console.log(`[Chat API] Pinned agent: ${pinnedAgent.id}, skills=${skills.map(s => s.id).join(",")}`);
		} else {
			assembledPrompt = primaryAgent
				? plan.agentPrompts.get(primaryAgent.id) || ""
				: "";
		}

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
		// Phase 1 (new project): Create ONLY docs/README.md, stop, let user review
		// Phase 2 (user says "build it"): Execute the plan from docs/README.md
		const hasCodeFiles = existingFiles.some(
			(f) =>
				f.path.endsWith(".tsx") ||
				f.path.endsWith(".ts") ||
				f.path.endsWith(".jsx") ||
				f.path.endsWith(".js"),
		);
		const hasPlanOnly =
			existingFiles.length > 0 &&
			existingFiles.some(
				(f) => f.path === "docs/README.md" || f.path === "Blueprint.md",
			) &&
			!hasCodeFiles;
		const isNewProject = existingFiles.length === 0;

		if (isNewProject && !isVisualEdit) {
			// Phase 1: Plan only — create docs/README.md and stop
			runtimeAddenda.push(`## PLAN FIRST (MANDATORY)

Create ONLY \`docs/README.md\` with a comprehensive project plan. Include:
- **Overview**: What the app does, who it's for
- **Features**: Numbered list with acceptance criteria (F1, F2, F3...)
- **Data Model**: Entity schemas with fields, types, relationships
- **Auth Strategy**: No auth / Simple auth / Role-based
- **Component Architecture**: Component tree with parent→child relationships
- **File Map**: Every file to be created, in order, with purpose and dependencies
- **UX Flows**: Primary user journeys, empty/loading/error states
- **Getting Started**: If the app uses auth, include: "Sign up with any email and password (8+ characters) to create your first account. There are no default credentials — every user registers through the app."

Make docs/README.md thorough and detailed — this is the plan the user will review.

After creating docs/README.md, **STOP**. Do NOT create any code files (.ts, .tsx, .js, .jsx).

End your response with:
"Project plan created! Review it in the **Documents tab**, then say **'build it'** when you're ready for me to generate the code."

CRITICAL: Only create docs/README.md. No other files.`);
		} else if (hasPlanOnly) {
			// Phase 2: Execute the plan — docs/README.md (or Blueprint.md) exists, no code yet
			runtimeAddenda.push(`## EXECUTE THE PLAN

The user has reviewed the project plan (available in the Documents tab as docs/README.md). Now execute it:
1. Read docs/README.md (or Blueprint.md if that exists instead) to understand the full plan
2. **CRITICAL: Create src/App.tsx FIRST** — this is the entry point that Sandpack needs to render the preview. Import all main page/layout components. Without App.tsx the preview will be blank.
3. Then create ALL remaining code files following the plan's File Map
4. Do NOT recreate or modify docs/README.md — it's already done
5. Use define_entities to register data entities if the plan includes a Data Model section
6. **Auth UX**: If the app has auth, the Login/Register page MUST default to showing the **Sign Up** form (not Sign In), since new apps have zero users. Include a toggle to switch between Sign Up and Sign In.

Start immediately with file creation. Do not re-explain the plan.

After creating ALL files, end with a short summary. If the app has auth, include:
"To get started, **sign up** with any email and password (8+ characters) to create your first account."`);
		} else if (isReturningUser) {
			// Normal existing project — edit/add files
			runtimeAddenda.push(`## Existing Project (${existingFiles.length} files)
This is an EXISTING project. Use \`read_file\` to inspect existing files BEFORE modifying them with \`update_file\`. Never blindly overwrite files without reading them first.
Reference the Project Wiki (docs/ folder) for architecture, data model, and change history.`);
		}

		// Document this request in wiki (project memory — zero token cost)
		const wikiCategory = isNewProject
			? "New Project"
			: hasPlanOnly
				? "Build Plan"
				: isVisualEdit
					? "Visual Edit"
					: plan.intent.suggestedFlow === "fix"
						? "Bug Fix"
						: "Feature Update";

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

		// Design Analysis mode — when user attaches screenshot/mockup images
		if (hasDesignImages && !isVisualEdit && !isReviewCode) {
			runtimeAddenda.push(`## DESIGN ANALYSIS MODE (images attached)

The user has attached design images (screenshots, mockups, or wireframes). You MUST follow this workflow:

1. **Analyze each image** before writing any code:
   - Identify the color palette (primary, secondary, background, accent colors)
   - Identify the navigation pattern (bottom tabs, drawer, stack)
   - Catalog the typography (heading styles, body text, font weights)
   - List all visible UI components (cards, lists, buttons, inputs, modals)
   - Note the layout structure (spacing, padding, border-radius patterns)
   - Identify any special elements (gradients, shadows, illustrations, animations)

2. **Plan the component tree** based on what you see in the images

3. **Build UI-first**: Create the visual shell matching the design BEFORE adding any functionality
   - Use arbitrary Tailwind values to match exact colors: bg-[#hex] text-[#hex]
   - Create a design tokens file with all extracted values
   - Visual accuracy is the #1 priority — match the design precisely

4. **Then wire up functionality**: Add state, data, and interactions after the UI matches`);
		}

		// App Store clone addendum — when App Store listing was analyzed
		if (appStoreAnalysis) {
			runtimeAddenda.push(`## APP STORE CLONE MODE

An App Store listing has been analyzed and injected into the project context above. Follow this workflow:

1. **Study the listing**: Read the app name ("${appStoreAnalysis.appName}"), description, features, and screenshot URLs
2. **Create docs/README.md** with a clone plan: map each listed feature to a technical implementation
3. **Match the visual design** from the screenshots: recreate the color scheme, layout, and component styles
4. **Implement all listed features** in priority order (core features first, settings/preferences last)
5. **Build as a mobile-first PWA** with bottom tab navigation matching the original app's structure`);
		}

		// Combine: critical flow addenda FIRST (plan-first, execute-plan) + assembled agent prompt + other addenda
		// Flow-control instructions must be at the TOP so the model sees them before the long agent prompt.
		const flowAddenda: string[] = [];
		const otherAddenda: string[] = [];
		for (const a of runtimeAddenda) {
			if (a.includes("PLAN FIRST") || a.includes("EXECUTE THE PLAN")) {
				flowAddenda.push(a);
			} else {
				otherAddenda.push(a);
			}
		}
		let systemPrompt = [
			...flowAddenda,
			assembledPrompt,
			...otherAddenda,
		].filter(Boolean).join("\n\n");

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

		// Determine effective model ID for resolution and fallback
		const tierMap: Record<string, string> = { opus: "claude-opus-4-6", sonnet: "claude-sonnet-4-5", haiku: "claude-haiku-4-5" };
		let effectiveModelId = modelId
			|| (developerAgent ? tierMap[developerAgent.modelTier] : undefined)
			|| undefined;

		// Pre-flight: validate API key before starting generation
		const configError = validateModelConfig(effectiveModelId, byok);
		if (configError) {
			// Try fallback chain if primary model has no API key
			const fallbacks = getFallbackChain(effectiveModelId || "kimi-k2-5-fireworks");
			let fallbackId: string | null = null;
			for (const fb of fallbacks) {
				if (!validateModelConfig(fb, byok)) {
					fallbackId = fb;
					break;
				}
			}
			if (!fallbackId) {
				console.error(`[Chat API] Pre-flight failed: ${configError}, no valid fallback`);
				return new Response(JSON.stringify({ error: configError }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}
			console.log(`[Chat API] Pre-flight: ${effectiveModelId} unavailable (${configError}), falling back to ${fallbackId}`);
			effectiveModelId = fallbackId;
		}

		// Resolve to AI SDK model instance (uses fallback if pre-flight switched it)
		const model = resolveModel(effectiveModelId, byok);

		const isReplication = plan.intent.suggestedFlow === "replicate";
		const isFix = plan.intent.suggestedFlow === "fix";
		const isPlanOnly = isNewProject && !isVisualEdit;
		const maxSteps = isPlanOnly
			? 5 // Plan-only: just docs/README.md creation
			: hasPlanOnly
				? 100 // Execute-plan: full project build from plan needs many steps
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
			`[Chat API] Orchestration: complexity=${plan.intent.complexity}, flow=${plan.intent.suggestedFlow}, agents=${plan.agents.map((a) => a.id).join("->")}, chained=${upstreamCount}, model=${modelId || primaryAgent?.modelTier || "default"}, maxSteps=${maxSteps}${pinnedAgent ? `, pinned=${pinnedAgent.id}` : ""}${isPlanOnly ? ", mode=plan-only" : hasPlanOnly ? ", mode=execute-plan" : ""}${detectedUrls.length > 0 ? `, url=${detectedUrls[0]}` : ""}`,
		);

		// Use streamText directly with toUIMessageStreamResponse for proper multi-step support.
		// The createUIMessageStream + writer.merge() pattern breaks multi-step: the model
		// gets finishReason=tool-calls (wants to continue) but the stream closes after step 1.
		let stepCount = 0;
		let totalFileCalls = 0;
		const filesChanged: string[] = [];
		const entitiesChanged: string[] = [];
		let generationError: unknown = null;
		const result = streamText({
			model,
			system: systemPrompt,
			messages: modelMessages,
			tools,
			stopWhen: stepCountIs(maxSteps),
			toolChoice: "auto",
			onError: ({ error }) => {
				generationError = error;
				const errMsg = error instanceof Error ? error.message : String(error);
				console.error(
					`[Chat API] Stream error - model=${modelId || "default"}, steps=${stepCount}, files=${totalFileCalls}: ${errMsg}`,
				);
			},
			onStepFinish: ({ toolCalls, finishReason, usage }) => {
				stepCount++;
				const fileToolNames = ["create_file", "update_file", "delete_file", "define_entities", "read_file", "manage_environments", "manage_backups"];
				const fileCallsInStep = (toolCalls || []).filter(
					(tc) => fileToolNames.includes(tc.toolName),
				).length;
				totalFileCalls += fileCallsInStep;

				// Track changed files and entities for wiki sync
				for (const tc of toolCalls || []) {
					const args = (tc as Record<string, unknown>).args as Record<string, unknown> | undefined;
					if ((tc.toolName === "create_file" || tc.toolName === "update_file") && args && typeof args.path === "string") {
						filesChanged.push(args.path);
					}
					if (tc.toolName === "define_entities" && args && Array.isArray(args.entities)) {
						for (const ent of args.entities as { name: string }[]) {
							if (ent.name) entitiesChanged.push(ent.name);
						}
					}
				}

				const toolNames = (toolCalls || []).map((tc) => tc.toolName).join(",") || "text-only";
				console.log(
					`[Chat API] Step ${stepCount}: tools=${toolNames}, files=${totalFileCalls}, tokens=${usage?.totalTokens || 0}, finish=${finishReason}`,
				);
			},
			onFinish: (event) => {
				console.log(
					`[Chat API] Stream finished - Chat: ${chatId || "new"}, steps=${stepCount}, files=${totalFileCalls}, maxSteps=${maxSteps}, finishReason=${event.finishReason}${generationError ? ", hadError=true" : ""}`,
				);

				// Sync wiki pages (fire-and-forget, zero token cost)
				// Skip wiki sync if the stream errored mid-generation (would create misleading docs)
				if (!isReviewCode && totalFileCalls > 0 && !generationError) {
					syncWiki(appId, {
						category: wikiCategory,
						userPrompt,
						filesChanged,
						entitiesChanged: entitiesChanged.length > 0 ? entitiesChanged : undefined,
					}).catch((e) =>
						console.error("[Chat API] Wiki sync failed:", e),
					);
				} else if (generationError && totalFileCalls > 0) {
					console.log(
						`[Chat API] Skipping wiki sync — stream errored after ${totalFileCalls} file operations`,
					);
				}
			},
		});

		return result.toUIMessageStreamResponse({
			originalMessages: messages,
			sendRoundtrips: true,
		});
	} catch (error) {
		const errMsg = error instanceof Error ? error.message : String(error);
		console.error("[Chat API] Error:", errMsg);

		// Parse provider-specific HTTP status codes for actionable messages
		const lc = errMsg.toLowerCase();
		let userMessage = errMsg;
		let status = 500;
		if (lc.includes("402") || lc.includes("payment") || lc.includes("credit") || lc.includes("quota") || lc.includes("insufficient")) {
			userMessage = "AI provider credits exhausted. Please switch to a different model.";
			status = 402;
		} else if (lc.includes("429") || lc.includes("rate limit") || lc.includes("too many")) {
			userMessage = "Rate limited by AI provider. Please wait a moment and try again.";
			status = 429;
		} else if (lc.includes("401") || lc.includes("unauthorized") || lc.includes("api key")) {
			userMessage = "Invalid API key for this provider. Check your settings.";
			status = 401;
		} else if (lc.includes("503") || lc.includes("unavailable") || lc.includes("overloaded")) {
			userMessage = "AI provider temporarily unavailable. Try again or switch models.";
			status = 503;
		}

		return new Response(JSON.stringify({ error: userMessage }), {
			status,
			headers: { "Content-Type": "application/json" },
		});
	}
}
