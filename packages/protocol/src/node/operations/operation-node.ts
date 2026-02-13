import type { ActionProvider } from "@giselles-ai/action-registry";
import type { TriggerProvider } from "@giselles-ai/trigger-registry";
import * as z from "zod/v4";
import { NodeBase, NodeReferenceBase } from "../base";
import { ActionContent, ActionContentReference } from "./action";
import {
	AggregateNodeContent,
	AggregateNodeContentReference,
} from "./aggregate-node";
import {
	AppEntryContent,
	AppEntryContentReference,
	AppEntryType,
} from "./app-entry";
import { AiAgentContent, AiAgentContentReference } from "./ai-agent";
import {
	ChatModelContent,
	ChatModelContentReference,
} from "./chat-model";
import { CodeNodeContent, CodeNodeContentReference } from "./code-node";
import {
	CompareDatasetsNodeContent,
	CompareDatasetsNodeContentReference,
} from "./compare-datasets-node";
import {
	ContentGenerationContent,
	ContentGenerationContentReference,
} from "./content-generation";
import { DataQueryContent, DataQueryContentReference } from "./data-query";
import {
	DataTableNodeContent,
	DataTableNodeContentReference,
} from "./data-table-node";
import {
	EditFieldsNodeContent,
	EditFieldsNodeContentReference,
} from "./edit-fields-node";
import { EndContent, EndContentReference } from "./end";
import {
	ErrorTriggerNodeContent,
	ErrorTriggerNodeContentReference,
} from "./error-trigger-node";
import { FilterNodeContent, FilterNodeContentReference } from "./filter-node";
import {
	FormTriggerNodeContent,
	FormTriggerNodeContentReference,
} from "./form-trigger-node";
import { IfNodeContent, IfNodeContentReference } from "./if-node";
import {
	ImageGenerationContent,
	ImageGenerationContentReference,
} from "./image-generation";
import {
	IntegrationContent,
	IntegrationContentReference,
} from "./integration";
import { LimitNodeContent, LimitNodeContentReference } from "./limit-node";
import { LoopNodeContent, LoopNodeContentReference } from "./loop-node";
import {
	MemoryNodeContent,
	MemoryNodeContentReference,
} from "./memory-node";
import { MergeNodeContent, MergeNodeContentReference } from "./merge-node";
import { QueryContent, QueryContentReference } from "./query";
import {
	RemoveDuplicatesNodeContent,
	RemoveDuplicatesNodeContentReference,
} from "./remove-duplicates-node";
import {
	RenameKeysNodeContent,
	RenameKeysNodeContentReference,
} from "./rename-keys-node";
import { SortNodeContent, SortNodeContentReference } from "./sort-node";
import {
	SplitOutNodeContent,
	SplitOutNodeContentReference,
} from "./split-out-node";
import {
	SummarizeNodeContent,
	SummarizeNodeContentReference,
} from "./summarize-node";
import {
	SwitchNodeContent,
	SwitchNodeContentReference,
} from "./switch-node";
import {
	TextGenerationContent,
	TextGenerationContentReference,
} from "./text-generation";
import {
	ToolNodeContent,
	ToolNodeContentReference,
} from "./tool-node";
import { TriggerContent, TriggerContentReference } from "./trigger";
import { WaitNodeContent, WaitNodeContentReference } from "./wait-node";
import {
	ExecuteSubWorkflowNodeContent,
	ExecuteSubWorkflowNodeContentReference,
} from "./execute-subworkflow-node";
import {
	RespondToWebhookNodeContent,
	RespondToWebhookNodeContentReference,
} from "./respond-to-webhook-node";
import {
	CustomVariablesNodeContent,
	CustomVariablesNodeContentReference,
} from "./custom-variables-node";

const OperationNodeContent = z.discriminatedUnion("type", [
	TextGenerationContent,
	ImageGenerationContent,
	TriggerContent,
	ActionContent,
	QueryContent,
	DataQueryContent,
	AppEntryContent,
	ContentGenerationContent,
	IntegrationContent,
	EndContent,
	AiAgentContent,
	ChatModelContent,
	ToolNodeContent,
	MemoryNodeContent,
	IfNodeContent,
	SwitchNodeContent,
	MergeNodeContent,
	LoopNodeContent,
	CodeNodeContent,
	FilterNodeContent,
	EditFieldsNodeContent,
	SortNodeContent,
	WaitNodeContent,
	ErrorTriggerNodeContent,
	DataTableNodeContent,
	FormTriggerNodeContent,
	ExecuteSubWorkflowNodeContent,
	RespondToWebhookNodeContent,
	CustomVariablesNodeContent,
	AggregateNodeContent,
	SummarizeNodeContent,
	LimitNodeContent,
	RemoveDuplicatesNodeContent,
	RenameKeysNodeContent,
	SplitOutNodeContent,
	CompareDatasetsNodeContent,
]);

/** Error handling config — used by DAG executor (V5), not on base OperationNode schema */
export const ErrorConfig = z.object({
	retryOnFail: z.boolean().default(false),
	maxRetries: z.number().int().min(0).max(10).default(3),
	retryDelay: z.number().int().min(0).default(1000),
	onError: z.enum(["stopWorkflow", "continueOnFail", "routeToError"]).default("stopWorkflow"),
	timeoutEnabled: z.boolean().default(false),
	timeoutMs: z.number().int().min(1000).max(600000).default(30000),
});
export type ErrorConfig = z.infer<typeof ErrorConfig>;

export const OperationNode = NodeBase.extend({
	type: z.literal("operation"),
	content: OperationNodeContent,
	errorConfig: ErrorConfig.optional(),
	disabled: z.boolean().optional(),
	mockData: z.unknown().optional(),
	pinnedData: z.unknown().optional(),
	alwaysOutputData: z.boolean().optional(),
	executeOnce: z.boolean().optional(),
});
export type OperationNode = z.infer<typeof OperationNode>;

export function isOperationNode(node: NodeBase): node is OperationNode {
	return node.type === "operation";
}

export const OperationNodeLike = NodeBase.extend({
	type: z.literal("operation"),
	content: z.looseObject({
		type: z.union([
			AppEntryType,
			TextGenerationContent.shape.type,
			ImageGenerationContent.shape.type,
			TriggerContent.shape.type,
			ActionContent.shape.type,
			QueryContent.shape.type,
			DataQueryContent.shape.type,
			ContentGenerationContent.shape.type,
			IntegrationContent.shape.type,
			EndContent.shape.type,
			AiAgentContent.shape.type,
			ChatModelContent.shape.type,
			ToolNodeContent.shape.type,
			MemoryNodeContent.shape.type,
			IfNodeContent.shape.type,
			SwitchNodeContent.shape.type,
			MergeNodeContent.shape.type,
			LoopNodeContent.shape.type,
			CodeNodeContent.shape.type,
			FilterNodeContent.shape.type,
			EditFieldsNodeContent.shape.type,
			SortNodeContent.shape.type,
			WaitNodeContent.shape.type,
			ErrorTriggerNodeContent.shape.type,
			DataTableNodeContent.shape.type,
			FormTriggerNodeContent.shape.type,
			ExecuteSubWorkflowNodeContent.shape.type,
			RespondToWebhookNodeContent.shape.type,
			CustomVariablesNodeContent.shape.type,
			AggregateNodeContent.shape.type,
			SummarizeNodeContent.shape.type,
			LimitNodeContent.shape.type,
			RemoveDuplicatesNodeContent.shape.type,
			RenameKeysNodeContent.shape.type,
			SplitOutNodeContent.shape.type,
			CompareDatasetsNodeContent.shape.type,
		]),
	}),
});

export type OperationNodeLike = z.infer<typeof OperationNodeLike>;

export const TextGenerationNode = OperationNode.extend({
	type: z.literal("operation"),
	content: TextGenerationContent,
});
type TextGenerationNode = z.infer<typeof TextGenerationNode>;

export function isTextGenerationNode(
	args?: unknown,
): args is TextGenerationNode {
	const result = TextGenerationNode.safeParse(args);
	return result.success;
}

export const ImageGenerationNode = OperationNode.extend({
	content: ImageGenerationContent,
});
type ImageGenerationNode = z.infer<typeof ImageGenerationNode>;

export function isImageGenerationNode(
	args?: unknown,
): args is ImageGenerationNode {
	const result = ImageGenerationNode.safeParse(args);
	return result.success;
}

export const TriggerNode = OperationNode.extend({
	content: TriggerContent,
});
export type TriggerNode = z.infer<typeof TriggerNode>;

export function isTriggerNode<
	TTriggerProvider extends TriggerProvider = TriggerProvider,
>(
	args?: unknown,
	provider?: TTriggerProvider,
): args is TTriggerProvider extends TriggerProvider
	? TriggerNode & { content: { provider: TTriggerProvider } }
	: TriggerNode {
	const result = TriggerNode.safeParse(args);
	return (
		result.success &&
		(provider === undefined || result.data.content.provider === provider)
	);
}

export const ActionNode = OperationNode.extend({
	content: ActionContent,
});
export type ActionNode = z.infer<typeof ActionNode>;
export function isActionNode<
	TActionProvider extends ActionProvider = ActionProvider,
>(
	args?: unknown,
	provider?: TActionProvider,
): args is TActionProvider extends ActionProvider
	? ActionNode & { content: { command: { provider: TActionProvider } } }
	: ActionNode {
	const result = ActionNode.safeParse(args);
	return (
		result.success &&
		(provider === undefined ||
			result.data.content.command.provider === provider)
	);
}

export const QueryNode = OperationNode.extend({
	content: QueryContent,
});
export type QueryNode = z.infer<typeof QueryNode>;
export function isQueryNode(args?: unknown): args is QueryNode {
	const result = QueryNode.safeParse(args);
	return result.success;
}

export const DataQueryNode = OperationNode.extend({
	content: DataQueryContent,
});
export type DataQueryNode = z.infer<typeof DataQueryNode>;
export function isDataQueryNode(args?: unknown): args is DataQueryNode {
	const result = DataQueryNode.safeParse(args);
	return result.success;
}

export const AppEntryNode = OperationNode.extend({
	content: AppEntryContent,
});
export type AppEntryNode = z.infer<typeof AppEntryNode>;
export function isAppEntryNode(args?: unknown): args is AppEntryNode {
	const result = AppEntryNode.safeParse(args);
	return result.success;
}

export const ContentGenerationNode = OperationNode.extend({
	content: ContentGenerationContent,
});
export type ContentGenerationNode = z.infer<typeof ContentGenerationNode>;
export function isContentGenerationNode(
	args?: unknown,
): args is ContentGenerationNode {
	const result = ContentGenerationNode.safeParse(args);
	return result.success;
}

export const IntegrationNode = OperationNode.extend({
	content: IntegrationContent,
});
export type IntegrationNode = z.infer<typeof IntegrationNode>;
export function isIntegrationNode(args?: unknown): args is IntegrationNode {
	const result = IntegrationNode.safeParse(args);
	return result.success;
}

export const AiAgentNode = OperationNode.extend({
	content: AiAgentContent,
});
export type AiAgentNode = z.infer<typeof AiAgentNode>;
export function isAiAgentNode(args?: unknown): args is AiAgentNode {
	const result = AiAgentNode.safeParse(args);
	return result.success;
}

export const ChatModelNode = OperationNode.extend({
	content: ChatModelContent,
});
export type ChatModelNode = z.infer<typeof ChatModelNode>;
export function isChatModelNode(args?: unknown): args is ChatModelNode {
	const result = ChatModelNode.safeParse(args);
	return result.success;
}

export const ToolNodeNode = OperationNode.extend({
	content: ToolNodeContent,
});
export type ToolNodeNode = z.infer<typeof ToolNodeNode>;
export function isToolNodeNode(args?: unknown): args is ToolNodeNode {
	const result = ToolNodeNode.safeParse(args);
	return result.success;
}

export const MemoryNodeNode = OperationNode.extend({
	content: MemoryNodeContent,
});
export type MemoryNodeNode = z.infer<typeof MemoryNodeNode>;
export function isMemoryNodeNode(args?: unknown): args is MemoryNodeNode {
	const result = MemoryNodeNode.safeParse(args);
	return result.success;
}

export const EndNode = OperationNode.extend({
	content: EndContent,
});
export type EndNode = z.infer<typeof EndNode>;
export function isEndNode(args?: unknown): args is EndNode {
	const result = EndNode.safeParse(args);
	return result.success;
}

export const IfNode = OperationNode.extend({
	content: IfNodeContent,
});
export type IfNode = z.infer<typeof IfNode>;
export function isIfNode(args?: unknown): args is IfNode {
	return IfNode.safeParse(args).success;
}

export const SwitchNode = OperationNode.extend({
	content: SwitchNodeContent,
});
export type SwitchNode = z.infer<typeof SwitchNode>;
export function isSwitchNode(args?: unknown): args is SwitchNode {
	return SwitchNode.safeParse(args).success;
}

export const MergeNode = OperationNode.extend({
	content: MergeNodeContent,
});
export type MergeNode = z.infer<typeof MergeNode>;
export function isMergeNode(args?: unknown): args is MergeNode {
	return MergeNode.safeParse(args).success;
}

export const LoopNode = OperationNode.extend({
	content: LoopNodeContent,
});
export type LoopNode = z.infer<typeof LoopNode>;
export function isLoopNode(args?: unknown): args is LoopNode {
	return LoopNode.safeParse(args).success;
}

export const CodeNode = OperationNode.extend({
	content: CodeNodeContent,
});
export type CodeNode = z.infer<typeof CodeNode>;
export function isCodeNode(args?: unknown): args is CodeNode {
	return CodeNode.safeParse(args).success;
}

export const FilterNode = OperationNode.extend({
	content: FilterNodeContent,
});
export type FilterNode = z.infer<typeof FilterNode>;
export function isFilterNode(args?: unknown): args is FilterNode {
	return FilterNode.safeParse(args).success;
}

export const EditFieldsNode = OperationNode.extend({
	content: EditFieldsNodeContent,
});
export type EditFieldsNode = z.infer<typeof EditFieldsNode>;
export function isEditFieldsNode(args?: unknown): args is EditFieldsNode {
	return EditFieldsNode.safeParse(args).success;
}

export const SortNode = OperationNode.extend({
	content: SortNodeContent,
});
export type SortNode = z.infer<typeof SortNode>;
export function isSortNode(args?: unknown): args is SortNode {
	return SortNode.safeParse(args).success;
}

export const WaitNode = OperationNode.extend({
	content: WaitNodeContent,
});
export type WaitNode = z.infer<typeof WaitNode>;
export function isWaitNode(args?: unknown): args is WaitNode {
	return WaitNode.safeParse(args).success;
}

export const ErrorTriggerNode = OperationNode.extend({
	content: ErrorTriggerNodeContent,
});
export type ErrorTriggerNode = z.infer<typeof ErrorTriggerNode>;
export function isErrorTriggerNode(args?: unknown): args is ErrorTriggerNode {
	return ErrorTriggerNode.safeParse(args).success;
}

export const DataTableNode = OperationNode.extend({
	content: DataTableNodeContent,
});
export type DataTableNode = z.infer<typeof DataTableNode>;
export function isDataTableNode(args?: unknown): args is DataTableNode {
	return DataTableNode.safeParse(args).success;
}

export const FormTriggerNode = OperationNode.extend({
	content: FormTriggerNodeContent,
});
export type FormTriggerNode = z.infer<typeof FormTriggerNode>;
export function isFormTriggerNode(args?: unknown): args is FormTriggerNode {
	return FormTriggerNode.safeParse(args).success;
}

export const ExecuteSubWorkflowNode = OperationNode.extend({
	content: ExecuteSubWorkflowNodeContent,
});
export type ExecuteSubWorkflowNode = z.infer<typeof ExecuteSubWorkflowNode>;
export function isExecuteSubWorkflowNode(
	args?: unknown,
): args is ExecuteSubWorkflowNode {
	return ExecuteSubWorkflowNode.safeParse(args).success;
}

export const RespondToWebhookNode = OperationNode.extend({
	content: RespondToWebhookNodeContent,
});
export type RespondToWebhookNode = z.infer<typeof RespondToWebhookNode>;
export function isRespondToWebhookNode(
	args?: unknown,
): args is RespondToWebhookNode {
	return RespondToWebhookNode.safeParse(args).success;
}

export const CustomVariablesNode = OperationNode.extend({
	content: CustomVariablesNodeContent,
});
export type CustomVariablesNode = z.infer<typeof CustomVariablesNode>;
export function isCustomVariablesNode(
	args?: unknown,
): args is CustomVariablesNode {
	return CustomVariablesNode.safeParse(args).success;
}

export const AggregateNode = OperationNode.extend({
	content: AggregateNodeContent,
});
export type AggregateNode = z.infer<typeof AggregateNode>;
export function isAggregateNode(args?: unknown): args is AggregateNode {
	return AggregateNode.safeParse(args).success;
}

export const SummarizeNode = OperationNode.extend({
	content: SummarizeNodeContent,
});
export type SummarizeNode = z.infer<typeof SummarizeNode>;
export function isSummarizeNode(args?: unknown): args is SummarizeNode {
	return SummarizeNode.safeParse(args).success;
}

export const LimitNode = OperationNode.extend({
	content: LimitNodeContent,
});
export type LimitNode = z.infer<typeof LimitNode>;
export function isLimitNode(args?: unknown): args is LimitNode {
	return LimitNode.safeParse(args).success;
}

export const RemoveDuplicatesNode = OperationNode.extend({
	content: RemoveDuplicatesNodeContent,
});
export type RemoveDuplicatesNode = z.infer<typeof RemoveDuplicatesNode>;
export function isRemoveDuplicatesNode(args?: unknown): args is RemoveDuplicatesNode {
	return RemoveDuplicatesNode.safeParse(args).success;
}

export const RenameKeysNode = OperationNode.extend({
	content: RenameKeysNodeContent,
});
export type RenameKeysNode = z.infer<typeof RenameKeysNode>;
export function isRenameKeysNode(args?: unknown): args is RenameKeysNode {
	return RenameKeysNode.safeParse(args).success;
}

export const SplitOutNode = OperationNode.extend({
	content: SplitOutNodeContent,
});
export type SplitOutNode = z.infer<typeof SplitOutNode>;
export function isSplitOutNode(args?: unknown): args is SplitOutNode {
	return SplitOutNode.safeParse(args).success;
}

export const CompareDatasetsNode = OperationNode.extend({
	content: CompareDatasetsNodeContent,
});
export type CompareDatasetsNode = z.infer<typeof CompareDatasetsNode>;
export function isCompareDatasetsNode(args?: unknown): args is CompareDatasetsNode {
	return CompareDatasetsNode.safeParse(args).success;
}

/** Helper to check if a node type requires DAG execution (flow control + data transform + custom) */
export function isFlowControlNode(args?: unknown): boolean {
	if (
		isIfNode(args) ||
		isSwitchNode(args) ||
		isMergeNode(args) ||
		isLoopNode(args) ||
		isWaitNode(args) ||
		isCodeNode(args) ||
		isFilterNode(args) ||
		isEditFieldsNode(args) ||
		isSortNode(args) ||
		isErrorTriggerNode(args) ||
		isDataTableNode(args) ||
		isExecuteSubWorkflowNode(args) ||
		isRespondToWebhookNode(args) ||
		isCustomVariablesNode(args) ||
		isAggregateNode(args) ||
		isSummarizeNode(args) ||
		isLimitNode(args) ||
		isRemoveDuplicatesNode(args) ||
		isRenameKeysNode(args) ||
		isSplitOutNode(args) ||
		isCompareDatasetsNode(args)
	) {
		return true;
	}
	// Check for custom node content (has customNodeName field)
	if (args && typeof args === "object" && "content" in args) {
		const content = (args as { content: Record<string, unknown> }).content;
		if (content && typeof content === "object" && "customNodeName" in content) {
			return true;
		}
	}
	return false;
}

const OperationNodeContentReference = z.discriminatedUnion("type", [
	AppEntryContentReference,
	TextGenerationContentReference,
	ImageGenerationContentReference,
	TriggerContentReference,
	ActionContentReference,
	QueryContentReference,
	DataQueryContentReference,
	ContentGenerationContentReference,
	IntegrationContentReference,
	EndContentReference,
	AiAgentContentReference,
	ChatModelContentReference,
	ToolNodeContentReference,
	MemoryNodeContentReference,
	IfNodeContentReference,
	SwitchNodeContentReference,
	MergeNodeContentReference,
	LoopNodeContentReference,
	CodeNodeContentReference,
	FilterNodeContentReference,
	EditFieldsNodeContentReference,
	SortNodeContentReference,
	WaitNodeContentReference,
	ErrorTriggerNodeContentReference,
	DataTableNodeContentReference,
	FormTriggerNodeContentReference,
	ExecuteSubWorkflowNodeContentReference,
	RespondToWebhookNodeContentReference,
	CustomVariablesNodeContentReference,
	AggregateNodeContentReference,
	SummarizeNodeContentReference,
	LimitNodeContentReference,
	RemoveDuplicatesNodeContentReference,
	RenameKeysNodeContentReference,
	SplitOutNodeContentReference,
	CompareDatasetsNodeContentReference,
]);
export const OperationNodeReference = NodeReferenceBase.extend({
	type: OperationNode.shape.type,
	content: OperationNodeContentReference,
});
export type OperationNodeReference = z.infer<typeof OperationNodeReference>;
