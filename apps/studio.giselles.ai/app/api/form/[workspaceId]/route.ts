import type { NextRequest } from "next/server";
import { NodeId, WorkspaceId, isOperationNode } from "@giselles-ai/protocol";
import { giselle } from "@/app/giselle";

export const dynamic = "force-dynamic";

/**
 * GET /api/form/[workspaceId]
 *
 * Returns the form configuration (fields, title, etc.) for the workspace's Form Trigger node.
 */
export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ workspaceId: string }> },
) {
	const { workspaceId: workspaceIdStr } = await params;

	const parseResult = WorkspaceId.safeParse(workspaceIdStr);
	if (!parseResult.success) {
		return Response.json({ error: "Invalid workspace ID" }, { status: 400 });
	}

	const workspaceId = parseResult.data;

	try {
		const workspace = await giselle.getWorkspace(workspaceId);
		if (!workspace) {
			return Response.json(
				{ error: "Workspace not found" },
				{ status: 404 },
			);
		}

		// Find the Form Trigger node
		const formTriggerNode = workspace.nodes.find(
			(node) =>
				isOperationNode(node) && node.content.type === "formTrigger",
		);

		if (!formTriggerNode || !isOperationNode(formTriggerNode)) {
			return Response.json(
				{ error: "No Form Trigger node found in this workspace" },
				{ status: 404 },
			);
		}

		const content = formTriggerNode.content as {
			type: "formTrigger";
			fields: Array<{
				id: string;
				name: string;
				label: string;
				type: string;
				required: boolean;
				options: string[];
				placeholder: string;
				defaultValue: string;
			}>;
			submitButtonText: string;
			successMessage: string;
			title: string;
			description: string;
		};

		return Response.json({
			title: content.title || workspace.name || "Form",
			description: content.description || "",
			fields: content.fields || [],
			submitButtonText: content.submitButtonText || "Submit",
			successMessage:
				content.successMessage || "Form submitted successfully!",
		});
	} catch (error) {
		console.error("[Form API] Error getting config:", error);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * POST /api/form/[workspaceId]
 *
 * Handles form submissions. Triggers the workflow with the submitted data.
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ workspaceId: string }> },
) {
	const { workspaceId: workspaceIdStr } = await params;

	const parseResult = WorkspaceId.safeParse(workspaceIdStr);
	if (!parseResult.success) {
		return Response.json({ error: "Invalid workspace ID" }, { status: 400 });
	}

	const workspaceId = parseResult.data;

	let body: { data?: Record<string, string> };
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const { data } = body;
	if (!data || typeof data !== "object") {
		return Response.json(
			{ error: "data object is required" },
			{ status: 400 },
		);
	}

	try {
		const workspace = await giselle.getWorkspace(workspaceId);
		if (!workspace) {
			return Response.json(
				{ error: "Workspace not found" },
				{ status: 404 },
			);
		}

		// Find the Form Trigger node
		const formTriggerNode = workspace.nodes.find(
			(node) =>
				isOperationNode(node) && node.content.type === "formTrigger",
		);

		if (!formTriggerNode || !isOperationNode(formTriggerNode)) {
			return Response.json(
				{ error: "No Form Trigger node found in this workspace" },
				{ status: 404 },
			);
		}

		// Find a downstream operation node to execute (first connected node that processes data)
		const downstreamNode = workspace.nodes.find(
			(node) =>
				isOperationNode(node) &&
				node.id !== formTriggerNode.id &&
				(node.content.type === "textGeneration" ||
					node.content.type === "contentGeneration" ||
					node.content.type === "aiAgent" ||
					node.content.type === "integration" ||
					node.content.type === "code"),
		);

		if (downstreamNode) {
			// Fire and forget — trigger the workflow with form data as input
			giselle
				.createAndStartTask({
					workspaceId,
					nodeId: NodeId.parse(downstreamNode.id),
					inputs: [
						{
							type: "parameters" as const,
							items: Object.entries(data).map(([name, value]) => ({
								type: "string" as const,
								name,
								value: String(value),
							})),
						},
					],
					generationOriginType: "api",
				})
				.catch((err: unknown) => {
					console.error("[Form API] Task execution error:", err);
				});
		}

		return Response.json({
			success: true,
			message: "Form submitted successfully",
		});
	} catch (error) {
		console.error("[Form API] Fatal error:", error);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * OPTIONS /api/form/[workspaceId]
 *
 * CORS preflight handler for cross-origin form embeds.
 */
export async function OPTIONS() {
	return new Response(null, {
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		},
	});
}
