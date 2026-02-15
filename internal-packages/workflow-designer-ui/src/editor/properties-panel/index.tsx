import {
	isActionNode,
	isAiAgentNode,
	isAppEntryNode,
	isCodeNode,
	isContentGenerationNode,
	isDataQueryNode,
	isDataStoreNode,
	isEditFieldsNode,
	isEndNode,
	isErrorTriggerNode,
	isFileNode,
	isFilterNode,
	isIfNode,
	isImageGenerationNode,
	isLoopNode,
	isMemoryNodeNode,
	isMergeNode,
	isQueryNode,
	isSortNode,
	isSwitchNode,
	isTextGenerationNode,
	isTextNode,
	isToolNodeNode,
	isTriggerNode,
	isChatModelNode,
	isIntegrationNode,
	isVectorStoreNode,
	isWaitNode,
	isWebPageNode,
	isDataTableNode,
	isFormTriggerNode,
	isAggregateNode,
	isSummarizeNode,
	isLimitNode,
	isRemoveDuplicatesNode,
	isRenameKeysNode,
	isSplitOutNode,
	isCompareDatasetsNode,
	isExecuteSubWorkflowNode,
	isRespondToWebhookNode,
	isCustomVariablesNode,
	type OperationNode,
} from "@giselles-ai/protocol";
import clsx from "clsx/lite";
import { useShallow } from "zustand/shallow";
import {
	useAppDesignerStore,
	useSetCurrentShortcutScope,
} from "../../app-designer";
import { AiAgentNodePropertiesPanel } from "./ai-agent-node-properties-panel";
import { ChatModelPropertiesPanel } from "./chat-model-properties-panel";
import { ToolNodePropertiesPanel } from "./tool-node-properties-panel";
import { MemoryNodePropertiesPanel } from "./memory-node-properties-panel";
import { ActionNodePropertiesPanel } from "./action-node-properties-panel";
import { AppEntryNodePropertiesPanel } from "./app-entry-node-properties-panel";
import { DataQueryNodePropertiesPanel } from "./data-query-properties-panel";
import { DataStoreNodePropertiesPanel } from "./data-store-properties-panel";
import { EndNodePropertiesPanel } from "./end-node-properties-panel";
import { FlowControlPropertiesPanel } from "./flow-control-properties-panel";
import { FileNodePropertiesPanel } from "./file-node-properties-panel";
import { ImageGenerationNodePropertiesPanel } from "./image-generation-node-properties-panel";
import { InputPanel } from "./input-panel";
import { IntegrationNodePropertiesPanel } from "./integration-node-properties-panel";
import { OutputPanel } from "./output-panel";
import { QueryNodePropertiesPanel } from "./query-node-properties-panel";
import { TextGenerationNodePropertiesPanel } from "./text-generation-node-properties-panel";
import { TextGenerationNodePropertiesPanelV2 } from "./text-generation-node-properties-panel-v2";
import { TextNodePropertiesPanel } from "./text-node-properties-panel";
import { ThreePanelLayout } from "./three-panel-layout";
import { TriggerNodePropertiesPanel } from "./trigger-node-properties-panel";
import { useExecuteStep } from "./use-execute-step";
import { VectorStoreNodePropertiesPanel } from "./vector-store";
import { WebPageNodePropertiesPanel } from "./web-page-node-properties-panel";

/**
 * Check if a node should use the 3-panel layout (INPUT | PARAMETERS | OUTPUT).
 * Generation/execution nodes AND flow control/data transform nodes benefit
 * from seeing inputs and outputs alongside parameters.
 */
function isThreePanelNode(node: unknown): boolean {
	if (!node) return false;
	return (
		isTextGenerationNode(node) ||
		isImageGenerationNode(node) ||
		isContentGenerationNode(node) ||
		isAiAgentNode(node) ||
		isIntegrationNode(node) ||
		isDataQueryNode(node) ||
		isQueryNode(node) ||
		isIfNode(node) ||
		isSwitchNode(node) ||
		isMergeNode(node) ||
		isLoopNode(node) ||
		isCodeNode(node) ||
		isFilterNode(node) ||
		isEditFieldsNode(node) ||
		isSortNode(node) ||
		isWaitNode(node) ||
		isErrorTriggerNode(node) ||
		isAggregateNode(node) ||
		isSummarizeNode(node) ||
		isLimitNode(node) ||
		isRemoveDuplicatesNode(node) ||
		isRenameKeysNode(node) ||
		isSplitOutNode(node) ||
		isCompareDatasetsNode(node) ||
		isExecuteSubWorkflowNode(node) ||
		isRespondToWebhookNode(node) ||
		isCustomVariablesNode(node) ||
		isDataTableNode(node) ||
		isFormTriggerNode(node)
	);
}

export function PropertiesPanel() {
	const selectedNodes = useAppDesignerStore(
		useShallow((s) =>
			s.nodes.filter((node) => s.ui.nodeState[node.id]?.selected),
		),
	);
	const setCurrentShortcutScope = useSetCurrentShortcutScope();

	const node = selectedNodes[0];
	const useThreePanel = isThreePanelNode(node);
	const operationNode = useThreePanel ? (node as unknown as OperationNode) : undefined;
	const { executeStep } = useExecuteStep(operationNode);

	const parametersContent = (
		<>
			{isTextGenerationNode(node) && (
				<TextGenerationNodePropertiesPanel
					node={node}
					key={node.id}
				/>
			)}
			{isImageGenerationNode(node) && (
				<ImageGenerationNodePropertiesPanel
					node={node}
					key={node.id}
				/>
			)}
			{isTextNode(node) && (
				<TextNodePropertiesPanel
					node={node}
					key={node.id}
				/>
			)}
			{isFileNode(node) && (
				<FileNodePropertiesPanel
					node={node}
					key={node.id}
				/>
			)}
			{isWebPageNode(node) && (
				<WebPageNodePropertiesPanel
					node={node}
					key={node.id}
				/>
			)}
			{isTriggerNode(node) && (
				<TriggerNodePropertiesPanel
					node={node}
					key={node.id}
				/>
			)}
			{isActionNode(node) && (
				<ActionNodePropertiesPanel
					node={node}
					key={node.id}
				/>
			)}
			{isIntegrationNode(node) && (
				<IntegrationNodePropertiesPanel
					node={node}
					key={node.id}
				/>
			)}
			{isVectorStoreNode(node) && (
				<VectorStoreNodePropertiesPanel
					node={node}
					key={node.id}
				/>
			)}
			{isDataStoreNode(node) && (
				<DataStoreNodePropertiesPanel
					node={node}
					key={node.id}
				/>
			)}
			{isDataQueryNode(node) && (
				<DataQueryNodePropertiesPanel
					node={node}
					key={node.id}
				/>
			)}
			{isQueryNode(node) && (
				<QueryNodePropertiesPanel
					node={node}
					key={node.id}
				/>
			)}
			{isAppEntryNode(node) && (
				<AppEntryNodePropertiesPanel
					node={node}
					key={node.id}
				/>
			)}
			{isContentGenerationNode(node) && (
				<TextGenerationNodePropertiesPanelV2
					node={node}
					key={node.id}
				/>
			)}
			{isAiAgentNode(node) && (
				<AiAgentNodePropertiesPanel
					node={node}
					key={node.id}
				/>
			)}
			{isChatModelNode(node) && (
				<ChatModelPropertiesPanel
					node={node}
					key={node.id}
				/>
			)}
			{isToolNodeNode(node) && (
				<ToolNodePropertiesPanel
					node={node}
					key={node.id}
				/>
			)}
			{isMemoryNodeNode(node) && (
				<MemoryNodePropertiesPanel
					node={node}
					key={node.id}
				/>
			)}
			{isEndNode(node) && (
				<EndNodePropertiesPanel
					node={node}
					key={node.id}
				/>
			)}
			{(isIfNode(node) ||
				isSwitchNode(node) ||
				isMergeNode(node) ||
				isLoopNode(node) ||
				isCodeNode(node) ||
				isFilterNode(node) ||
				isEditFieldsNode(node) ||
				isSortNode(node) ||
				isWaitNode(node) ||
				isErrorTriggerNode(node) ||
				isDataTableNode(node) ||
				isFormTriggerNode(node) ||
				isAggregateNode(node) ||
				isSummarizeNode(node) ||
				isLimitNode(node) ||
				isRemoveDuplicatesNode(node) ||
				isRenameKeysNode(node) ||
				isSplitOutNode(node) ||
				isCompareDatasetsNode(node) ||
				isExecuteSubWorkflowNode(node) ||
				isRespondToWebhookNode(node) ||
				isCustomVariablesNode(node)) && (
				<FlowControlPropertiesPanel
					node={node}
					key={node.id}
				/>
			)}
		</>
	);

	return (
		<section
			className={clsx("h-full text-inverse outline-none")}
			aria-label="Properties Panel"
			onFocus={() => setCurrentShortcutScope("properties-panel")}
			onBlur={(e) => {
				if (!e.currentTarget.contains(e.relatedTarget)) {
					setCurrentShortcutScope("canvas");
				}
			}}
			tabIndex={-1}
		>
			{useThreePanel && node ? (
				<ThreePanelLayout
					inputPanel={<InputPanel nodeId={node.id} onExecutePrevious={executeStep} />}
					parametersPanel={parametersContent}
					outputPanel={<OutputPanel nodeId={node.id} onExecuteStep={executeStep} node={operationNode} />}
				/>
			) : (
				parametersContent
			)}
		</section>
	);
}
