// Chat API endpoint with AI SDK streaming for App Builder
// Uses ECC multi-agent orchestration engine with skill-enriched prompts.
// Streams orchestration events (agent activations, skills, verdicts) via data channel.

import {
	ALL_FLOWS,
	DEFAULT_AGENTS,
	DEFAULT_SKILLS,
	GAME_3D_ASSETS_REFERENCE,
	GAME_3D_SCENE_STARTER,
	GAME_3D_SCENE_STARTER_CHARACTER,
	GAME_3D_SCENE_STARTER_RUNNER,
	GAME_3D_SCENE_STARTER_SHOOTER,
	GAME_3D_TEMPLATE_FILES,
	GAME_2D_TEMPLATE_FILES,
	GAME_2D_REFERENCE_GAMES,
	expandSeed,
	buildCreativeBriefPrompt,
	GAME_2D_ASSETS_REFERENCE_BUILDER,
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
import { createFileTools, type FileToolsOptions } from "@/app/(main)/app-builder/lib/file-tools";
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
	saveFile,
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
import { db } from "@/db";
import { featureBankSnippets } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getUser } from "@/lib/auth/get-user";
import { listFiles } from "@/lib/app-storage/storage-manager";
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

/**
 * Fetch available Feature Bank snippets and format as a catalog for the AI prompt.
 * Returns empty string if no features exist yet.
 */
async function buildFeatureBankCatalog(engine: string): Promise<string> {
	try {
		const snippets = await db
			.select({
				id: featureBankSnippets.id,
				name: featureBankSnippets.name,
				description: featureBankSnippets.description,
				category: featureBankSnippets.category,
				type: featureBankSnippets.type,
				engine: featureBankSnippets.engine,
				keywords: featureBankSnippets.keywords,
				parameters: featureBankSnippets.parameters,
				dependencies: featureBankSnippets.dependencies,
				genres: featureBankSnippets.genres,
			})
			.from(featureBankSnippets)
			.where(eq(featureBankSnippets.isVerified, true))
			.orderBy(featureBankSnippets.category, featureBankSnippets.name);

		// Filter by engine column (include "shared" features too)
		const filtered = snippets.filter(
			(s) => s.engine === engine || s.engine === "shared",
		);

		if (filtered.length === 0) return "";

		// Group by category
		const byCategory = new Map<string, typeof filtered>();
		for (const s of filtered) {
			const list = byCategory.get(s.category) || [];
			list.push(s);
			byCategory.set(s.category, list);
		}

		let catalog = `## Feature Bank (${filtered.length} verified features)\n\n`;
		catalog += `When building a game, you can reference these pre-tested features by ID in your code.\n`;
		catalog += `Each feature follows the FeatureRuntime interface (init, update, destroy, onEvent).\n`;
		catalog += `Register features with: \`engine.features.register(id, factory, config, deps)\`\n\n`;

		for (const [category, features] of byCategory) {
			catalog += `### ${category}\n`;
			for (const f of features) {
				const params = (f.parameters as any[] || [])
					.map((p: any) => `${p.name}: ${p.type}${p.default !== undefined ? ` = ${p.default}` : ""}`)
					.join(", ");
				catalog += `- **${f.id}** — ${f.description}`;
				if (params) catalog += ` | params: ${params}`;
				if (f.dependencies && (f.dependencies as string[]).length > 0)
					catalog += ` | requires: ${(f.dependencies as string[]).join(", ")}`;
				catalog += `\n`;
			}
			catalog += `\n`;
		}

		return catalog;
	} catch (e) {
		console.error("[Feature Bank] Catalog build error:", e);
		return "";
	}
}

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
			game2dSeed,
		} = body as {
			messages: UIMessage[];
			appId: string;
			chatId?: string;
			mode?: "generate" | "discussion" | "continue";
			modelId?: string;
			activeAgentId?: string;
			game2dSeed?: number;
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

		const app = await getAppById(appId, user.dbId);
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
			// User selection wins, agent tier is fallback
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
			});
		}

		// --- GENERATE MODE: Multi-agent orchestration ---

		// Extract latest user message for intent classification
		// AI SDK v5: content may be empty with text in parts[].text
		const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
		let userPrompt = "";
		if (lastUserMsg) {
			const content = (lastUserMsg as unknown as Record<string, unknown>).content;
			if (typeof content === "string" && content.length > 0) {
				userPrompt = content;
			} else {
				// Fallback: extract text from parts array (AI SDK v6 format)
				const parts = (lastUserMsg as unknown as Record<string, unknown>).parts ?? lastUserMsg.parts;
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
					siteAnalysis = await analyzeUrl(detectedUrls[0]!);
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
			});

			return reviewResult.toUIMessageStreamResponse({
				originalMessages: messages,
			});
		}

		// --- PINNED AGENT MODE: bypass orchestration when a user has activated a specific agent ---
		let pinnedAgent = activeAgentId ? getAgent(activeAgentId) : undefined;

		// Run orchestration engine (skipped for display-only data when pinned agent is set)
		const plan = executeOrchestration(userPrompt, ALL_FLOWS, enrichedFileContext);

		// Force 2D game developer agent when prompt contains 2D game keywords
		// Must happen HERE (before developerAgent/primaryAgent) because isGameProject
		// depends on app.projectType from DB which isn't set on the first message.
		if (!pinnedAgent && (plan.intent.suggestedFlow === "game" || app.projectType === "game")) {
			const prompt2dCheck = userPrompt.toLowerCase();
			const has2dKeyword = ["2d game", "2d platformer", "side scroller", "side-scroller",
				"sidescroller", "pixel game", "sprite game", "2d shooter", "2d puzzle",
				"match-3", "match 3", "runner game", "endless runner", "2d adventure",
				"retro game", "arcade game", "2d rpg", "flappy", "breakout", "pong",
				"tetris", "snake game", "platformer game", "jumping game"].some(kw => prompt2dCheck.includes(kw));
			if (has2dKeyword) {
				const agent2d = getAgent("game-2d-developer");
				if (agent2d) {
					pinnedAgent = agent2d;
					console.log(`[Chat API] Forcing game-2d-developer agent for 2D game (early detection)`);
				}
			}
		}

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
		let primaryAgent = pinnedAgent || developerAgent || plan.agents[0];
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

		// --- Game template injection: pre-create infrastructure files ---
		// Runs for ALL game project requests (Phase 1, Phase 2, or edits).
		// The existingPaths check prevents duplicate injection on subsequent calls.
		// Must happen BEFORE phase branching because some models build everything
		// in one shot (ignoring the "plan only" instruction), so templates must
		// already exist when code generation starts.
		const injectedFiles: string[] = [];
		const isGameProject = app.projectType === "game" || app.projectType === "game-mobile";

		// --- Detect 3D game from keywords ---
		// NOTE: "3d" standalone is safe because this check only runs when isGameProject=true
		const GAME_3D_KEYWORDS = [
			"3d", // Standalone — catches "3d warrior", "3d racing", any "3d ..." variant
			"three.js", "first-person game", "first person game", "isometric game",
			"gltf", "kaykit", "low-poly 3d",
			"meshy", "createanimatedcharacter3d", "createplatform3d",
			"createplayer3d", "animated warrior", "animated character",
		];
		let isGame3d = false;
		let isGame2d = false;
		let isRunner2d = false;
		let isShooter2d = false;
		let isPuzzle2d = false;
		let isRpg2d = false;
		let hasAnimatedCharacter = false;
		let isRunner3d = false;
		let isShooter3d = false;
		let needsTerrain = false; // open-world, exploration, terrain-heavy games
		const GAME_2D_KEYWORDS = [
			"2d game", "2d platformer", "side scroller", "side-scroller", "sidescroller",
			"pixel game", "pixel art game", "sprite game", "2d shooter", "2d puzzle",
			"match-3", "match 3", "runner game", "endless runner", "2d adventure",
			"retro game", "arcade game", "pixi", "pixi.js", "2d rpg", "top-down 2d",
			"metroidvania", "2d fighter", "2d racing", "flappy", "breakout", "pong",
			"tetris", "snake game", "platformer game", "jumping game", "2d character",
			"2d world", "2d sprites", "tile-based", "tilemap", "2d",
		];
		const RUNNER_2D_KEYWORDS = [
			"runner game", "endless runner", "2d runner", "run game", "auto-run",
			"temple run", "subway surfers", "infinite runner",
		];
		const SHOOTER_2D_KEYWORDS = [
			"2d shooter", "shoot em up", "shmup", "bullet hell", "space shooter",
			"2d shoot", "top down shooter 2d",
		];
		const RPG_2D_KEYWORDS = [
			"2d rpg", "top-down rpg", "top down rpg", "topdown rpg", "zelda",
			"top-down adventure", "top down adventure", "topdown adventure",
			"dungeon crawler", "roguelike 2d", "2d roguelike",
			"twin-stick", "twin stick", "top-down shooter 2d", "top down shooter",
			"8-directional", "8 directional", "top-down game", "top down game",
		];
		const PUZZLE_2D_KEYWORDS = [
			"puzzle", "match-3", "match 3", "tetris", "block puzzle", "word game",
			"sudoku", "jigsaw", "memory game", "card game", "brain game",
		];
		const TERRAIN_KEYWORDS = [
			"open world", "open-world", "terrain", "exploration", "adventure game 3d",
			"rpg 3d", "3d rpg", "survival 3d", "3d survival", "mmorpg", "mmo",
			"walking simulator", "3d adventure", "sandbox 3d", "3d sandbox",
			"hiking", "mountaineer", "landscape", "nature 3d",
		];
		const SHOOTER_3D_KEYWORDS = [
			"3d shooter", "top down shooter", "top-down shooter", "squad shooter",
			"archero", "brawl stars", "3d shoot", "shoot em up 3d", "bullet hell 3d",
			"wave shooter", "arena shooter", "twin stick", "twin-stick",
			"zombie shooter", "survival shooter", "horde shooter",
		];
		const RUNNER_3D_KEYWORDS = [
			"3d runner", "endless runner 3d", "temple run 3d", "subway surfers 3d",
			"3d lane", "runner 3d", "3d endless", "3d dodge runner",
			"auto-run 3d", "3d endless runner", "subway surfers",
		];
		const CHARACTER_KEYWORDS = [
			"warrior", "fighter", "knight", "soldier", "hero character",
			"animated character", "animated player", "3d character",
			"skeleton warrior", "character animation", "humanoid",
			"swordsman", "gladiator", "samurai", "ninja character",
		];
		if (isGameProject) {
			// Extract text from all messages — handle both string content AND parts array (AI SDK v5)
			const allMessages = messages.map((m: UIMessage) => {
				const content = (m as unknown as Record<string, unknown>).content;
				if (typeof content === "string" && content.length > 0) return content;
				// AI SDK v6: content may be empty, text lives in parts[].text
				const parts = (m as unknown as Record<string, unknown>).parts ?? m.parts;
				if (Array.isArray(parts)) {
					return parts
						.filter((p: Record<string, unknown>) => p.type === "text" && typeof p.text === "string")
						.map((p: Record<string, unknown>) => p.text)
						.join(" ");
				}
				return typeof content === "string" ? content : "";
			}).map(s => (s as string).toLowerCase()).join(" ");
			const searchText = userPrompt.toLowerCase() + " " + allMessages;
			if (GAME_3D_KEYWORDS.some(kw => searchText.includes(kw))) {
				isGame3d = true;
				console.log(`[Chat API] 3D game detected (keywords)`);
			}
			// Detect 2D game keywords
			if (!isGame3d && GAME_2D_KEYWORDS.some(kw => searchText.includes(kw))) {
				isGame2d = true;
				console.log(`[Chat API] 2D game detected (keywords)`);
			}
			// 2D sub-genre detection
			if (isGame2d) {
				if (RUNNER_2D_KEYWORDS.some(kw => searchText.includes(kw))) {
					isRunner2d = true;
					console.log(`[Chat API] 2D runner detected (keywords)`);
				}
				if (SHOOTER_2D_KEYWORDS.some(kw => searchText.includes(kw))) {
					isShooter2d = true;
					console.log(`[Chat API] 2D shooter detected (keywords)`);
				}
				if (PUZZLE_2D_KEYWORDS.some(kw => searchText.includes(kw))) {
					isPuzzle2d = true;
					console.log(`[Chat API] 2D puzzle detected (keywords)`);
				}
				if (RPG_2D_KEYWORDS.some(kw => searchText.includes(kw))) {
					isRpg2d = true;
					console.log(`[Chat API] 2D RPG/top-down detected (keywords)`);
				}
			}
			// Fallback: check existing project files FIRST (before defaulting)
			// This ensures follow-up messages detect the correct engine type
			if (!isGame3d && !isGame2d && existingFiles.some(f => f.path === "src/components/Game2D.tsx" || f.path === "src/game/custom-gameplay.ts")) {
				isGame2d = true;
				console.log(`[Chat API] 2D game detected (existing Game2D.tsx or custom-gameplay.ts in project)`);
			}
			if (!isGame3d && !isGame2d && existingFiles.some(f => f.path === "src/components/Game3D.tsx")) {
				isGame3d = true;
				console.log(`[Chat API] 3D game detected (existing Game3D.tsx template)`);
			}
			// Final fallback: if neither 3D nor 2D detected, default to 3D
			if (!isGame3d && !isGame2d) {
				isGame3d = true;
				console.log(`[Chat API] No engine detected — defaulting to 3D pipeline`);
			}
			// Detect animated character keywords (warrior, knight, etc.)
			if (isGame3d && CHARACTER_KEYWORDS.some(kw => searchText.includes(kw))) {
				hasAnimatedCharacter = true;
				console.log(`[Chat API] Animated character detected (keywords)`);
			}
			// Detect 3D runner keywords (temple run, subway surfers, endless runner 3d, etc.)
			if (isGame3d && RUNNER_3D_KEYWORDS.some(kw => searchText.includes(kw))) {
				isRunner3d = true;
				console.log(`[Chat API] 3D runner detected (keywords)`);
			}
			// Detect 3D shooter keywords (squad shooter, archero, top-down shooter, etc.)
			if (isGame3d && SHOOTER_3D_KEYWORDS.some(kw => searchText.includes(kw))) {
				isShooter3d = true;
				console.log(`[Chat API] 3D shooter detected (keywords)`);
			}
			// Detect terrain-heavy keywords (open world, exploration, RPG, etc.)
			if (isGame3d && TERRAIN_KEYWORDS.some(kw => searchText.includes(kw))) {
				needsTerrain = true;
				console.log(`[Chat API] Terrain-heavy 3D game detected (keywords)`);
			}
		}
		// Force 2D game developer agent when 2D game is detected
		// (orchestration doesn't know about 2D agent — it picks fullstack-developer or game-3d-developer)
		if (isGame2d && !pinnedAgent) {
			const agent2d = getAgent("game-2d-developer");
			if (agent2d) {
				pinnedAgent = agent2d;
				// Re-assemble prompt with the 2D agent (primaryAgent was computed before detection)
				const skills2d = resolveSkills(agent2d, plan.intent.techStack || []);
				assembledPrompt = assemblePrompt(
					agent2d,
					skills2d,
					enrichedFileContext,
					userPrompt,
					plan.intent.complexity,
				);
				console.log(`[Chat API] Forcing game-2d-developer agent for 2D game`);
			}
		}
		// Update primaryAgent if pinnedAgent was set after initial computation (e.g. 2D game detection)
		// This ensures tool filtering at line ~1672 uses the correct agent's tool list
		if (pinnedAgent && primaryAgent !== pinnedAgent) {
			primaryAgent = pinnedAgent;
		}

		// ── 2D Game Seed Variety System ───────────────────────────────────
		// Generate a creative brief from a 4-digit seed to ensure each new
		// game session produces genuinely different output.
		let game2dBrief: ReturnType<typeof expandSeed> | null = null;
		if (isGame2d) {
			const effectiveSeed = game2dSeed ?? Math.floor(Math.random() * 9000) + 1000;
			const subGenre = isRpg2d ? "rpg" as const : isShooter2d ? "shooter" as const : isRunner2d ? "runner" as const : isPuzzle2d ? "puzzle" as const : "platformer" as const;
			game2dBrief = expandSeed(effectiveSeed, subGenre);
			// Override blueprint from user prompt keywords
			const promptLower = (userPrompt || "").toLowerCase();
			if (/cave|underground|cavern|mine/.test(promptLower)) game2dBrief.worldBlueprint = 'cave-system';
			else if (/tower|climb|vertical/.test(promptLower)) game2dBrief.worldBlueprint = 'vertical-tower';
			else if (/float|island|sky|cloud/.test(promptLower)) game2dBrief.worldBlueprint = 'floating-islands';
			else if (/arena|fight|boss|battle/.test(promptLower)) game2dBrief.worldBlueprint = 'arena';
			else if (/dungeon|rpg|roguelike|room/.test(promptLower)) game2dBrief.worldBlueprint = isRpg2d ? 'dungeon-topdown' : 'dungeon-rooms';
				else if (/top.?down|zelda|twin.?stick|8.?dir/.test(promptLower)) game2dBrief.worldBlueprint = 'open-field';
			else if (/city|rooftop|urban|building/.test(promptLower)) game2dBrief.worldBlueprint = 'city-rooftops';
			else if (/forest|jungle|canopy|tree/.test(promptLower)) game2dBrief.worldBlueprint = 'forest-canopy';
			else if (/underwater|ocean|sea|diving|coral/.test(promptLower)) game2dBrief.worldBlueprint = 'underwater';
			else if (/runner|endless|auto.?run/.test(promptLower)) game2dBrief.worldBlueprint = 'endless-runner';
			// Also override theme if prompt strongly suggests one
			// Blueprint-driven theme defaults (dungeon/cave → dark, underwater → ocean)
			if (['dungeon-topdown', 'dungeon-rooms', 'cave-system'].includes(game2dBrief.worldBlueprint) && !['dark', 'volcanic'].includes(game2dBrief.theme)) game2dBrief.theme = 'dark';
			if (game2dBrief.worldBlueprint === 'underwater' && game2dBrief.theme !== 'ocean') game2dBrief.theme = 'ocean';
			// Keyword-driven theme overrides (more specific user intent)
			if (/cave|underground|dark|shadow|dungeon|roguelike/.test(promptLower) && !['dark', 'volcanic'].includes(game2dBrief.theme)) game2dBrief.theme = 'dark';
			if (/underwater|ocean|sea/.test(promptLower) && game2dBrief.theme !== 'ocean') game2dBrief.theme = 'ocean';
			if (/lava|volcano|volcanic|fire/.test(promptLower) && game2dBrief.theme !== 'volcanic') game2dBrief.theme = 'volcanic';
			if (/ice|snow|arctic|frozen/.test(promptLower) && game2dBrief.theme !== 'arctic') game2dBrief.theme = 'arctic';
			console.log(`[Chat API] 2D seed=${effectiveSeed}, genre=${subGenre}, theme=${game2dBrief.theme}, blueprint=${game2dBrief.worldBlueprint}, difficulty=${game2dBrief.difficultyProfile}`);
		}

		// Declare at outer scope so 2D addenda can reference sprites after the game block closes
		let generatedSprites: Record<string, string> = {};

		if (isGameProject || isGame2d || isGame3d) {
			const existingPaths = new Set(existingFiles.map((f) => f.path));
			// Use 3D templates for 3D games, 2D templates for 2D games
			const templateFiles = isGame2d ? GAME_2D_TEMPLATE_FILES : GAME_3D_TEMPLATE_FILES;
			// Engine infrastructure files — always refresh to latest version
			// (protected from AI modification via protectedPaths, safe to overwrite)
			const alwaysRefreshPaths = new Set(["src/engine/core.ts", "src/engine/input.ts", "src/engine/physics.ts", "src/engine/effects.ts", "src/config/assets.ts", "src/utils/media-stock.ts", "src/engine/level-painter.ts"]);
			for (const tpl of templateFiles) {
				if (existingPaths.has(tpl.path) && !alwaysRefreshPaths.has(tpl.path)) {
					console.log(`[Chat API] Template skip (exists): ${tpl.path}`);
					continue;
				}
				try {
					await saveFile(appId, tpl.path, tpl.content, tpl.language);
					if (existingPaths.has(tpl.path)) {
						console.log(`[Chat API] Engine refresh: ${tpl.path}`);
					} else {
						injectedFiles.push(tpl.path);
						console.log(`[Chat API] Template injection: ${tpl.path}`);
					}
				} catch (e) {
					console.error(`[Chat API] Template injection failed for ${tpl.path}:`, e);
				}
			}

			// 3D games: inject GameScene3D.ts STARTER with factory helper pattern
			// NOT in GAME_3D_TEMPLATE_FILES to avoid protectedPaths blocking AI updates
			if (isGame3d && !existingPaths.has("src/scenes/GameScene3D.ts")) {
				try {
					const sceneStarter = isShooter3d
						? GAME_3D_SCENE_STARTER_SHOOTER
						: isRunner3d
							? GAME_3D_SCENE_STARTER_RUNNER
							: hasAnimatedCharacter
								? GAME_3D_SCENE_STARTER_CHARACTER
								: GAME_3D_SCENE_STARTER;
					await saveFile(appId, "src/scenes/GameScene3D.ts", sceneStarter, "typescript");
					console.log(`[Chat API] 3D scene starter injected: src/scenes/GameScene3D.ts (shooter=${isShooter3d}, runner=${isRunner3d}, character=${hasAnimatedCharacter})`);
				} catch (e) {
					console.error(`[Chat API] 3D scene starter injection failed:`, e);
				}
			}

			// Pre-scan spritesheets for 2D template injection (before template build)
			let spritesheetInjectCode = "";
			if (isGame2d) {
				try {
					const earlySheetResult = await listFiles(appId, "spritesheets/", 100);
					const earlySheetFiles = earlySheetResult.files || [];
					const earlySheets = new Map<string, { atlasUrl?: string; metadataUrl?: string; modelName: string; animName: string }>();
					for (const f of earlySheetFiles) {
						const m = f.path.match(/^spritesheets\/([^/]+)\/([^/]+)\/(sheet\.png|sheet\.json)$/);
						if (!m) continue;
						const name = `${m[1]}_${m[2]}`;
						if (!earlySheets.has(name)) earlySheets.set(name, { modelName: m[1], animName: m[2] });
						const entry = earlySheets.get(name)!;
						if (m[3] === "sheet.png") entry.atlasUrl = f.url;
						if (m[3] === "sheet.json") entry.metadataUrl = f.url;
					}
					const completeSheets = Array.from(earlySheets.entries()).filter(([, v]) => v.atlasUrl && v.metadataUrl);
					if (completeSheets.length > 0) {
						// Group by model — pick ONE model for the player (first with idle animation)
						const byModel = new Map<string, Array<[string, { atlasUrl?: string; metadataUrl?: string; modelName: string; animName: string }]>>();
						for (const entry of completeSheets) {
							const model = entry[1].modelName;
							if (!byModel.has(model)) byModel.set(model, []);
							byModel.get(model)!.push(entry);
						}
						// Pick best model for player — prefer model with most key animations (idle+walk/run+jump)
						let playerModel: string | null = null;
						let playerSheets: typeof completeSheets = [];
						let bestScore = 0;
						for (const [model, sheets] of byModel) {
							let score = 0;
							if (sheets.some(([, v]) => /idle/i.test(v.animName))) score += 10;
							if (sheets.some(([, v]) => /run|walk/i.test(v.animName))) score += 10;
							if (sheets.some(([, v]) => /jump/i.test(v.animName))) score += 10;
							score += sheets.length; // tiebreak by total count
							if (score > bestScore) {
								playerModel = model;
								playerSheets = sheets;
								bestScore = score;
							}
						}
						if (playerModel && playerSheets.length > 0) {
							// Build dynamic mapping of ALL available animations
							const animMapping: Record<string, string> = {};
							for (const [name, v] of playerSheets) {
								const anim = v.animName.toLowerCase();
								if (/idle/i.test(anim)) animMapping.idle = name;
								else if (/run/i.test(anim)) { animMapping.run = name; if (!animMapping.walk) animMapping.walk = name; }
								else if (/walk/i.test(anim)) { animMapping.walk = name; if (!animMapping.run) animMapping.run = name; }
								else if (/jump/i.test(anim)) animMapping.jump = name;
								else if (/fall/i.test(anim)) animMapping.fall = name;
								else if (/die|death/i.test(anim)) animMapping.die = name;
								else if (/attack|hit/i.test(anim)) animMapping.attack = name;
								else animMapping[anim] = name;
							}
							if (!animMapping.walk && animMapping.run) animMapping.walk = animMapping.run;
							if (!animMapping.run && animMapping.walk) animMapping.run = animMapping.walk;
							if (!animMapping.idle) animMapping.idle = playerSheets[0][0];
							// Load only this model's sheets
							const loads = playerSheets.map(([name, v]) =>
								`    await engine.assets.loadSpritesheet("${name}", "${v.atlasUrl}", "${v.metadataUrl}").catch(() => null);`
							).join("\n");
							spritesheetInjectCode = `\n    // Load ${playerModel} spritesheets (auto-injected)\n${loads}\n    engine.assets.setPlayerSprites(${JSON.stringify(animMapping)});\n`;
							console.log(`[Chat API] Injected ${playerSheets.length} spritesheet loads for model '${playerModel}' into scene template, mapping:`, animMapping);
						}
					}
				} catch (e) {
					console.warn("[Chat API] Early spritesheet scan failed:", e);
				}
			}

			// 2D games: auto-compose Feature Bank scaffold so preview works during plan phase
			// AND so the build phase starts with working gameplay features already in place
			// Also recreate if custom spritesheets need injection (template includes loadSpritesheet calls)
			const needsSceneRefresh = spritesheetInjectCode.length > 0;
			if (isGame2d && (!existingPaths.has("src/scenes/GameScene2D.ts") || needsSceneRefresh)) {
				// Blueprint-aware theme defaults — prevents mismatched themes (e.g. dungeon + candy)
				const blueprintThemeMap: Record<string, string> = {
					'dungeon-topdown': 'dark',
					'dungeon-rooms': 'dark',
					'cave-system': 'dark',
					'underwater': 'ocean',
					'floating-islands': 'space',
					'vertical-tower': 'volcanic',
					'city-rooftops': 'sunset',
				};
				const bp = game2dBrief?.worldBlueprint || "outdoor-scroll";
				const effectiveTheme = game2dBrief?.theme || blueprintThemeMap[bp] || "forest";
				const isTopDownBP = bp === "dungeon-topdown" || bp === "open-field" || isRpg2d;
				const wW = isTopDownBP ? 1200 : (game2dBrief?.worldWidth || 4000);
				const wH = isTopDownBP ? 1000 : (game2dBrief?.worldHeight || 900);
				const groundY = isTopDownBP ? 900 : (wH - 60);
				const gravity = isTopDownBP ? 0 : (game2dBrief?.gravity || 980);
				const moveSpeed = isTopDownBP ? 200 : (game2dBrief?.moveSpeed || 280);
				const jumpForce = isTopDownBP ? 0 : (game2dBrief?.jumpForce || 520);
				const tdGenre = isTopDownBP ? "top-down" : "platformer";

				// Fetch core Feature Bank features from DB — auto-swap player for top-down
				const playerFeatureId = isTopDownBP ? "player-topdown" : "player-platformer";
				const coreFeatureIds = [playerFeatureId, "level-platforms", "collectible-coins", "enemy-patrol", "camera-follow", "hud-basic"];
				let autoComposeScene = "";
				try {
					const coreFeatures = await db.select().from(featureBankSnippets).where(inArray(featureBankSnippets.id, coreFeatureIds));
					let featureFactories = "";
					let featureRegistrations = "";
					const sharedConfig = { theme: effectiveTheme, worldWidth: wW, worldHeight: wH, groundY, gravity, moveSpeed, jumpForce };

					for (const bf of coreFeatures) {
						const safeId = bf.id.replace(/-/g, "_");
						const deps = (bf.dependencies as string[]) || [];
						const config = { ...sharedConfig };
						featureFactories += `\n// --- Feature: ${bf.name} (${bf.id}) ---\nvar __feature_${safeId}_factory = (function() {\n  try {\n    ${bf.code}\n    return typeof create !== 'undefined' ? create : typeof createFeature !== 'undefined' ? createFeature : function(cfg) { return { id: '${bf.id}', init: function(){}, update: function(){}, destroy: function(){} }; };\n  } catch(e) { console.warn('[FeatureBank] load error:', e); return function(cfg) { return { id: '${bf.id}', init: function(){}, update: function(){}, destroy: function(){} }; }; }\n})();\n`;
						featureRegistrations += `    engine.features.register('${bf.id}', __feature_${safeId}_factory, ${JSON.stringify(config)}, ${JSON.stringify(deps)});\n`;
					}

					autoComposeScene = `// Auto-composed Feature Bank game — features handle core gameplay
// AI: Add custom visuals, decorations, and unique mechanics below the marked section
import { Engine2D, GameScene } from "../engine/core";
import { PhysicsWorld, createBody, createStaticBody, createOneWayPlatform, CharacterController } from "../engine/physics";
import { createAmbientEffect, onJumpDust, onLandImpact, onCollectSparkle, onDeathExplosion } from "../engine/effects";
import { PALETTES, drawPlayerCharacter, drawCoinToken, drawEnemySlime, drawHeart } from "../config/assets";
import { _loadSpriteLib, _sheetCache } from "../utils/media-stock";
${featureFactories}
var PIXI = (window as any).PIXI;
var PAL = PALETTES["${effectiveTheme}"] || PALETTES.forest;
export default class GameScene2D implements GameScene {
  name = 'game';
  container = new PIXI.Container();
  private _update: ((dt: number) => void) | null = null;

  async enter(engine: Engine2D) {
    await _loadSpriteLib("${effectiveTheme}");

    // Build world using WorldBuilder (sprite-based with fallback graphics)
    var worldResult = engine.worldBuilder.build({
      blueprint: "${game2dBrief?.worldBlueprint || 'outdoor-scroll'}",
      theme: "${effectiveTheme}",
      width: ${wW},
      height: ${wH},
      groundY: ${groundY},
      platformCount: ${game2dBrief?.platformCount || 11},
      levelShape: "${game2dBrief?.levelShape || 'flat-wide'}",
      seed: ${game2dBrief?.seed || 'Date.now()'},
      hasGround: ${isTopDownBP ? false : !['floating-islands'].includes(bp)},
      hasCeiling: ${isTopDownBP ? false : ['cave-system', 'arena', 'dungeon-rooms'].includes(bp)},
    });
    this.container.addChild(worldResult.container);
    engine._worldData = worldResult;

    // Set genre for player feature auto-selection (top-down = 8-way movement, no gravity)
    engine.config.genre = "${tdGenre}";
    engine.config.gravity = ${gravity};
    if ("${tdGenre}" !== "platformer") {
      engine._playerFeatureId = "player-topdown";
    }

${spritesheetInjectCode}
    // Register and initialize Feature Bank features
${featureRegistrations}

    // Load custom gameplay features (AI creates src/game/custom-gameplay.ts)
    try {
      var _cg = await import("../game/custom-gameplay");
      if (_cg.features) {
        for (var _fi = 0; _fi < _cg.features.length; _fi++) {
          var _f = _cg.features[_fi];
          engine.features.register(_f.id, _f.factory, _f.config || {}, _f.deps || []);
        }
      }
    } catch(e) { /* custom gameplay not created yet — game works without it */ }

    engine.features.initAll();

    // Load custom visuals (AI creates src/game/custom-visuals.ts)
    try {
      var _cv = await import("../game/custom-visuals");
      if (_cv.setup) await _cv.setup(engine, this.container);
    } catch(e) { /* custom visuals not created yet — game works without them */ }

    var _customUpdate = null;
    try { if (_cv && _cv.update) _customUpdate = _cv.update; } catch(e) {}

    this._update = function(dt) {
      engine.features.updateAll(dt);
      if (worldResult.updateParallax) worldResult.updateParallax(engine.camera);
      if (_customUpdate) try { _customUpdate(engine, dt); } catch(e) {}
      engine.input.endFrame();
    };
  }

  update(engine: Engine2D, dt: number) { this._update?.(dt); }

  exit(engine: Engine2D) {
    engine.features.destroy();
  }
}
`;
					console.log(`[Chat API] Auto-composed Feature Bank scaffold (theme: ${effectiveTheme}, blueprint: ${bp}, features: ${coreFeatures.length}/6)`);
				} catch (e) {
					console.error(`[Chat API] Feature Bank auto-compose failed, falling back to placeholder:`, e);
					// Fallback to simple placeholder
					autoComposeScene = `// Placeholder — Feature Bank auto-compose failed
import { Engine2D, GameScene } from "../engine/core";
import { PALETTES, drawSkyGradient } from "../config/assets";
export default class GameScene2D implements GameScene {
  name = 'game';
  container = new PIXI.Container();
  private _update: ((dt: number) => void) | null = null;
  async enter(engine: Engine2D) {
    var PAL = PALETTES["${effectiveTheme}"];
    var app = engine.app, W = app.screen.width, H = app.screen.height;
    this.container.addChild(drawSkyGradient(W, H, PAL.skyTop, PAL.skyBottom));
    var txt = new PIXI.Text({ text: "Building your game...", style: { fill: 0xFFFFFF, fontSize: 20, fontWeight: "bold", stroke: { color: 0x000000, width: 3 } } });
    txt.anchor.set(0.5); txt.x = W / 2; txt.y = H / 2;
    this.container.addChild(txt);
    this._update = () => {};
  }
  update(engine: Engine2D, dt: number) { this._update?.(dt); }
  exit(engine: Engine2D) {}
}
`;
				}

				try {
					await saveFile(appId, "src/scenes/GameScene2D.ts", autoComposeScene, "typescript");
				} catch (e) {
					console.error(`[Chat API] Scene save failed:`, e);
				}
			}

			// Save 2D game seed to settings so UI can display it
			if (isGame2d && game2dBrief && !existingPaths.has("src/__game-settings.json") && !existingPaths.has("__game-settings.json")) {
				try {
					const seedSettings = JSON.stringify({
						game2d: { seed: game2dBrief.seed, subGenre: game2dBrief.subGenre },
					}, null, 2);
					await saveFile(appId, "src/__game-settings.json", seedSettings, "json");
					console.log(`[Chat API] 2D seed settings saved: seed=${game2dBrief.seed}`);
				} catch (e) {
					console.error(`[Chat API] 2D seed settings save failed:`, e);
				}
			}

			// ── HF Sprite Generation — DISABLED (credits depleted) ───
			// Was: Flux-2D-Game-Assets-LoRA via HF Inference API.
			// Drawing helpers (drawPlayerCharacter, drawPlatformBlock, etc.)
			// serve as the primary visual system — no sprites needed.
			// To re-enable: uncomment and ensure HF_TOKEN has credits.
			// if (isGame2d && game2dBrief && process.env.HF_TOKEN) {
			// 	try {
			// 		const { generateSpritesBatch } = await import("@/lib/hf-sprite-batch");
			// 		generatedSprites = await generateSpritesBatch(game2dBrief, appId);
			// 	} catch (e) {
			// 		console.warn(`[Chat API] HF sprite generation failed:`, e instanceof Error ? e.message : e);
			// 	}
			// }

			// ── Genre-aware module pre-activation ─────────────────────────────
			// Automatically create __game-settings.json with the RIGHT modules
			// and settings for the detected game genre. Each genre has its own
			// optimal module combination, terrain preset, camera, and physics.
			if (isGame3d && !existingPaths.has("src/__game-settings.json") && !existingPaths.has("__game-settings.json")) {
				try {
					const preActivatedModules: Record<string, { enabled: boolean; version: string }> = {};

					// ── Genre-specific module selection ──
					if (isRunner3d) {
						// RUNNER: NO terrain-painter (runner template creates its own flat
						// ground + lane markers + segment platforms — terrain would conflict).
						// Character-system with runner mode: auto-forward + lane switching
						preActivatedModules["character-system"] = { enabled: true, version: "9.0.0" };
						preActivatedModules["sky-weather"] = { enabled: true, version: "1.0.0" };
					} else if (isShooter3d) {
						// SHOOTER: flat arena terrain, character-system for player control
						preActivatedModules["terrain-painter"] = { enabled: true, version: "1.0.0" };
						preActivatedModules["character-system"] = { enabled: true, version: "9.0.0" };
						preActivatedModules["sky-weather"] = { enabled: true, version: "1.0.0" };
					} else if (needsTerrain) {
						// OPEN WORLD / EXPLORATION: full terrain, character, atmosphere
						preActivatedModules["terrain-painter"] = { enabled: true, version: "1.0.0" };
						preActivatedModules["character-system"] = { enabled: true, version: "9.0.0" };
						preActivatedModules["sky-weather"] = { enabled: true, version: "1.0.0" };
					} else if (hasAnimatedCharacter) {
						// CHARACTER-BASED (platformer etc.): terrain + character system
						preActivatedModules["terrain-painter"] = { enabled: true, version: "1.0.0" };
						preActivatedModules["character-system"] = { enabled: true, version: "9.0.0" };
						preActivatedModules["sky-weather"] = { enabled: true, version: "1.0.0" };
					} else {
						// GENERIC 3D: just sky for atmosphere
						preActivatedModules["sky-weather"] = { enabled: true, version: "1.0.0" };
					}

					if (Object.keys(preActivatedModules).length > 0) {
						// ── Genre-specific base settings ──
						// Each genre gets optimized physics, camera, and terrain config
						const genreSettings = isRunner3d ? {
							// RUNNER: chase camera, auto-forward physics, char-system runner mode
							player: { spawnX: 0, spawnY: 2, spawnZ: 0, startingLives: 3, respawnX: 0, respawnY: 2, respawnZ: 0 },
							physics: { gravity: -30, fallGravity: -50, jumpForce: 10, moveSpeed: 8, runSpeed: 8, friction: 20, coyoteTime: 0.1 },
							camera: { offsetY: 6, offsetZ: 12, fov: 65, lerp: 5, lookAhead: 8, lookY: 0, near: 0.1, far: 500 },
							runner: { initialSpeed: 8, maxSpeed: 25, acceleration: 0.15, laneWidth: 3, maxLives: 3, jumpVelocity: 10 },
							characterController: { preset: "endless_runner" },
						} : isShooter3d ? {
							// SHOOTER: tactical camera, arena physics
							player: { spawnX: 0, spawnY: 3, spawnZ: 0, startingLives: 5, respawnX: 0, respawnY: 5, respawnZ: 0 },
							physics: { gravity: -38, fallGravity: -65, jumpForce: 14, moveSpeed: 7, runSpeed: 10, friction: 25, coyoteTime: 0.12 },
							camera: { offsetY: 10, offsetZ: 14, fov: 60, lerp: 4, lookAhead: 3, lookY: 2, near: 0.1, far: 800 },
						} : needsTerrain ? {
							// OPEN WORLD: exploration camera, moderate physics
							player: { spawnX: 0, spawnY: 5, spawnZ: 0, startingLives: 3, respawnX: 0, respawnY: 8, respawnZ: 0 },
							physics: { gravity: -38, fallGravity: -65, jumpForce: 17, moveSpeed: 6, runSpeed: 7.5, friction: 28, coyoteTime: 0.15 },
							camera: { offsetY: 8, offsetZ: 12, fov: 60, lerp: 3, lookAhead: 5, lookY: 1, near: 0.1, far: 1000 },
						} : {
							// DEFAULT: balanced platformer settings
							player: { spawnX: 0, spawnY: 3, spawnZ: 0, startingLives: 3, respawnX: 0, respawnY: 5, respawnZ: 0 },
							physics: { gravity: -38, fallGravity: -65, jumpForce: 17, moveSpeed: 6, runSpeed: 7.5, friction: 28, coyoteTime: 0.15 },
							camera: { offsetY: 8, offsetZ: 12, fov: 60, lerp: 3, lookAhead: 5, lookY: 1, near: 0.1, far: 1000 },
						};

						// ── Genre-specific terrain config ──
						const terrainConfig = !preActivatedModules["terrain-painter"] ? {} : isRunner3d ? {
							terrain: {
								enabled: true,
								width: 100, depth: 400, heightScale: 5, segments: 128,
								biome: "runner_flat", seed: Math.floor(Math.random() * 10000),
							},
						} : isShooter3d ? {
							terrain: {
								enabled: true,
								width: 150, depth: 150, heightScale: 8, segments: 128,
								biome: "arena_flat", seed: Math.floor(Math.random() * 10000),
							},
						} : needsTerrain ? {
							terrain: {
								enabled: true,
								width: 300, depth: 300, heightScale: 50, segments: 256,
								biome: "alpine", seed: Math.floor(Math.random() * 10000),
							},
						} : {
							terrain: {
								enabled: true,
								width: 200, depth: 200, heightScale: 40, segments: 256,
								biome: "platformer_varied", seed: Math.floor(Math.random() * 10000),
							},
						};

						const preSettings = {
							version: 1,
							...genreSettings,
							environment: { backgroundColor: "#87CEEB", ambientLightIntensity: 0.15, ambientLightColor: "#ffffff", sunLightIntensity: 0.55, sunLightColor: "#fff8ee", hemisphereIntensity: 0.35, hemisphereSkyColor: "#eef4ff", hemisphereGroundColor: "#886644", fogEnabled: false, fogColor: "#88aacc", fogNear: 30, fogFar: 100, fogType: "linear", fogDensity: 0.02, shadowQuality: "medium" },
							audio: { masterVolume: 0.8, musicVolume: 0.5, sfxVolume: 0.7, enabled: true },
							postProcessing: { preset: "none", bloomIntensity: 0.5, bloomThreshold: 0.8 },
							performance: { qualityPreset: "high", showFPS: false, antialias: true, pixelRatio: 1, maxFPS: 60 },
							modules: { installed: preActivatedModules },
							...terrainConfig,
						};

						const settingsContent = JSON.stringify(preSettings, null, 2);
						await saveFile(appId, "src/__game-settings.json", settingsContent, "json");

						const modulesContent = JSON.stringify({ installed: preActivatedModules }, null, 2);
						await saveFile(appId, "src/__vibexe-modules.json", modulesContent, "json");

						const genre = isRunner3d ? "runner" : isShooter3d ? "shooter" : needsTerrain ? "open-world" : hasAnimatedCharacter ? "character" : "generic";
						const moduleNames = Object.keys(preActivatedModules).join(", ");
						console.log(`[Chat API] Genre-aware pre-activation [${genre}]: ${moduleNames} (terrain=${terrainConfig.terrain?.biome ?? "none"})`);
					}
				} catch (e) {
					console.error(`[Chat API] Module pre-activation failed:`, e);
				}
			}
		}

		if (isNewProject && !isVisualEdit && !isGame2d) {
			// Phase 1: Plan only — create docs/README.md and stop
			// 2D games skip this: GameScene2D.ts is auto-composed with Feature Bank,
			// so the AI should build custom-visuals + custom-gameplay immediately.
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

			// 3D game "build" phase: tell AI that GameScene3D.ts is pre-created with factory helpers
			if (isGame3d) {
				runtimeAddenda.push(`## CRITICAL: 3D Game — Factory Helper Pattern

**\`src/scenes/GameScene3D.ts\` is PRE-CREATED** with a working starter that uses factory helpers (createPlatform3D, createCollectible3D, createPlayer3D, createBarrier3D, createDecoration3D, createAnimatedCharacter3D, createCharacterController3D, createText3D). These load real GLTF 3D models.

**You MUST follow this workflow:**
1. Use \`read_file("src/scenes/GameScene3D.ts")\` FIRST to see the existing factory helper pattern
2. Use \`update_file\` to REPLACE the content with your full game implementation
3. Your replacement MUST use the SAME factory helpers — \`createPlatform3D\`, \`createCollectible3D\`, \`createPlayer3D\`, \`createBarrier3D\`, \`createDecoration3D\`, and \`createAnimatedCharacter3D\` for animated characters
4. Do NOT use raw \`new THREE.BoxGeometry()\`, \`new THREE.SphereGeometry()\`, or \`new THREE.CylinderGeometry()\` for visible game objects — use factory helpers instead
5. Factory helpers handle GLTF model loading, URL construction, caching, scaling, and fallbacks automatically
6. For animated characters (meshy-characters pack), use \`createAnimatedCharacter3D(scene, x, y, z, { url: modelUrl("meshy-characters", "Warrior_figure_Animations.glb") })\` — returns \`{mesh, mixer, clips, play, stop, size}\`
7. For animated characters, ALWAYS use \`createCharacterController3D(character, physicsBody)\` to manage animation states. The controller is AUTO-UPDATED by Game3D.tsx — you do NOT need to call \`controller.update(delta)\` yourself. It auto-switches idle/walk/run/jump/attack.
8. ALWAYS use VELOCITY for player movement: \`playerBody.velocity.x = speed\`. NEVER use \`playerBody.applyForce()\` — force is sluggish and causes infinite sliding. Set \`playerBody.linearDamping = 0.9\` and \`playerBody.fixedRotation = true\` on the player body after creating it.

**MINIMUM**: Your GameScene3D.ts must call at least 5 different factory helpers. Every platform, collectible, player, barrier, and decoration MUST use the corresponding factory.`);

			}
		}
		// 2D games: build everything in a single step (no plan-then-build)
		if (isGame2d && isNewProject) {
			runtimeAddenda.push(`## BUILD IMMEDIATELY (2D Game)

GameScene2D.ts is already auto-composed with Feature Bank (player, platforms, coins, enemies, camera, HUD).
Create ALL files in a single response — do NOT ask the user to say "build it":

1. \`docs/README.md\` — short game description (2-3 sentences, feature list)
2. \`src/game/custom-visuals.ts\` — decorative visuals, themed backgrounds, particle effects
3. \`src/game/custom-gameplay.ts\` — additional gameplay mechanics (combat, bosses, NPCs, power-ups)

Build everything now. Do NOT create a plan and wait. Do NOT say "say build it". Just create all three files.`);
		}
		// 2D game: whenever GameScene2D.ts already exists, tell AI to patch not rewrite
		if (isGame2d && existingFiles.some((f) => f.path === "src/scenes/GameScene2D.ts")) {
			runtimeAddenda.push(`## 2D Game — GameScene2D.ts Already Works

\`src/scenes/GameScene2D.ts\` already has working player, platforms, coins, enemies, camera, HUD, and visuals.

For VISUAL changes (decorations, backgrounds, effects): create \`src/game/custom-visuals.ts\` (export setup and update functions).
For GAMEPLAY changes (combat, boss, NPC, controls, new mechanics): create \`src/game/custom-gameplay.ts\` (export a \`features\` array — each entry has id, deps, config, factory).

Do NOT touch GameScene2D.ts — it is LOCKED. Use \`var\` not \`const/let\`. Plain JavaScript only. Access the player via \`engine.getPlayer()\` (works with both platformer and top-down).`);
		}
		// 2D game addenda — simplified for Feature Bank auto-compose pipeline
		// Core gameplay is already handled by the scaffold, AI just adds custom visuals
		if (isGame2d && game2dBrief) {
			runtimeAddenda.push(`## Game Theme: ${game2dBrief.theme}
Use \`PALETTES['${game2dBrief.theme}']\` for colors. Art style: ${game2dBrief.artStyleDirection}. Atmosphere: ${game2dBrief.atmosphere}.`);
		}
		if (isGame2d && Object.keys(generatedSprites).length > 0) {
			const spriteEntries = Object.entries(generatedSprites);
			const spriteList = spriteEntries
				.map(([cat, url]) => `- **${cat}**: Load with \`await PIXI.Assets.load("${url}")\``)
				.join("\n");
			const loadLines = spriteEntries
				.map(([cat, url]) => `  PIXI.Assets.load("${url}").catch(() => null),`)
				.join("\n");
			const varNames = spriteEntries.map(([cat]) => `${cat}Tex`).join(", ");
			runtimeAddenda.push(`## AI-Generated Sprites (LOAD THESE)

${spriteList}

**Usage in GameScene2D.ts enter():**
\`\`\`typescript
// Load ALL generated sprites at the start of enter()
const [${varNames}] = await Promise.all([
${loadLines}
]);

// Use sprites (with fallback to drawing helpers)
var playerGfx = playerTex
  ? (() => { var s = new PIXI.Sprite(playerTex); s.width = 48; s.height = 64; s.anchor.set(0.5, 1); return s; })()
  : drawPlayerCharacter(48, PAL.player, PAL.playerLight);
\`\`\`

**IMPORTANT**: Always use \`.catch(() => null)\` and fallback to drawing helpers if sprite loading fails.
These sprites have white backgrounds — set blendMode or use alpha masking if needed.`);
		}
		// Spritesheet catalog — inform AI about user-generated spritesheets from the 3D→2D tool
		if (isGame2d) {
			try {
				const sheetResult = await listFiles(appId, "spritesheets/", 100);
				const sheetFiles = sheetResult.files || [];
				// Group by spritesheet name
				const sheets = new Map<string, { atlasUrl?: string; metadataUrl?: string; modelName: string; animName: string }>();
				for (const f of sheetFiles) {
					// Match nested format: spritesheets/{model}/{anim}/sheet.png|json
					const m = f.path.match(/^spritesheets\/([^/]+)\/([^/]+)\/(sheet\.png|sheet\.json)$/);
					if (!m) continue;
					const name = `${m[1]}_${m[2]}`;
					if (!sheets.has(name)) sheets.set(name, { modelName: m[1], animName: m[2] });
					const entry = sheets.get(name)!;
					if (m[3] === "sheet.png") entry.atlasUrl = f.url;
					if (m[3] === "sheet.json") entry.metadataUrl = f.url;
				}
				const complete = Array.from(sheets.entries()).filter(([, v]) => v.atlasUrl && v.metadataUrl);
				if (complete.length > 0) {
					// Group by model name so AI understands which character has which animations
					const byModel = new Map<string, Array<{ name: string; animName: string; atlasUrl: string; metadataUrl: string }>>();
					for (const [name, v] of complete) {
						if (!byModel.has(v.modelName)) byModel.set(v.modelName, []);
						byModel.get(v.modelName)!.push({ name, animName: v.animName, atlasUrl: v.atlasUrl!, metadataUrl: v.metadataUrl! });
					}

					let promptLines = "";
					let firstModelName = "";
					const firstModelAnims: Array<{ name: string; animName: string; atlasUrl: string; metadataUrl: string }> = [];
					// Pick best model for player — prefer model with key animations (idle+walk/run+jump)
					let bestModelScore = 0;
					for (const [model, anims] of byModel) {
						let s = 0;
						if (anims.some(a => /idle/i.test(a.animName))) s += 10;
						if (anims.some(a => /run|walk/i.test(a.animName))) s += 10;
						if (anims.some(a => /jump/i.test(a.animName))) s += 10;
						s += anims.length;
						if (s > bestModelScore) { firstModelName = model; firstModelAnims.length = 0; firstModelAnims.push(...anims); bestModelScore = s; }
						const animList = anims.map(a => a.animName).join(", ");
						promptLines += `\n### ${model} (${anims.length} animation${anims.length > 1 ? "s" : ""}): ${animList}\n`;
						for (const a of anims) {
							promptLines += `- \`await engine.assets.loadSpritesheet("${a.name}", "${a.atlasUrl}", "${a.metadataUrl}")\`\n`;
						}
					}

					runtimeAddenda.push(`## Custom Spritesheets (User-Generated from 3D Models)

The user has created custom character spritesheets from 3D models. Each MODEL is a separate character — NEVER mix animations from different models.
${promptLines}
**CRITICAL: The scene template already loads spritesheets and calls setPlayerSprites() before features init. The player character is ALREADY using custom sprites. Do NOT call setPlayerSprites again in custom-visuals.ts — it would overwrite the working setup.**

**If you need to add MORE custom sprite characters (enemies, NPCs), use engine.assets.loadSpritesheet() + engine.assets.animation() for each. Keep all animations for one character from the SAME model.**

**Available models and their roles:**
- **${firstModelName}**: Use as PLAYER character (idle/walk/jump already mapped)
${byModel.size > 1 ? Array.from(byModel.keys()).filter(m => m !== firstModelName).map(m => `- **${m}**: Available for enemies/NPCs`).join("\n") : ""}`);
					console.log(`[Chat API] Injected ${complete.length} custom spritesheet(s) for ${byModel.size} model(s) into prompt`);
				}
			} catch (e) {
				console.warn("[Chat API] Failed to fetch spritesheet catalog:", e);
			}
		}
		// 2D game: inject Feature Bank catalog so AI knows available verified features
		if (isGame2d) {
			const featureCatalog = await buildFeatureBankCatalog("2d");
			if (featureCatalog) {
				runtimeAddenda.push(featureCatalog);
			}
		}
		if (isReturningUser && !isGame2d) {
			// Normal existing project — edit/add files
			runtimeAddenda.push(`## Existing Project (${existingFiles.length} files)
This is an EXISTING project. Use \`read_file\` to inspect existing files BEFORE modifying them with \`update_file\`. Never blindly overwrite files without reading them first.
Reference the Project Wiki (docs/ folder) for architecture, data model, and change history.`);
		}

		// --- Game project addenda: template notification + sprite catalog ---
		// Runs for ALL game project phases so the agent always knows about
		// pre-created files and available sprites.
		if (injectedFiles.length > 0) {
			if (isGame3d) {
				runtimeAddenda.push(`## MANDATORY: Pre-Created Infrastructure Files (3D)

The following files have been pre-created by the platform and already exist in the project:
${injectedFiles.map((f) => `- \`${f}\``).join("\n")}

**MANDATORY RULES — violation will break the game:**
- Do NOT recreate, overwrite, or modify these files — they contain correct, tested code
- You MUST \`import\` from them: \`import { createPlatform3D, createCollectible3D, createPlayer3D, createBarrier3D, createDecoration3D, createAnimatedCharacter3D, createCharacterController3D, createText3D, createPhysicsBody, syncBodiesToMeshes, createKeyboardState, createGround3D, createSkyGradient, createHUD, loadGLTF, SCALES_3D } from "../config/assets-3d";\` and \`import { modelUrl } from "../utils/media-stock-3d";\`
- **Game3D.tsx is PRE-CREATED** — do NOT create Game3D.tsx or any React-Three.js wrapper. Just import it in App.tsx: \`import Game3D from "./components/Game3D";\`
- **App.tsx pattern**: \`export default function App() { return <Game3D gameScene={GameScene} />; }\`
- Access Three.js via global: \`const THREE = (window as any).THREE;\` — do NOT import from "three"
- **Use factory helpers** (\`createPlatform3D\`, \`createCollectible3D\`, \`createPlayer3D\`, \`createBarrier3D\`, \`createDecoration3D\`, \`createAnimatedCharacter3D\`, \`createCharacterController3D\`, \`createText3D\`) for ALL visible game objects — they load real GLTF models
- \`createText3D("Score: 0", {x, y, z}, {size, color, stroke})\` for 3D text labels — returns \`{sprite, update}\`. Call \`scene.add(sprite)\` or pass scene as first arg
- For animated characters from meshy-characters pack, use \`createAnimatedCharacter3D\` which returns \`{mesh, mixer, clips, play, stop, size}\` — animations auto-update in render loop. Use \`createCharacterController3D(character, physicsBody)\` for automatic animation state management (idle/walk/run/jump/attack) — the controller is AUTO-UPDATED by Game3D.tsx
- **MOVEMENT**: ALWAYS use \`playerBody.velocity.x = speed\` for player movement, NEVER \`playerBody.applyForce()\`. Set \`playerBody.linearDamping = 0.9\` and \`playerBody.fixedRotation = true\` on player body
- Use \`loadGLTF(modelUrl(packId, filename))\` ONLY for advanced packs (city-builder, resource-bits, skeletons)
- The package.json already includes \`"three": "^0.162.0"\` — do NOT recreate it`);
			}
			// 2D: no infrastructure addendum needed — AI only creates custom-visuals.ts
		}
		if (isGameProject || isGame2d || isGame3d) {
			if (isGame3d) {
				// 3D game — inject 3D asset catalog
				runtimeAddenda.push(GAME_3D_ASSETS_REFERENCE);
				console.log(`[Chat API] Injected 3D assets reference`);
				// Inject animation name overrides (user-corrected clip names)
				try {
					const { readFile } = await import("node:fs/promises");
					const overridesRaw = await readFile("/opt/vibexe/data/animation-overrides.json", "utf-8").catch(() => "{}");
					const allOverrides = JSON.parse(overridesRaw);
					if (Object.keys(allOverrides).length > 0) {
						let overrideDoc = "## ANIMATION NAME CORRECTIONS\nThe following models have user-verified clip name corrections. The original clip names in the GLB file don't match the actual visual animation. Use the CORRECTED names when referring to animations in code comments and documentation, but use the ORIGINAL clip names in code (e.g., `character.play(\"ORIGINAL_NAME\")`):\n\n";
						for (const [model, overrides] of Object.entries(allOverrides)) {
							const map = overrides as Record<string, string>;
							overrideDoc += `**${model}:**\n`;
							for (const [original, corrected] of Object.entries(map)) {
								overrideDoc += `- Clip "${original}" actually shows: "${corrected}"\n`;
							}
							overrideDoc += "\n";
						}
						runtimeAddenda.push(overrideDoc);
						console.log(`[Chat API] Injected animation overrides for ${Object.keys(allOverrides).length} models`);
					}
				} catch { /* no overrides file */ }
				// Inject 3D runner addendum (mandatory runner patterns)
				if (isRunner3d) {
					runtimeAddenda.push(`## GAME SUB-TYPE: 3D ENDLESS RUNNER

**MANDATORY runner patterns — violation will break the game:**
- Player moves forward AUTOMATICALLY at increasing speed (\`playerBody.velocity.z = -speed\`)
- Do NOT add WASD/arrow forward movement — forward is automatic
- 3-lane system: left (x=-3), center (x=0), right (x=3) — tween between lanes
- Arrow Left/Right or Swipe = switch lanes. Arrow Up/Space = jump
- Spawn platform segments ahead on -Z axis, recycle segments behind camera
- Barriers spawn on random lanes — player must jump over or switch lane to avoid
- Collectibles float in lanes where no barrier exists
- Camera follows BEHIND player at fixed offset (x=playerX*0.5, y=player.y+4, z=player.z+10)
- Distance-based scoring: \`distance += speed * delta; score = Math.floor(distance)\`
- Speed ramps up over time: \`speed = Math.min(MAX_SPEED, speed + SPEED_RAMP * delta)\`
- Lives system: barrier hit = lose 1 life + brief invulnerability
- Game over when lives reach 0 — show overlay with score/distance and restart button
- Use createSwipeDetector for mobile touch controls
- Use playSound(soundUrl("collect")) for pickup SFX, soundUrl("hit") for damage
- Use createParticleEmitter with preset "sparkle" for collect, "explosion" for crash`);
					console.log(`[Chat API] 3D runner addendum injected`);
				}
				// Inject 3D shooter addendum (mandatory shooter patterns)
				if (isShooter3d) {
					runtimeAddenda.push(`## GAME SUB-TYPE: 3D TOP-DOWN SHOOTER

**MANDATORY shooter patterns — violation will break the game:**
- Top-down or isometric camera at fixed height (y=15, z=player.z+10), NO first-person
- Camera follows player automatically — NO manual camera rotation/OrbitControls
- Movement is horizontal plane ONLY (XZ) — NO platformer-style jumping
- Joystick for movement (createTouchJoystick) + tap/swipe for shooting direction
- Enemy FSM: each enemy must have states (Idle/Patrol/Follow/Attack/Flee/Dead) with per-frame transition checks
- Wave-based spawning: Wave N = baseCount + N*2 enemies, 3s break between waves
- Bullet pooling: pre-create bullet meshes, reuse with pool.get()/pool.release()
- Hit feedback stack on EVERY hit: camera shake + mesh flash + floating damage text + knockback + SFX + particle burst
- Use \`squad-shooter\` asset pack: modelUrl("squad-shooter", "characters/player/Main_Char_01_(without_rig).glb") for player (3 skins)
- Do NOT use kaykit factory helpers (createPlayer3D, createBarrier3D) — load squad-shooter GLBs directly via loadGLTF/loadModel
- Arena: generateShooterArena() creates procedural tile-based arena with Ground, Border, Block, Wall GLBs
- Enemy models: modelUrl("squad-shooter", "characters/enemies/Bomber_1.glb") — 22 variants in 4 tiers + 3 bosses
- Weapon pickups: modelUrl("squad-shooter", "weapons/Shotgun.glb") — Shotgun, Minigun, Grenade_launcher, Teslagun
- World tiles: modelUrl("squad-shooter", "environment/world_1/1_Ground_1.glb"), Border_1/2/3/4, Block_1x1_Big/Medium/Small, Wall_1x1/1x2
- Collectibles: modelUrl("squad-shooter", "misc/Coin.glb"), Ring.glb, Chest.glb
- Bullets: modelUrl("squad-shooter", "particles/Bullet.glb") for bullet mesh pool
- Audio: soundUrl("squad-shooter/sfx/shot"), soundUrl("squad-shooter/sfx/coin_pickup"), soundUrl("squad-shooter/sfx/enemy_hit_1"), soundUrl("squad-shooter/sfx/explosion"), soundUrl("squad-shooter/sfx/player_hit"), soundUrl("squad-shooter/sfx/boss_scream"), soundUrl("squad-shooter/sfx/upgrade"). Music: soundUrl("squad-shooter/music/game_music")
- Enemy tiers: Tier 1 (wave 1+): Normal/Skinny/Mine. Tier 2 (wave 3+): Pistolman/RifleMan/CowBoy. Tier 3 (wave 5+): Bomber/Grenader/ShotgunMan/MeeleMan. Tier 4 (wave 7+): Elite variants. Boss every 5 waves: Boss_Bomber/Old_Boss/Sniper_Boss`);
					console.log(`[Chat API] 3D shooter addendum injected`);
				}
			}
			// 2D asset catalog is already in the system prompt (game-2d-developer.ts)
			// — no need to duplicate it in addenda
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

		// Build file creation filter options for game projects
		let fileToolsOptions: FileToolsOptions | undefined;
		if (isGameProject || isGame2d || isGame3d) {
			const templateFiles = isGame2d ? GAME_2D_TEMPLATE_FILES : GAME_3D_TEMPLATE_FILES;
			const protectedPaths = new Set(templateFiles.map((t) => t.path));
			// For 2D games, protect GameScene2D.ts whenever it already exists
			// (it's auto-composed with Feature Bank — AI should only patch_file to add decorations)
			if (isGame2d && existingFiles.some((f) => f.path === "src/scenes/GameScene2D.ts")) {
				protectedPaths.add("src/scenes/GameScene2D.ts");
			}
			const forbiddenPatterns: RegExp[] = isGame2d
				? [
					// Block helper scenes + prevent AI from creating 3D scenes in 2D projects
					/(?:^|\/)(?:Boot|Menu|Loading|Title|Splash|Intro|Main)Scene(?:2D)?\.ts$/i,
					/GameScene3D\.ts$/i, // Block 3D scene in 2D projects
					/GameOverScene3D\.ts$/i,
					/(?:^|\/)App\.tsx$/i, // App.tsx is PRE-CREATED, AI must not touch it
					/(?:^|\/)Game2D\.tsx$/i, // Game2D.tsx is PRE-CREATED, AI must not touch it
				]
				: [
					// Block ALL helper scenes — Game3D.tsx provides loading/menu/restart
					/(?:^|\/)(?:Boot|Menu|Loading|Title|Splash|Intro|Main)Scene(?:3D)?\.ts$/i,
				];
			// Path rewrites: AI consistently creates wrong filenames
			const pathRewrites = isGame2d
				? new Map([
					// 2D: wrong GameScene names → GameScene2D.ts
					["src/scenes/GameScene.ts", "src/scenes/GameScene2D.ts"],
					["src/scenes/Game2DScene.ts", "src/scenes/GameScene2D.ts"],
					["src/scenes/GameScene2d.ts", "src/scenes/GameScene2D.ts"],
					// AI creates constants at wrong paths
					["src/constants.ts", "src/config/constants.ts"],
					["src/scenes/constants.ts", "src/config/constants.ts"],
					["src/game-config.ts", "src/config/constants.ts"],
					["constants.ts", "src/config/constants.ts"],
				])
				: new Map([
					// 3D: wrong GameScene names → GameScene3D.ts
					["src/scenes/GameScene.ts", "src/scenes/GameScene3D.ts"],
					["src/scenes/Game3DScene.ts", "src/scenes/GameScene3D.ts"],
					["src/scenes/GameScene3d.ts", "src/scenes/GameScene3D.ts"],
					["src/scenes/GameOverScene.ts", "src/scenes/GameOverScene3D.ts"],
					["src/scenes/GameOver.ts", "src/scenes/GameOverScene3D.ts"],
					["src/scenes/GameOverScene3d.ts", "src/scenes/GameOverScene3D.ts"],
					["src/config/constants-3d.ts", "src/config/constants.ts"],
					["src/constants.ts", "src/config/constants.ts"],
					["src/scenes/constants.ts", "src/config/constants.ts"],
					["src/game-config.ts", "src/config/constants.ts"],
					["constants.ts", "src/config/constants.ts"],
				]);
			const allowedPathPatterns: RegExp[] = isGame2d
				? [
					/^docs\//, // Any doc file
					/^src\/config\/constants\.ts$/, // Game constants
					/^src\/scenes\/GameScene2D\.ts$/, // Main 2D scene
					/^src\/game\/[a-zA-Z0-9_-]+\.ts$/, // Custom game helpers (enemies, level-gen, items, etc.)
					/^src\/config\/[a-zA-Z0-9_-]+\.ts$/, // Additional config files
				]
				: [
					/^docs\//, // Any doc file
					/^src\/config\/constants(?:-3d)?\.ts$/, // Game constants (+ re-export shim)
					/^src\/scenes\/GameScene3D\.ts$/, // Main 3D scene (ONLY scene AI should create)
					/^src\/objects\//, // Optional: Player.ts, Enemy.ts
					/^src\/utils\/level-builder\.ts$/, // Optional: level generation
				];
			// Import path rewrites: fix import references that don't match path-rewritten filenames
			const importRewrites: [RegExp, string][] = isGame2d
				? [] // 2D imports are straightforward
				: [
					// AI writes import from "constants-3d" but file is rewritten to "constants"
					[/from\s+"\.\.\/config\/constants-3d"/g, 'from "../config/constants"'],
					[/from\s+'\.\.\/config\/constants-3d'/g, "from '../config/constants'"],
					[/from\s+"\.\/constants-3d"/g, 'from "./constants"'],
					[/from\s+'\.\/constants-3d'/g, "from './constants'"],
				];
			fileToolsOptions = { protectedPaths, forbiddenPatterns, pathRewrites, allowedPathPatterns, importRewrites };
			console.log(`[Chat API] File filter active: ${protectedPaths.size} protected, ${forbiddenPatterns.length} forbidden, ${pathRewrites.size} rewrites, ${allowedPathPatterns.length} allowed patterns`);
		}
		const allTools = createFileTools(appId, fileToolsOptions);

		// Agent-specific tool filtering: only pass tools the primary agent is allowed to use
		const agentToolIds = primaryAgent?.tools || [];
		const tools: Record<string, unknown> = {};
		for (const [toolId, toolDef] of Object.entries(allTools)) {
			if (agentToolIds.length === 0 || agentToolIds.includes(toolId as any)) {
				tools[toolId] = toolDef;
			}
		}

		const modelMessages = await convertToModelMessages(messages);
		const byok = hasByok ? byokKeys : undefined;

		// Determine effective model ID: user selection wins, agent tier is fallback
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
		const isPlanOnly = isNewProject && !isVisualEdit && !isGame2d;
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
			tools: tools as any,
			stopWhen: stepCountIs(maxSteps),
			toolChoice: "auto",
			// 2D games: temperature 0.6 for creative variety — each game unique
			...(isGame2d ? { temperature: 0.6 } : {}),
			onError: ({ error }) => {
				generationError = error;
				const errMsg = error instanceof Error ? error.message : String(error);
				console.error(
					`[Chat API] Stream error - model=${modelId || "default"}, steps=${stepCount}, files=${totalFileCalls}: ${errMsg}`,
				);
			},
			onStepFinish: ({ toolCalls, finishReason, usage }) => {
				stepCount++;
				const fileToolNames = ["create_file", "update_file", "delete_file", "define_entities", "read_file", "patch_file", "manage_environments", "manage_backups"];
				const fileCallsInStep = (toolCalls || []).filter(
					(tc) => fileToolNames.includes(tc.toolName),
				).length;
				totalFileCalls += fileCallsInStep;

				// Track changed files and entities for wiki sync
				for (const tc of toolCalls || []) {
					const args = (tc as Record<string, unknown>).args as Record<string, unknown> | undefined;
					if ((tc.toolName === "create_file" || tc.toolName === "update_file" || tc.toolName === "patch_file") && args && typeof args.path === "string") {
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
