import { useToasts } from "@giselle-internal/ui/toast";
import type { LanguageModelTier } from "@giselles-ai/language-model-registry";
import {
	type AiAgentNode,
	type Connection,
	type ContentGenerationNode,
	Node,
	type NodeLike,
} from "@giselles-ai/protocol";
import { useNodeGenerations, useUsageLimits } from "@giselles-ai/react";
import { useCallback } from "react";
import {
	useAppDesignerStore,
	useDeleteNode,
	useRemoveConnectionAndInput,
	useUpdateNodeData,
	useUpdateNodeDataContent,
} from "../../../app-designer";
import { useUsageLimitsReached } from "../../../hooks/usage-limits";
import { UsageLimitWarning } from "../../../ui/usage-limit-warning";
import { useKeyboardShortcuts } from "../../hooks/use-keyboard-shortcuts";
import { isPromptEmpty } from "../../lib/validate-prompt";
import { PropertiesPanelRoot } from "../ui";
import { GenerateCtaButton } from "../ui/generate-cta-button";
import { NodePanelHeader } from "../ui/node-panel-header";
import { PromptEditor } from "../ui/prompt-editor";
import { SettingDetail, SettingLabel } from "../ui/setting-label";
import { AdvancedOptions } from "../text-generation-node-properties-panel-v2/advanced-options";
import { GenerationPanel } from "../text-generation-node-properties-panel-v2/generation-panel";
import { ModelSettings } from "../text-generation-node-properties-panel-v2/model";
import { useNodeContext } from "../text-generation-node-properties-panel-v2/node-context";
import { AgentOutputPanel } from "./output-panel";

function isNode(nodeLike: NodeLike): nodeLike is Node {
	const result = Node.safeParse(nodeLike);
	return result.success;
}

export function AiAgentNodePropertiesPanel({
	node,
}: {
	node: AiAgentNode;
}) {
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);
	const workspaceConnections = useAppDesignerStore((s) => s.connections);
	const updateNodeData = useUpdateNodeData();
	const updateNodeDataContent = useUpdateNodeDataContent();
	const deleteNode = useDeleteNode();
	const removeConnectionAndInput = useRemoveConnectionAndInput();
	const { createAndStartGenerationRunner, isGenerating, stopGenerationRunner } =
		useNodeGenerations({
			nodeId: node.id,
			origin: { type: "studio", workspaceId },
		});
	// AiAgentNode is structurally compatible with ContentGenerationNode
	// for the fields used by useNodeContext (id, inputs, outputs)
	const { connections } = useNodeContext(
		node as unknown as ContentGenerationNode,
	);
	const usageLimitsReached = useUsageLimitsReached();
	const { error } = useToasts();

	useKeyboardShortcuts({
		onGenerate: () => {
			if (!isGenerating) {
				runAgent();
			}
		},
	});

	const runAgent = useCallback(() => {
		if (usageLimitsReached) {
			error("Please upgrade your plan to continue using this feature.");
			return;
		}
		if (isPromptEmpty(node.content.prompt)) {
			error("Please fill in the prompt to run.");
			return;
		}

		createAndStartGenerationRunner({
			origin: {
				type: "studio",
				workspaceId,
			},
			operationNode: node,
			sourceNodes: connections
				.map((connection) => connection.outputNode)
				.filter((nodeLike) => isNode(nodeLike)),
			connections: workspaceConnections.filter(
				(connection) => connection.inputNode.id === node.id,
			),
		});
	}, [
		node,
		createAndStartGenerationRunner,
		usageLimitsReached,
		error,
		connections,
		workspaceConnections,
		workspaceId,
	]);

	const usageLimits = useUsageLimits();
	const userTier: LanguageModelTier = usageLimits?.featureTier ?? "free";

	return (
		<PropertiesPanelRoot>
			{usageLimitsReached && <UsageLimitWarning />}
			<NodePanelHeader
				node={node}
				onChangeName={(name) => updateNodeData(node, { name })}
				onDelete={() => deleteNode(node.id)}
			/>

			<div className="grow-1 overflow-y-auto flex flex-col gap-[12px]">
				<ModelSettings
					node={node as unknown as ContentGenerationNode}
					onContentGenerationContentChange={(value) => {
						updateNodeDataContent(node, value);
					}}
					userTier={userTier}
				/>

				<SettingLabel>System Prompt</SettingLabel>
				<PromptEditor
					placeholder="Define the agent's behavior and instructions..."
					value={node.content.systemPrompt}
					onValueChange={(value: string) => {
						updateNodeDataContent(node, { systemPrompt: value });
					}}
				/>

				<SettingLabel>Prompt</SettingLabel>
				<PromptEditor
					placeholder="Write your prompt... Use @ to reference other nodes"
					value={node.content.prompt}
					onValueChange={(value: string) => {
						updateNodeDataContent(node, { prompt: value });
					}}
					connections={connections}
				/>

				<div className="flex items-center justify-between gap-[12px] px-[8px]">
					<SettingDetail size="md">Max Steps</SettingDetail>
					<input
						type="number"
						min={1}
						max={100}
						value={node.content.maxSteps ?? 30}
						onChange={(e) => {
							const value = Number.parseInt(e.target.value, 10);
							if (!Number.isNaN(value) && value >= 1 && value <= 100) {
								updateNodeDataContent(node, { maxSteps: value });
							}
						}}
						className="w-[60px] bg-[color-mix(in_srgb,var(--color-text-inverse,#fff)_10%,transparent)] text-inverse text-[14px] rounded-[6px] px-[8px] py-[4px] border border-white-400/20 text-center"
					/>
				</div>

				<AdvancedOptions
					node={node as unknown as ContentGenerationNode}
				/>

				<div className="flex flex-col gap-[4px]">
					<SettingLabel>Output</SettingLabel>
					<AgentOutputPanel nodeId={node.id} />
				</div>
			</div>
			<div className="shrink-0 px-[16px] pt-[8px] pb-[4px]">
				<GenerateCtaButton
					isGenerating={isGenerating}
					isEmpty={isPromptEmpty(node.content.prompt)}
					onClick={() => {
						if (isGenerating) stopGenerationRunner();
						else runAgent();
					}}
				/>
			</div>
		</PropertiesPanelRoot>
	);
}
