import type { ToolNodeNode } from "@giselles-ai/protocol";
import { useCallback, useMemo } from "react";
import {
	useAppDesignerStore,
	useDeleteNode,
	useUpdateNodeData,
	useUpdateNodeDataContent,
} from "../../app-designer";
import { PropertiesPanelRoot } from "./ui";
import { NodePanelHeader } from "./ui/node-panel-header";
import { SettingDetail, SettingLabel } from "./ui/setting-label";

export function ToolNodePropertiesPanel({
	node,
}: {
	node: ToolNodeNode;
}) {
	const updateNodeData = useUpdateNodeData();
	const updateNodeDataContent = useUpdateNodeDataContent();
	const deleteNode = useDeleteNode();

	const nodes = useAppDesignerStore((s) => s.nodes);

	// Get all AI Agent nodes in the workspace (for agent tool picker)
	const aiAgentNodes = useMemo(
		() =>
			nodes.filter(
				(n) =>
					n.content.type === "aiAgent" && n.id !== node.id,
			),
		[nodes, node.id],
	);

	const handleToolTypeChange = useCallback(
		(value: string) => {
			updateNodeDataContent(node, {
				toolType: value as any,
			});
		},
		[node, updateNodeDataContent],
	);

	return (
		<PropertiesPanelRoot>
			<NodePanelHeader
				node={node}
				onChangeName={(name) => updateNodeData(node, { name })}
				onDelete={() => deleteNode(node.id)}
			/>
			<div className="flex flex-col gap-[16px] px-[16px] py-[8px] overflow-y-auto">
				{/* Tool Type */}
				<div className="flex flex-col gap-[8px]">
					<SettingLabel>Tool Type</SettingLabel>
					<select
						value={node.content.toolType}
						onChange={(e) => handleToolTypeChange(e.target.value)}
						className="bg-transparent border border-inverse/20 rounded-md px-[8px] py-[6px] text-[13px] text-inverse"
					>
						<optgroup label="Basic">
							<option value="builtinTool">Built-in Tool</option>
							<option value="integration">Integration Piece</option>
							<option value="webSearch">Web Search</option>
							<option value="httpRequest">HTTP Request</option>
							<option value="codeExecution">Code Tool</option>
						</optgroup>
						<optgroup label="Advanced (V3)">
							<option value="agentTool">Agent Tool</option>
							<option value="mcpClient">MCP Client</option>
							<option value="humanReview">Human Review</option>
							<option value="subWorkflow">Sub-Workflow</option>
						</optgroup>
					</select>
				</div>

				{/* Built-in Tool Configuration */}
				{node.content.toolType === "builtinTool" && (
					<div className="flex flex-col gap-[8px]">
						<SettingLabel>Tool Name</SettingLabel>
						<select
							value={node.content.builtinToolName ?? ""}
							onChange={(e) =>
								updateNodeDataContent(node, {
									builtinToolName: (e.target.value || undefined) as typeof node.content.builtinToolName,
								})
							}
							className="bg-transparent border border-inverse/20 rounded-md px-[8px] py-[6px] text-[13px] text-inverse"
						>
							<option value="">Select a tool...</option>
							<option value="google-web-search">Google Web Search</option>
							<option value="anthropic-web-search">Anthropic Web Search</option>
							<option value="openai-web-search">OpenAI Web Search</option>
							<option value="github-api">GitHub API</option>
							<option value="postgres">PostgreSQL</option>
						</select>
					</div>
				)}

				{/* Integration Tool Configuration */}
				{node.content.toolType === "integration" && (
					<div className="flex flex-col gap-[8px]">
						<SettingLabel>Integration Piece</SettingLabel>
						<SettingDetail size="sm">
							{node.content.pieceName
								? `${node.content.pieceName}: ${node.content.actionName}`
								: "No piece selected"}
						</SettingDetail>
						<div className="flex flex-col gap-[4px]">
							<input
								type="text"
								placeholder="Piece name (e.g., slack)"
								value={node.content.pieceName ?? ""}
								onChange={(e) =>
									updateNodeDataContent(node, {
										pieceName: e.target.value || undefined,
									})
								}
								className="bg-transparent border border-inverse/20 rounded-md px-[8px] py-[6px] text-[13px] text-inverse"
							/>
							<input
								type="text"
								placeholder="Action name (e.g., send_message)"
								value={node.content.actionName ?? ""}
								onChange={(e) =>
									updateNodeDataContent(node, {
										actionName: e.target.value || undefined,
									})
								}
								className="bg-transparent border border-inverse/20 rounded-md px-[8px] py-[6px] text-[13px] text-inverse"
							/>
						</div>
					</div>
				)}

				{/* Web Search Configuration */}
				{node.content.toolType === "webSearch" && (
					<div className="flex flex-col gap-[8px]">
						<SettingLabel>Web Search Provider</SettingLabel>
						<select
							value={node.content.builtinToolName ?? "google-web-search"}
							onChange={(e) =>
								updateNodeDataContent(node, {
									builtinToolName: e.target.value as typeof node.content.builtinToolName,
								})
							}
							className="bg-transparent border border-inverse/20 rounded-md px-[8px] py-[6px] text-[13px] text-inverse"
						>
							<option value="google-web-search">Google Web Search</option>
							<option value="anthropic-web-search">Anthropic Web Search</option>
							<option value="openai-web-search">OpenAI Web Search</option>
						</select>
					</div>
				)}

				{/* HTTP Request Configuration */}
				{node.content.toolType === "httpRequest" && (
					<div className="flex flex-col gap-[8px]">
						<SettingLabel>Description</SettingLabel>
						<SettingDetail size="sm">
							Tell the AI when to use this HTTP tool
						</SettingDetail>
						<input
							type="text"
							placeholder="e.g., Fetch user data from the API"
							value={(node.content as any).httpDescription ?? ""}
							onChange={(e) =>
								updateNodeDataContent(node, {
									httpDescription: e.target.value || undefined,
								})
							}
							className="bg-transparent border border-inverse/20 rounded-md px-[8px] py-[6px] text-[13px] text-inverse"
						/>
						<SettingLabel>Method</SettingLabel>
						<select
							value={(node.content as any).httpMethod ?? "GET"}
							onChange={(e) =>
								updateNodeDataContent(node, {
									httpMethod: e.target.value,
								})
							}
							className="bg-transparent border border-inverse/20 rounded-md px-[8px] py-[6px] text-[13px] text-inverse"
						>
							<option value="GET">GET</option>
							<option value="POST">POST</option>
							<option value="PUT">PUT</option>
							<option value="DELETE">DELETE</option>
							<option value="PATCH">PATCH</option>
							<option value="HEAD">HEAD</option>
						</select>
						<SettingLabel>URL</SettingLabel>
						<SettingDetail size="sm">
							The AI can override this URL dynamically
						</SettingDetail>
						<input
							type="text"
							placeholder="https://api.example.com/endpoint"
							value={(node.content as any).httpUrl ?? ""}
							onChange={(e) =>
								updateNodeDataContent(node, {
									httpUrl: e.target.value || undefined,
								})
							}
							className="bg-transparent border border-inverse/20 rounded-md px-[8px] py-[6px] text-[13px] text-inverse"
						/>
						<SettingLabel>Headers (JSON)</SettingLabel>
						<textarea
							placeholder={`{\n  "Content-Type": "application/json",\n  "Authorization": "Bearer ..."\n}`}
							value={
								(node.content as any).httpHeaders
									? JSON.stringify((node.content as any).httpHeaders, null, 2)
									: ""
							}
							onChange={(e) => {
								try {
									const parsed = e.target.value ? JSON.parse(e.target.value) : undefined;
									updateNodeDataContent(node, { httpHeaders: parsed });
								} catch {
									// Allow typing; don't update until valid JSON
								}
							}}
							rows={3}
							className="w-full rounded-[8px] border border-[hsla(0,0%,100%,0.1)] bg-[hsla(0,0%,100%,0.05)] px-[12px] py-[8px] text-[13px] text-white font-mono outline-none focus:border-[hsla(0,0%,100%,0.3)] resize-y"
						/>
						{((node.content as any).httpMethod ?? "GET") !== "GET" &&
							((node.content as any).httpMethod ?? "GET") !== "HEAD" && (
							<>
								<SettingLabel>Body</SettingLabel>
								<SettingDetail size="sm">
									Request body. The AI can provide this dynamically.
								</SettingDetail>
								<textarea
									placeholder={`{\n  "key": "value"\n}`}
									value={(node.content as any).httpBody ?? ""}
									onChange={(e) =>
										updateNodeDataContent(node, {
											httpBody: e.target.value || undefined,
										})
									}
									rows={4}
									className="w-full rounded-[8px] border border-[hsla(0,0%,100%,0.1)] bg-[hsla(0,0%,100%,0.05)] px-[12px] py-[8px] text-[13px] text-white font-mono outline-none focus:border-[hsla(0,0%,100%,0.3)] resize-y"
								/>
							</>
						)}
					</div>
				)}

				{/* Code Execution Configuration */}
				{node.content.toolType === "codeExecution" && (
					<div className="flex flex-col gap-[8px]">
						<SettingLabel>Tool Name</SettingLabel>
						<input
							type="text"
							placeholder="e.g., calculate_price"
							value={node.content.codeToolName ?? ""}
							onChange={(e) =>
								updateNodeDataContent(node, {
									codeToolName: e.target.value || undefined,
								})
							}
							className="bg-transparent border border-inverse/20 rounded-md px-[8px] py-[6px] text-[13px] text-inverse"
						/>
						<SettingLabel>Description</SettingLabel>
						<textarea
							placeholder="Describe what this tool does so the AI knows when to use it..."
							value={node.content.codeToolDescription ?? ""}
							onChange={(e) =>
								updateNodeDataContent(node, {
									codeToolDescription: e.target.value || undefined,
								})
							}
							rows={2}
							className="w-full rounded-[8px] border border-[hsla(0,0%,100%,0.1)] bg-[hsla(0,0%,100%,0.05)] px-[12px] py-[8px] text-[13px] text-white outline-none focus:border-[hsla(0,0%,100%,0.3)] resize-y"
						/>
						<SettingLabel>Input Schema (JSON)</SettingLabel>
						<SettingDetail size="sm">
							Define the parameters the AI can pass to this tool
						</SettingDetail>
						<textarea
							placeholder={`{\n  "type": "object",\n  "properties": {\n    "query": { "type": "string", "description": "Search query" }\n  },\n  "required": ["query"]\n}`}
							value={node.content.codeToolInputSchema ?? ""}
							onChange={(e) =>
								updateNodeDataContent(node, {
									codeToolInputSchema: e.target.value || undefined,
								})
							}
							rows={5}
							className="w-full rounded-[8px] border border-[hsla(0,0%,100%,0.1)] bg-[hsla(0,0%,100%,0.05)] px-[12px] py-[8px] text-[13px] text-white font-mono outline-none focus:border-[hsla(0,0%,100%,0.3)] resize-y"
						/>
						<SettingLabel>Code</SettingLabel>
						<SettingDetail size="sm">
							JavaScript function body. Use `params` to access input. Return the result.
						</SettingDetail>
						<textarea
							placeholder={`// Example: multiply two numbers\nconst result = params.a * params.b;\nreturn { product: result };`}
							value={node.content.codeToolCode ?? ""}
							onChange={(e) =>
								updateNodeDataContent(node, {
									codeToolCode: e.target.value || undefined,
								})
							}
							rows={8}
							className="w-full rounded-[8px] border border-[hsla(0,0%,100%,0.1)] bg-[hsla(0,0%,100%,0.05)] px-[12px] py-[8px] text-[13px] text-white font-mono outline-none focus:border-[hsla(0,0%,100%,0.3)] resize-y"
						/>
					</div>
				)}

				{/* V3: Agent Tool Configuration */}
				{node.content.toolType === "agentTool" && (
					<div className="flex flex-col gap-[8px]">
						<SettingLabel>Target AI Agent</SettingLabel>
						<SettingDetail size="sm">
							Select an AI Agent node in this workspace to delegate tasks to.
						</SettingDetail>
						{aiAgentNodes.length > 0 ? (
							<select
								value={(node.content as any).targetAgentNodeId ?? ""}
								onChange={(e) =>
									updateNodeDataContent(node, {
										targetAgentNodeId: e.target.value || undefined,
									})
								}
								className="bg-transparent border border-inverse/20 rounded-md px-[8px] py-[6px] text-[13px] text-inverse"
							>
								<option value="">Select an AI Agent...</option>
								{aiAgentNodes.map((agentNode) => (
									<option key={agentNode.id} value={agentNode.id}>
										{agentNode.name || agentNode.id}
									</option>
								))}
							</select>
						) : (
							<SettingDetail size="sm">
								No other AI Agent nodes found. Add an AI Agent node to the workspace first.
							</SettingDetail>
						)}
					</div>
				)}

				{/* V3: MCP Client Configuration */}
				{node.content.toolType === "mcpClient" && (
					<div className="flex flex-col gap-[8px]">
						<SettingLabel>MCP Server Connection</SettingLabel>
						<SettingDetail size="sm">
							Connect to an MCP server via SSE URL or stdio command.
						</SettingDetail>
						<SettingLabel>SSE URL</SettingLabel>
						<input
							type="text"
							placeholder="https://mcp-server.example.com/sse"
							value={(node.content as any).mcpServerUrl ?? ""}
							onChange={(e) =>
								updateNodeDataContent(node, {
									mcpServerUrl: e.target.value || undefined,
								})
							}
							className="bg-transparent border border-inverse/20 rounded-md px-[8px] py-[6px] text-[13px] text-inverse"
						/>
						<SettingDetail size="sm">
							Or use stdio transport:
						</SettingDetail>
						<SettingLabel>Command</SettingLabel>
						<input
							type="text"
							placeholder="npx -y @modelcontextprotocol/server-example"
							value={(node.content as any).mcpServerCommand ?? ""}
							onChange={(e) =>
								updateNodeDataContent(node, {
									mcpServerCommand: e.target.value || undefined,
								})
							}
							className="bg-transparent border border-inverse/20 rounded-md px-[8px] py-[6px] text-[13px] text-inverse"
						/>
						<SettingLabel>Arguments (comma-separated)</SettingLabel>
						<input
							type="text"
							placeholder="--port,3000"
							value={((node.content as any).mcpServerArgs ?? []).join(",")}
							onChange={(e) =>
								updateNodeDataContent(node, {
									mcpServerArgs: e.target.value
										? e.target.value.split(",").map((s: string) => s.trim())
										: undefined,
								})
							}
							className="bg-transparent border border-inverse/20 rounded-md px-[8px] py-[6px] text-[13px] text-inverse"
						/>
					</div>
				)}

				{/* V3: Human Review Configuration */}
				{node.content.toolType === "humanReview" && (
					<div className="flex flex-col gap-[8px]">
						<SettingLabel>Review Tool Name</SettingLabel>
						<SettingDetail size="sm">
							The tool name the AI will call to request human approval.
						</SettingDetail>
						<input
							type="text"
							placeholder="request_human_review"
							value={(node.content as any).reviewToolName ?? ""}
							onChange={(e) =>
								updateNodeDataContent(node, {
									reviewToolName: e.target.value || undefined,
								})
							}
							className="bg-transparent border border-inverse/20 rounded-md px-[8px] py-[6px] text-[13px] text-inverse"
						/>
						<SettingLabel>Description</SettingLabel>
						<SettingDetail size="sm">
							Tell the AI when it should request human review.
						</SettingDetail>
						<textarea
							placeholder="Request human review before proceeding with any destructive action"
							value={(node.content as any).reviewToolDescription ?? ""}
							onChange={(e) =>
								updateNodeDataContent(node, {
									reviewToolDescription: e.target.value || undefined,
								})
							}
							rows={3}
							className="w-full rounded-[8px] border border-[hsla(0,0%,100%,0.1)] bg-[hsla(0,0%,100%,0.05)] px-[12px] py-[8px] text-[13px] text-white outline-none focus:border-[hsla(0,0%,100%,0.3)] resize-y"
						/>
					</div>
				)}

				{/* V3: Sub-Workflow Configuration */}
				{node.content.toolType === "subWorkflow" && (
					<div className="flex flex-col gap-[8px]">
						<SettingLabel>Target Workspace ID</SettingLabel>
						<SettingDetail size="sm">
							The workspace containing the workflow to execute as a tool.
						</SettingDetail>
						<input
							type="text"
							placeholder="Workspace ID (e.g., wrks_abc123)"
							value={(node.content as any).targetWorkspaceId ?? ""}
							onChange={(e) =>
								updateNodeDataContent(node, {
									targetWorkspaceId: e.target.value || undefined,
								})
							}
							className="bg-transparent border border-inverse/20 rounded-md px-[8px] py-[6px] text-[13px] text-inverse"
						/>
						<SettingLabel>Entry Node ID (optional)</SettingLabel>
						<SettingDetail size="sm">
							Specify which node to run. Leave empty to auto-detect.
						</SettingDetail>
						<input
							type="text"
							placeholder="Node ID (auto-detect if empty)"
							value={(node.content as any).targetEntryNodeId ?? ""}
							onChange={(e) =>
								updateNodeDataContent(node, {
									targetEntryNodeId: e.target.value || undefined,
								})
							}
							className="bg-transparent border border-inverse/20 rounded-md px-[8px] py-[6px] text-[13px] text-inverse"
						/>
					</div>
				)}

				{/* Configuration (JSON) */}
				{Object.keys(node.content.configuration).length > 0 && (
					<div className="flex flex-col gap-[8px]">
						<SettingLabel>Configuration</SettingLabel>
						{Object.entries(node.content.configuration).map(([key, value]) => (
							<div key={key} className="flex items-center gap-[8px]">
								<span className="text-[11px] text-inverse/60 min-w-[80px]">
									{key}
								</span>
								<input
									type="text"
									value={String(value ?? "")}
									onChange={(e) =>
										updateNodeDataContent(node, {
											configuration: {
												...node.content.configuration,
												[key]: e.target.value,
											},
										})
									}
									className="flex-1 bg-transparent border border-inverse/20 rounded-md px-[8px] py-[4px] text-[12px] text-inverse"
								/>
							</div>
						))}
					</div>
				)}
			</div>
		</PropertiesPanelRoot>
	);
}
