import { createOpenAI } from "@ai-sdk/openai";
import type { UIMessage } from "ai";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { createWorkflowTools } from "@/app/(main)/playground/lib/workflow-tools";
import { getUser } from "@/lib/auth/get-user";
import { WORKFLOW_SYSTEM_PROMPT } from "../system-prompt";

function getXaiProvider() {
	return createOpenAI({
		apiKey: process.env.XAI_API_KEY ?? "",
		baseURL: "https://api.x.ai/v1",
	});
}

/**
 * Detect if the user has approved a plan and we should enter build phase.
 * The chat UI sends "Build the workflow as planned." when the user clicks
 * the approval button. We also accept common freeform approval phrases.
 */
function isInBuildPhase(messages: UIMessage[]): boolean {
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg.role === "user") {
			const text = msg.parts
				.filter((p): p is { type: "text"; text: string } => p.type === "text")
				.map((p) => p.text)
				.join("")
				.toLowerCase();
			return (
				text.includes("build the workflow as planned") ||
				text.includes("build it") ||
				text.includes("looks good") ||
				text.includes("approve") ||
				text.includes("go ahead") ||
				text.includes("yes, build") ||
				text.includes("do it")
			);
		}
	}
	return false;
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
		const { messages } = body as {
			messages: UIMessage[];
		};

		if (!messages || !Array.isArray(messages) || messages.length === 0) {
			return new Response(JSON.stringify({ error: "Messages are required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		const modelMessages = await convertToModelMessages(messages);

		const allTools = createWorkflowTools();
		const buildPhase = isInBuildPhase(messages);

		// Phase 1 (planning): Only present_plan + lookup_piece_actions available.
		// Phase 2 (building): All build tools, no present_plan.
		const { present_plan, ...buildTools } = allTools;
		const tools = buildPhase
			? buildTools
			: { present_plan: allTools.present_plan, lookup_piece_actions: allTools.lookup_piece_actions };

		const xai = getXaiProvider();
		const result = streamText({
			model: xai.chat("grok-4-1-fast-reasoning"),
			system: WORKFLOW_SYSTEM_PROMPT,
			messages: modelMessages,
			tools,
			stopWhen: stepCountIs(50),
			toolChoice: "auto",
		});

		return result.toUIMessageStreamResponse({
			originalMessages: messages,
		});
	} catch (error) {
		console.error("[Workflow Builder Chat API] Error:", error);
		return new Response(JSON.stringify({ error: "Internal server error" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
