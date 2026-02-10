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

		const tools = createWorkflowTools();

		const xai = getXaiProvider();
		const result = streamText({
			model: xai.chat("grok-4-1-fast-reasoning"),
			system: WORKFLOW_SYSTEM_PROMPT,
			messages: modelMessages,
			tools,
			stopWhen: stepCountIs(30),
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
