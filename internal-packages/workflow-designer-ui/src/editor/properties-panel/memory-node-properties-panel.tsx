import type { MemoryNodeNode } from "@vibexe-ai/protocol";
import { useCallback } from "react";
import {
	useDeleteNode,
	useUpdateNodeData,
	useUpdateNodeDataContent,
} from "../../app-designer";
import { PropertiesPanelRoot } from "./ui";
import { NodePanelHeader } from "./ui/node-panel-header";
import { SettingLabel } from "./ui/setting-label";

export function MemoryNodePropertiesPanel({
	node,
}: {
	node: MemoryNodeNode;
}) {
	const updateNodeData = useUpdateNodeData();
	const updateNodeDataContent = useUpdateNodeDataContent();
	const deleteNode = useDeleteNode();

	const handleMemoryTypeChange = useCallback(
		(value: string) => {
			updateNodeDataContent(node, {
				memoryType: value as any,
			});
		},
		[node, updateNodeDataContent],
	);

	const handleContextWindowChange = useCallback(
		(value: number) => {
			updateNodeDataContent(node, {
				contextWindowLength: value,
			});
		},
		[node, updateNodeDataContent],
	);

	const handleSessionScopeChange = useCallback(
		(value: string) => {
			updateNodeDataContent(node, {
				sessionScope: value as "workspace" | "agent",
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
				{/* Memory Type */}
				<div className="flex flex-col gap-[8px]">
					<SettingLabel>Memory Type</SettingLabel>
					<select
						value={node.content.memoryType}
						onChange={(e) => handleMemoryTypeChange(e.target.value)}
						className="bg-transparent border border-inverse/20 rounded-md px-[8px] py-[6px] text-[13px] text-inverse"
					>
						<optgroup label="In-Memory">
							<option value="simpleMemory">Simple Memory</option>
							<option value="windowBuffer">Window Buffer</option>
							<option value="tokenBuffer">Token Buffer</option>
							<option value="summary">Summary Memory</option>
						</optgroup>
						<optgroup label="Persistent (Database)">
							<option value="postgresMemory">PostgreSQL Memory</option>
						</optgroup>
					</select>
					<p className="text-[11px] text-inverse/40">
						{node.content.memoryType === "simpleMemory"
							? "Stores all conversation messages in memory. Lost on restart."
							: node.content.memoryType === "windowBuffer"
								? "Keeps only the last N messages. Best for long-running agents."
								: node.content.memoryType === "tokenBuffer"
									? "Keeps messages that fit within a token budget."
									: node.content.memoryType === "summary"
										? "Summarizes old messages, keeps recent ones."
										: node.content.memoryType === "postgresMemory"
											? "Persists chat history in PostgreSQL. Survives restarts."
											: "Select a memory type."}
					</p>
				</div>

				{/* Max Tokens (for token buffer) */}
				{node.content.memoryType === "tokenBuffer" && (
					<div className="flex flex-col gap-[8px]">
						<SettingLabel>Max Tokens</SettingLabel>
						<div className="flex items-center gap-[8px]">
							<input
								type="number"
								min={100}
								max={128000}
								value={node.content.maxTokens ?? 4000}
								onChange={(e) =>
									updateNodeDataContent(node, {
										maxTokens: Math.max(100, Math.min(128000, Number.parseInt(e.target.value) || 4000)),
									})
								}
								className="w-[100px] bg-transparent border border-inverse/20 rounded-md px-[8px] py-[6px] text-[13px] text-inverse"
							/>
							<span className="text-[11px] text-inverse/40">tokens</span>
						</div>
						<p className="text-[11px] text-inverse/40">
							Keep messages that fit within this token budget.
						</p>
					</div>
				)}

				{/* Context Window Length */}
				<div className="flex flex-col gap-[8px]">
					<SettingLabel>Context Window Length</SettingLabel>
					<div className="flex items-center gap-[8px]">
						<input
							type="number"
							min={1}
							max={100}
							value={node.content.contextWindowLength}
							onChange={(e) =>
								handleContextWindowChange(
									Math.max(1, Math.min(100, Number.parseInt(e.target.value) || 10)),
								)
							}
							className="w-[80px] bg-transparent border border-inverse/20 rounded-md px-[8px] py-[6px] text-[13px] text-inverse"
						/>
						<span className="text-[11px] text-inverse/40">messages</span>
					</div>
					<p className="text-[11px] text-inverse/40">
						{node.content.memoryType === "simpleMemory"
							? "Maximum messages to store before trimming oldest."
							: "Number of recent messages to keep in the sliding window."}
					</p>
				</div>

				{/* Session Scope */}
				<div className="flex flex-col gap-[8px]">
					<SettingLabel>Session Scope</SettingLabel>
					<div className="flex gap-[8px]">
						<button
							type="button"
							onClick={() => handleSessionScopeChange("agent")}
							className={`px-[12px] py-[6px] rounded-md text-[12px] border ${
								node.content.sessionScope === "agent"
									? "bg-generation-node-1/20 border-generation-node-1 text-inverse"
									: "border-inverse/20 text-inverse/60 hover:text-inverse/80"
							}`}
						>
							Per Agent
						</button>
						<button
							type="button"
							onClick={() => handleSessionScopeChange("workspace")}
							className={`px-[12px] py-[6px] rounded-md text-[12px] border ${
								node.content.sessionScope === "workspace"
									? "bg-generation-node-1/20 border-generation-node-1 text-inverse"
									: "border-inverse/20 text-inverse/60 hover:text-inverse/80"
							}`}
						>
							Per Workspace
						</button>
					</div>
					<p className="text-[11px] text-inverse/40">
						{node.content.sessionScope === "agent"
							? "Each AI Agent node has its own memory. Separate conversations per agent."
							: "All AI Agents in this workspace share the same memory."}
					</p>
				</div>
			</div>
		</PropertiesPanelRoot>
	);
}
