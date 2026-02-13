import type { ActionProvider } from "@giselles-ai/action-registry";
import {
	Capability,
	hasCapability,
	languageModels,
} from "@giselles-ai/language-model";
import { getEntry } from "@giselles-ai/language-model-registry";
import {
	type ActionNode,
	type AggregateNode,
	type AiAgentNode,
	type AppEntryNode,
	type ChatModelNode,
	type CodeNode,
	type CompareDatasetsNode,
	type CustomVariablesNode,
	type DataTableNode,
	type EditFieldsNode,
	type ErrorTriggerNode,
	type ExecuteSubWorkflowNode,
	type FormTriggerNode,
	type FilterNode,
	type IfNode,
	type LimitNode,
	type LoopNode,
	type MemoryNodeNode,
	type MergeNode,
	type RemoveDuplicatesNode,
	type RenameKeysNode,
	type RespondToWebhookNode,
	type SortNode,
	type SplitOutNode,
	type SummarizeNode,
	type SwitchNode,
	type ToolNodeNode,
	type WaitNode,
	AppParameterId,
	type ContentGenerationNode,
	createPendingCopyFileData,
	type DataQueryNode,
	type DataStoreNode,
	DEFAULT_MAX_RESULTS,
	DEFAULT_SIMILARITY_THRESHOLD,
	type DraftApp,
	type EndNode,
	type FileContent,
	type FileData,
	type FileId,
	type FileNode,
	type GitHubContent,
	type GitHubNode,
	type ImageGenerationContent,
	type ImageGenerationNode,
	type Input,
	InputId,
	type IntegrationContent,
	type IntegrationNode,
	type MemoryNodeContent,
	type ToolNodeContent,
	isActionNode,
	isAggregateNode,
	isAiAgentNode,
	isAppEntryNode,
	isChatModelNode,
	isCodeNode,
	isCompareDatasetsNode,
	isCustomVariablesNode,
	isDataTableNode,
	isEditFieldsNode,
	isErrorTriggerNode,
	isExecuteSubWorkflowNode,
	isFormTriggerNode,
	isFilterNode,
	isIfNode,
	isLimitNode,
	isLoopNode,
	isMemoryNodeNode,
	isMergeNode,
	isRemoveDuplicatesNode,
	isRenameKeysNode,
	isRespondToWebhookNode,
	isSortNode,
	isSplitOutNode,
	isSummarizeNode,
	isSwitchNode,
	isToolNodeNode,
	isWaitNode,
	isContentGenerationNode,
	isDataQueryNode,
	isDataStoreNode,
	isEndNode,
	isFileNode,
	isGitHubNode,
	isImageGenerationNode,
	isIntegrationNode,
	isQueryNode,
	isTextGenerationNode,
	isTextNode,
	isTriggerNode,
	isVectorStoreNode,
	isWebPageNode,
	type Node,
	NodeId,
	type OperationNode,
	type Output,
	OutputId,
	type QueryNode,
	type TextGenerationContent,
	type TextGenerationNode,
	type TextNode,
	type TriggerContent,
	type TriggerNode,
	type VariableNode,
	type VectorStoreContent,
	type VectorStoreNode,
	type WebPageNode,
} from "@giselles-ai/protocol";
import {
	isJsonContent,
	type JSONContent,
} from "@giselles-ai/text-editor-utils";
import {
	actionNodeDefaultName,
	defaultName,
	triggerNodeDefaultName,
	vectorStoreNodeDefaultName,
} from "./node-default-name";

type ClonedFileDataPayload = FileData & {
	originalFileIdForCopy: FileId;
};

export function isClonedFileDataPayload(
	data: FileData,
): data is ClonedFileDataPayload {
	return (
		"originalFileIdForCopy" in data && data.originalFileIdForCopy !== undefined
	);
}

type OperationNodeContentType = OperationNode["content"]["type"];
type VariableNodeContentType = VariableNode["content"]["type"];
export type NodeContentType =
	| OperationNodeContentType
	| VariableNodeContentType;

// --- ID Mapping Types and Helpers ---
interface OutputIdMap {
	[oldId: string]: OutputId;
}
interface InputIdMap {
	[oldId: string]: InputId;
}

interface CloneOutputResult {
	newIo: Output[];
	idMap: OutputIdMap;
}

interface CloneInputResult {
	newIo: Input[];
	idMap: InputIdMap;
}

function cloneAndRenewOutputIdsWithMap(
	originalOutputs: ReadonlyArray<Output>,
): CloneOutputResult {
	const newOutputs: Output[] = [];
	const idMap: OutputIdMap = {};
	for (const o of originalOutputs) {
		const newId = OutputId.generate();
		newOutputs.push({ ...o, id: newId });
		idMap[o.id] = newId;
	}
	return { newIo: newOutputs, idMap };
}

function cloneAndRenewInputIdsWithMap(
	originalInputs: ReadonlyArray<Input>,
): CloneInputResult {
	const newInputs: Input[] = [];
	const idMap: InputIdMap = {};
	for (const i of originalInputs) {
		const newId = InputId.generate();
		newInputs.push({ ...i, id: newId });
		idMap[i.id] = newId;
	}
	return { newIo: newInputs, idMap };
}

function createDefaultDraftApp(): DraftApp {
	return {
		name: "Start",
		description: "",
		iconName: "cable",
		parameters: [
			{
				id: AppParameterId.generate(),
				name: "Input (Text)",
				type: "multiline-text",
				required: true,
			},
			{
				id: AppParameterId.generate(),
				name: "Input (File)",
				type: "files",
				required: false,
			},
		],
	};
}

// --- Node Factory Interface and Result Type ---
export interface NodeFactoryCloneResult<N extends Node> {
	newNode: N;
	inputIdMap: InputIdMap;
	outputIdMap: OutputIdMap;
}

interface NodeFactory<N extends Node, CreateArg = void> {
	create: CreateArg extends void ? () => N : (arg: CreateArg) => N;
	clone(orig: N): NodeFactoryCloneResult<N>;
}

const textGenerationFactoryImpl = {
	create: (llm: TextGenerationContent["llm"]): TextGenerationNode => {
		const outputs: Output[] = [
			{
				id: OutputId.generate(),
				label: "Output",
				accessor: "generated-text",
			},
		];
		const languageModel = languageModels.find(
			(languageModel) => languageModel.id === llm.id,
		);
		if (
			languageModel !== undefined &&
			hasCapability(languageModel, Capability.SearchGrounding)
		) {
			outputs.push({
				id: OutputId.generate(),
				label: "Source",
				accessor: "source",
			});
		}

		return {
			id: NodeId.generate(),
			type: "operation",
			content: {
				type: "textGeneration",
				llm,
			},
			inputs: [],
			outputs,
		} satisfies TextGenerationNode;
	},
	clone: (
		orig: TextGenerationNode,
	): NodeFactoryCloneResult<TextGenerationNode> => {
		const clonedContent = structuredClone(orig.content);
		const { newIo: newInputs, idMap: inputIdMap } =
			cloneAndRenewInputIdsWithMap(orig.inputs);
		const { newIo: newOutputs, idMap: outputIdMap } =
			cloneAndRenewOutputIdsWithMap(orig.outputs);

		if (clonedContent.prompt && isJsonContent(clonedContent.prompt)) {
			try {
				const promptJsonContent: JSONContent =
					typeof clonedContent.prompt === "string"
						? JSON.parse(clonedContent.prompt)
						: clonedContent.prompt;

				function keepSourceRefs(
					content: JSONContent[] | undefined,
				): JSONContent[] | undefined {
					if (!content) return undefined;

					return content
						.map((item) => {
							if (item.content) {
								const newSubContent = keepSourceRefs(item.content);
								if (
									newSubContent &&
									newSubContent.length === 0 &&
									item.type !== "paragraph"
								) {
									return { ...item, content: newSubContent };
								}

								if (!newSubContent && item.content) {
									return null;
								}
							}
							return item;
						})
						.filter(
							(item): item is JSONContent =>
								item !== null &&
								!(item.type === "text" && !item.text?.trim() && !item.marks),
						);
				}

				const processedPromptContent = keepSourceRefs(
					promptJsonContent.content,
				);

				if (processedPromptContent && processedPromptContent.length > 0) {
					promptJsonContent.content = processedPromptContent;
					clonedContent.prompt = JSON.stringify(promptJsonContent);
				} else {
					clonedContent.prompt = "";
				}
			} catch (e) {
				console.error("Error processing prompt for TextGeneration clone:", e);
				clonedContent.prompt = "";
			}
		}

		const newNode = {
			id: NodeId.generate(),
			type: "operation",
			name: `Copy of ${orig.name ?? defaultName(orig)}`,
			content: clonedContent,
			inputs: newInputs,
			outputs: newOutputs,
		} satisfies TextGenerationNode;
		return { newNode, inputIdMap, outputIdMap };
	},
} satisfies NodeFactory<TextGenerationNode, TextGenerationContent["llm"]>;

const imageGenerationFactoryImpl = {
	create: (llm: ImageGenerationContent["llm"]): ImageGenerationNode =>
		({
			id: NodeId.generate(),
			type: "operation",
			content: {
				type: "imageGeneration",
				llm,
			},
			inputs: [],
			outputs: [
				{
					id: OutputId.generate(),
					label: "Output",
					accessor: "generated-image",
				},
			],
		}) satisfies ImageGenerationNode,
	clone: (
		orig: ImageGenerationNode,
	): NodeFactoryCloneResult<ImageGenerationNode> => {
		const { newIo: newInputs, idMap: inputIdMap } =
			cloneAndRenewInputIdsWithMap(orig.inputs);
		const { newIo: newOutputs, idMap: outputIdMap } =
			cloneAndRenewOutputIdsWithMap(orig.outputs);

		const newNode = {
			id: NodeId.generate(),
			type: "operation",
			name: `Copy of ${orig.name ?? defaultName(orig)}`,
			content: structuredClone(orig.content),
			inputs: newInputs,
			outputs: newOutputs,
		} satisfies ImageGenerationNode;
		return { newNode, inputIdMap, outputIdMap };
	},
} satisfies NodeFactory<ImageGenerationNode, ImageGenerationContent["llm"]>;

const triggerFactoryImpl = {
	create: (provider: TriggerContent["provider"]): TriggerNode =>
		({
			id: NodeId.generate(),
			type: "operation",
			name: triggerNodeDefaultName(provider),
			content: {
				type: "trigger",
				provider,
				state: {
					status: "unconfigured",
				},
			},
			inputs: [],
			outputs: [{
				id: OutputId.generate(),
				label: "Output",
				accessor: "trigger-output",
			}],
		}) satisfies TriggerNode,
	clone: (orig: TriggerNode): NodeFactoryCloneResult<TriggerNode> => {
		const clonedContent = structuredClone(orig.content);
		// Reset trigger state to unconfigured - actual configuration duplication
		// is handled at higher level in handleTriggerNodeCopy
		clonedContent.state = { status: "unconfigured" };

		const { newIo: newInputs, idMap: inputIdMap } =
			cloneAndRenewInputIdsWithMap(orig.inputs);
		const { newIo: newOutputs, idMap: outputIdMap } =
			cloneAndRenewOutputIdsWithMap(orig.outputs);

		const newNode = {
			id: NodeId.generate(),
			type: "operation",
			name: `Copy of ${orig.name ?? defaultName(orig)}`,
			content: clonedContent,
			inputs: newInputs,
			outputs: newOutputs,
		} satisfies TriggerNode;
		return { newNode, inputIdMap, outputIdMap };
	},
} satisfies NodeFactory<TriggerNode, TriggerContent["provider"]>;

const actionFactoryImpl = {
	create: (provider: ActionProvider): ActionNode =>
		({
			id: NodeId.generate(),
			type: "operation",
			name: actionNodeDefaultName(provider),
			content: {
				type: "action",
				command: {
					provider,
					state: {
						status: "unconfigured",
					},
				},
			},
			inputs: [],
			outputs: [],
		}) satisfies ActionNode,
	clone: (orig: ActionNode): NodeFactoryCloneResult<ActionNode> => {
		const clonedContent = structuredClone(orig.content);
		// Reset action state to unconfigured - actual configuration duplication
		// is handled at higher level in handleActionNodeCopy
		clonedContent.command.state = { status: "unconfigured" };

		const { newIo: newInputs, idMap: inputIdMap } =
			cloneAndRenewInputIdsWithMap(orig.inputs);
		const { newIo: newOutputs, idMap: outputIdMap } =
			cloneAndRenewOutputIdsWithMap(orig.outputs);

		const newNode = {
			id: NodeId.generate(),
			type: "operation",
			name: `Copy of ${orig.name ?? defaultName(orig)}`,
			content: clonedContent,
			inputs: newInputs,
			outputs: newOutputs,
		} satisfies ActionNode;
		return { newNode, inputIdMap, outputIdMap };
	},
} satisfies NodeFactory<ActionNode, ActionProvider>;

const queryFactoryImpl = {
	create: (): QueryNode => {
		return {
			id: NodeId.generate(),
			type: "operation",
			content: {
				type: "query",
				query: "",
				maxResults: DEFAULT_MAX_RESULTS,
				similarityThreshold: DEFAULT_SIMILARITY_THRESHOLD,
			},
			inputs: [],
			outputs: [
				{
					id: OutputId.generate(),
					label: "Output",
					accessor: "result",
				},
			],
		} satisfies QueryNode;
	},
	clone: (orig: QueryNode): NodeFactoryCloneResult<QueryNode> => {
		const { newIo: newInputs, idMap: inputIdMap } =
			cloneAndRenewInputIdsWithMap(orig.inputs);
		const { newIo: newOutputs, idMap: outputIdMap } =
			cloneAndRenewOutputIdsWithMap(orig.outputs);

		const newNode = {
			id: NodeId.generate(),
			type: "operation",
			name: `Copy of ${orig.name ?? defaultName(orig)}`,
			content: structuredClone(orig.content),
			inputs: newInputs,
			outputs: newOutputs,
		} satisfies QueryNode;
		return { newNode, inputIdMap, outputIdMap };
	},
} satisfies NodeFactory<QueryNode>;

const endFactoryImpl = {
	create: (): EndNode => ({
		id: NodeId.generate(),
		type: "operation",
		content: {
			type: "end",
		},
		inputs: [],
		outputs: [],
	}),
	clone: (orig: EndNode): NodeFactoryCloneResult<EndNode> => {
		const { newIo: newInputs, idMap: inputIdMap } =
			cloneAndRenewInputIdsWithMap(orig.inputs);
		const { newIo: newOutputs, idMap: outputIdMap } =
			cloneAndRenewOutputIdsWithMap(orig.outputs);

		const newNode = {
			id: NodeId.generate(),
			type: "operation",
			name: `Copy of ${orig.name ?? defaultName(orig)}`,
			content: structuredClone(orig.content),
			inputs: newInputs,
			outputs: newOutputs,
		} satisfies EndNode;
		return { newNode, inputIdMap, outputIdMap };
	},
} satisfies NodeFactory<EndNode>;

interface IntegrationCreateInput {
	pieceName: string;
	actionName: string;
	pieceVersion: string;
}

const integrationFactoryImpl = {
	create: (input: IntegrationCreateInput): IntegrationNode =>
		({
			id: NodeId.generate(),
			type: "operation",
			name: `${input.pieceName}: ${input.actionName}`,
			content: {
				type: "integration",
				pieceName: input.pieceName,
				actionName: input.actionName,
				pieceVersion: input.pieceVersion,
				configuration: {},
			},
			inputs: [
				{
					id: InputId.generate(),
					label: "Input",
					accessor: "input",
				},
			],
			outputs: [
				{
					id: OutputId.generate(),
					label: "Result",
					accessor: "action-result",
				},
			],
		}) satisfies IntegrationNode,
	clone: (orig: IntegrationNode): NodeFactoryCloneResult<IntegrationNode> => {
		const { newIo: newInputs, idMap: inputIdMap } =
			cloneAndRenewInputIdsWithMap(orig.inputs);
		const { newIo: newOutputs, idMap: outputIdMap } =
			cloneAndRenewOutputIdsWithMap(orig.outputs);

		const newNode = {
			id: NodeId.generate(),
			type: "operation",
			name: `Copy of ${orig.name ?? defaultName(orig)}`,
			content: structuredClone(orig.content),
			inputs: newInputs,
			outputs: newOutputs,
		} satisfies IntegrationNode;
		return { newNode, inputIdMap, outputIdMap };
	},
} satisfies NodeFactory<IntegrationNode, IntegrationCreateInput>;

const textVariableFactoryImpl = {
	create: (): TextNode =>
		({
			id: NodeId.generate(),
			type: "variable",
			content: {
				type: "text",
				text: "",
			},
			inputs: [],
			outputs: [
				{
					id: OutputId.generate(),
					label: "Output",
					accessor: "text",
				},
			],
		}) satisfies TextNode,
	clone: (orig: TextNode): NodeFactoryCloneResult<TextNode> => {
		const { newIo: newInputs, idMap: inputIdMap } =
			cloneAndRenewInputIdsWithMap(orig.inputs);
		const { newIo: newOutputs, idMap: outputIdMap } =
			cloneAndRenewOutputIdsWithMap(orig.outputs);

		const newNode = {
			id: NodeId.generate(),
			type: "variable",
			name: `Copy of ${orig.name ?? defaultName(orig)}`,
			content: structuredClone(orig.content),
			inputs: newInputs,
			outputs: newOutputs,
		} satisfies TextNode;
		return { newNode, inputIdMap, outputIdMap };
	},
} satisfies NodeFactory<TextNode>;

const fileVariableFactoryImpl = {
	create: (category: FileContent["category"]): FileNode =>
		({
			id: NodeId.generate(),
			type: "variable",
			content: {
				type: "file",
				category,
				files: [],
			},
			inputs: [],
			outputs: [
				{
					id: OutputId.generate(),
					label: "Output",
					accessor: "text",
				},
			],
		}) satisfies FileNode,
	clone: (orig: FileNode): NodeFactoryCloneResult<FileNode> => {
		const clonedContent = structuredClone(orig.content);
		clonedContent.files = orig.content.files.map((fileData) => {
			// Handle transitive cloning: if already cloned, preserve the original file ID
			const actualOriginalFileId = isClonedFileDataPayload(fileData)
				? fileData.originalFileIdForCopy
				: fileData.id;
			return createPendingCopyFileData({
				name: fileData.name,
				type: fileData.type,
				size: fileData.size,
				originalFileIdForCopy: actualOriginalFileId,
			});
		});

		const { newIo: newInputs, idMap: inputIdMap } =
			cloneAndRenewInputIdsWithMap(orig.inputs);
		const { newIo: newOutputs, idMap: outputIdMap } =
			cloneAndRenewOutputIdsWithMap(orig.outputs);

		const newNode = {
			id: NodeId.generate(),
			type: "variable",
			name: `Copy of ${orig.name ?? defaultName(orig)}`,
			content: clonedContent,
			inputs: newInputs,
			outputs: newOutputs,
		} satisfies FileNode;
		return { newNode, inputIdMap, outputIdMap };
	},
} satisfies NodeFactory<FileNode, FileContent["category"]>;

const githubVariableFactoryImpl = {
	create: (
		objectReferences: GitHubContent["objectReferences"] = [],
	): GitHubNode =>
		({
			id: NodeId.generate(),
			type: "variable",
			content: { type: "github", objectReferences },
			inputs: [],
			outputs: [{ id: OutputId.generate(), label: "Output", accessor: "text" }],
		}) satisfies GitHubNode,
	clone: (orig: GitHubNode): NodeFactoryCloneResult<GitHubNode> => {
		const { newIo: newInputs, idMap: inputIdMap } =
			cloneAndRenewInputIdsWithMap(orig.inputs);
		const { newIo: newOutputs, idMap: outputIdMap } =
			cloneAndRenewOutputIdsWithMap(orig.outputs);

		const newNode = {
			id: NodeId.generate(),
			type: "variable",
			name: `Copy of ${orig.name ?? defaultName(orig)}`,
			content: structuredClone(orig.content),
			inputs: newInputs,
			outputs: newOutputs,
		} satisfies GitHubNode;
		return { newNode, inputIdMap, outputIdMap };
	},
} satisfies NodeFactory<GitHubNode, GitHubContent["objectReferences"]>;

const vectorStoreFactoryImpl = {
	create: (
		provider: VectorStoreContent["source"]["provider"],
	): VectorStoreNode => ({
		id: NodeId.generate(),
		type: "variable",
		name: vectorStoreNodeDefaultName(provider),
		content: {
			type: "vectorStore",
			source: {
				provider: provider,
				state: {
					status: "unconfigured",
				},
			},
		},
		inputs: [],
		outputs: [
			{
				id: OutputId.generate(),
				label: "Output",
				accessor: "source",
			},
		],
	}),
	clone: (orig: VectorStoreNode): NodeFactoryCloneResult<VectorStoreNode> => {
		const clonedContent = structuredClone(orig.content);
		// Reset vector store state to unconfigured - actual configuration duplication
		// is handled at higher level in handleVectorStoreNodeCopy
		clonedContent.source.state = { status: "unconfigured" };

		const { newIo: newInputs, idMap: inputIdMap } =
			cloneAndRenewInputIdsWithMap(orig.inputs);
		const { newIo: newOutputs, idMap: outputIdMap } =
			cloneAndRenewOutputIdsWithMap(orig.outputs);

		const newNode = {
			id: NodeId.generate(),
			type: "variable",
			name: `Copy of ${orig.name ?? defaultName(orig)}`,
			content: clonedContent,
			inputs: newInputs,
			outputs: newOutputs,
		} satisfies VectorStoreNode;
		return { newNode, inputIdMap, outputIdMap };
	},
} satisfies NodeFactory<
	VectorStoreNode,
	VectorStoreContent["source"]["provider"]
>;

const dataStoreFactoryImpl = {
	create: (): DataStoreNode => ({
		id: NodeId.generate(),
		type: "variable",
		name: "Data Store",
		content: {
			type: "dataStore",
			state: {
				status: "unconfigured",
			},
		},
		inputs: [],
		outputs: [
			{
				id: OutputId.generate(),
				label: "Schema",
				accessor: "schema",
			},
			{
				id: OutputId.generate(),
				label: "Source",
				accessor: "source",
			},
		],
	}),
	clone: (orig: DataStoreNode): NodeFactoryCloneResult<DataStoreNode> => {
		const clonedContent = structuredClone(orig.content);
		// Reset data store state to unconfigured
		clonedContent.state = { status: "unconfigured" };

		const { newIo: newInputs, idMap: inputIdMap } =
			cloneAndRenewInputIdsWithMap(orig.inputs);
		const { newIo: newOutputs, idMap: outputIdMap } =
			cloneAndRenewOutputIdsWithMap(orig.outputs);

		const newNode = {
			id: NodeId.generate(),
			type: "variable",
			name: `Copy of ${orig.name ?? defaultName(orig)}`,
			content: clonedContent,
			inputs: newInputs,
			outputs: newOutputs,
		} satisfies DataStoreNode;
		return { newNode, inputIdMap, outputIdMap };
	},
} satisfies NodeFactory<DataStoreNode>;

const dataQueryFactoryImpl = {
	create: (): DataQueryNode => {
		return {
			id: NodeId.generate(),
			type: "operation",
			content: {
				type: "dataQuery",
				query: "",
			},
			inputs: [],
			outputs: [
				{
					id: OutputId.generate(),
					label: "Output",
					accessor: "result",
				},
			],
		} satisfies DataQueryNode;
	},
	clone: (orig: DataQueryNode): NodeFactoryCloneResult<DataQueryNode> => {
		const { newIo: newInputs, idMap: inputIdMap } =
			cloneAndRenewInputIdsWithMap(orig.inputs);
		const { newIo: newOutputs, idMap: outputIdMap } =
			cloneAndRenewOutputIdsWithMap(orig.outputs);

		const newNode = {
			id: NodeId.generate(),
			type: "operation",
			name: `Copy of ${orig.name ?? defaultName(orig)}`,
			content: structuredClone(orig.content),
			inputs: newInputs,
			outputs: newOutputs,
		} satisfies DataQueryNode;
		return { newNode, inputIdMap, outputIdMap };
	},
} satisfies NodeFactory<DataQueryNode>;

const webPageFactoryImpl = {
	create: (): WebPageNode => ({
		id: NodeId.generate(),
		type: "variable",
		content: {
			type: "webPage",
			webpages: [],
		},
		inputs: [],
		outputs: [
			{
				id: OutputId.generate(),
				label: "Output",
				accessor: "web-page",
			},
		],
	}),
	clone: (orig: WebPageNode): NodeFactoryCloneResult<WebPageNode> => {
		const { newIo: newInputs, idMap: inputIdMap } =
			cloneAndRenewInputIdsWithMap(orig.inputs);
		const { newIo: newOutputs, idMap: outputIdMap } =
			cloneAndRenewOutputIdsWithMap(orig.outputs);

		const newNode = {
			id: NodeId.generate(),
			type: "variable",
			name: `Copy of ${orig.name ?? defaultName(orig)}`,
			content: structuredClone(orig.content),
			inputs: newInputs,
			outputs: newOutputs,
		} satisfies WebPageNode;
		return { newNode, inputIdMap, outputIdMap };
	},
} satisfies NodeFactory<WebPageNode>;

const appEntryFactoryImpl = {
	create: (): AppEntryNode => {
		const draftApp = createDefaultDraftApp();
		return {
			name: draftApp.name,
			id: NodeId.generate(),
			type: "operation",
			content: {
				type: "appEntry",
				status: "unconfigured",
				draftApp,
			},
			inputs: [],
			outputs: draftApp.parameters.map((parameter) => ({
				id: OutputId.generate(),
				label: parameter.name,
				accessor: parameter.id,
			})),
		} satisfies AppEntryNode;
	},
	clone: (orig: AppEntryNode): NodeFactoryCloneResult<AppEntryNode> => {
		const { newIo: newInputs, idMap: inputIdMap } =
			cloneAndRenewInputIdsWithMap(orig.inputs);
		const { newIo: newOutputs, idMap: outputIdMap } =
			cloneAndRenewOutputIdsWithMap(orig.outputs);
		const clonedContent = structuredClone(orig.content);
		const nextContent: AppEntryNode["content"] =
			clonedContent.status === "configured"
				? {
						type: "appEntry",
						status: "unconfigured",
						draftApp: createDefaultDraftApp(),
					}
				: {
						...clonedContent,
						draftApp: {
							...clonedContent.draftApp,
							parameters: clonedContent.draftApp.parameters.map(
								(parameter) => ({
									...parameter,
									id: AppParameterId.generate(),
								}),
							),
						},
					};

		const newNode = {
			id: NodeId.generate(),
			type: "operation",
			name: `Copy of ${orig.name ?? defaultName(orig)}`,
			content: nextContent,
			inputs: newInputs,
			outputs: newOutputs,
		} satisfies AppEntryNode;
		return { newNode, inputIdMap, outputIdMap };
	},
} satisfies NodeFactory<AppEntryNode>;

type CreateContentGenerationNodeInput = Pick<
	ContentGenerationNode["content"]["languageModel"],
	"id"
> &
	Partial<ContentGenerationNode["content"]["languageModel"]>;

const contentGenerationFactoryImpl = {
	create: (input) => {
		const outputs: Output[] = [
			{
				id: OutputId.generate(),
				label: "Output",
				accessor: "generated-text",
			},
		];
		const languageModel = getEntry(input.id);
		return {
			id: NodeId.generate(),
			type: "operation",
			content: {
				type: "contentGeneration",
				version: "v1",
				prompt: "",
				languageModel: {
					provider: languageModel.providerId,
					id: languageModel.id,
					configuration: languageModel.defaultConfiguration,
				},
				tools: [],
			},
			inputs: [],
			outputs,
		} satisfies ContentGenerationNode;
	},
	clone: (
		orig: ContentGenerationNode,
	): NodeFactoryCloneResult<ContentGenerationNode> => {
		const clonedContent = structuredClone(orig.content);
		const { newIo: newInputs, idMap: inputIdMap } =
			cloneAndRenewInputIdsWithMap(orig.inputs);
		const { newIo: newOutputs, idMap: outputIdMap } =
			cloneAndRenewOutputIdsWithMap(orig.outputs);

		if (clonedContent.prompt && isJsonContent(clonedContent.prompt)) {
			try {
				const promptJsonContent: JSONContent =
					typeof clonedContent.prompt === "string"
						? JSON.parse(clonedContent.prompt)
						: clonedContent.prompt;

				function keepSourceRefs(
					content: JSONContent[] | undefined,
				): JSONContent[] | undefined {
					if (!content) return undefined;

					return content
						.map((item) => {
							if (item.content) {
								const newSubContent = keepSourceRefs(item.content);
								if (
									newSubContent &&
									newSubContent.length === 0 &&
									item.type !== "paragraph"
								) {
									return { ...item, content: newSubContent };
								}

								if (!newSubContent && item.content) {
									return null;
								}
							}
							return item;
						})
						.filter(
							(item): item is JSONContent =>
								item !== null &&
								!(item.type === "text" && !item.text?.trim() && !item.marks),
						);
				}

				const processedPromptContent = keepSourceRefs(
					promptJsonContent.content,
				);

				if (processedPromptContent && processedPromptContent.length > 0) {
					promptJsonContent.content = processedPromptContent;
					clonedContent.prompt = JSON.stringify(promptJsonContent);
				} else {
					clonedContent.prompt = "";
				}
			} catch (e) {
				console.error("Error processing prompt for TextGeneration clone:", e);
				clonedContent.prompt = "";
			}
		}

		const newNode = {
			id: NodeId.generate(),
			type: "operation",
			name: `Copy of ${orig.name ?? defaultName(orig)}`,
			content: clonedContent,
			inputs: newInputs,
			outputs: newOutputs,
		} satisfies ContentGenerationNode;
		return { newNode, inputIdMap, outputIdMap };
	},
} satisfies NodeFactory<
	ContentGenerationNode,
	CreateContentGenerationNodeInput
>;

type CreateAiAgentNodeInput = Pick<
	AiAgentNode["content"]["languageModel"],
	"id"
> &
	Partial<AiAgentNode["content"]["languageModel"]>;

const aiAgentFactoryImpl = {
	create: (input: CreateAiAgentNodeInput): AiAgentNode => {
		const languageModel = getEntry(input.id);
		return {
			id: NodeId.generate(),
			type: "operation",
			content: {
				type: "aiAgent",
				version: "v1",
				agentType: "tools",
				systemPrompt: "",
				prompt: "",
				maxSteps: 30,
				structuredOutput: { enabled: false, schema: "" },
				fallbackModel: { enabled: false, configuration: {} },
				outputParser: { type: "none", retryAttempts: 3 },
				guardrails: { enabled: false, inputRules: [], outputRules: [] },
				languageModel: {
					provider: languageModel.providerId,
					id: languageModel.id,
					configuration: languageModel.defaultConfiguration,
				},
				tools: [],
			},
			inputs: [],
			outputs: [
				{
					id: OutputId.generate(),
					label: "Output",
					accessor: "generated-text",
				},
			],
		} satisfies AiAgentNode;
	},
	clone: (orig: AiAgentNode): NodeFactoryCloneResult<AiAgentNode> => {
		const clonedContent = structuredClone(orig.content);
		const { newIo: newInputs, idMap: inputIdMap } =
			cloneAndRenewInputIdsWithMap(orig.inputs);
		const { newIo: newOutputs, idMap: outputIdMap } =
			cloneAndRenewOutputIdsWithMap(orig.outputs);

		if (clonedContent.prompt && isJsonContent(clonedContent.prompt)) {
			try {
				const promptJsonContent: JSONContent =
					typeof clonedContent.prompt === "string"
						? JSON.parse(clonedContent.prompt)
						: clonedContent.prompt;

				function keepSourceRefs(
					content: JSONContent[] | undefined,
				): JSONContent[] | undefined {
					if (!content) return undefined;

					return content
						.map((item) => {
							if (item.content) {
								const newSubContent = keepSourceRefs(item.content);
								if (
									newSubContent &&
									newSubContent.length === 0 &&
									item.type !== "paragraph"
								) {
									return { ...item, content: newSubContent };
								}

								if (!newSubContent && item.content) {
									return null;
								}
							}
							return item;
						})
						.filter(
							(item): item is JSONContent =>
								item !== null &&
								!(item.type === "text" && !item.text?.trim() && !item.marks),
						);
				}

				const processedPromptContent = keepSourceRefs(
					promptJsonContent.content,
				);

				if (processedPromptContent && processedPromptContent.length > 0) {
					promptJsonContent.content = processedPromptContent;
					clonedContent.prompt = JSON.stringify(promptJsonContent);
				} else {
					clonedContent.prompt = "";
				}
			} catch (e) {
				console.error("Error processing prompt for AiAgent clone:", e);
				clonedContent.prompt = "";
			}
		}

		const newNode = {
			id: NodeId.generate(),
			type: "operation",
			name: `Copy of ${orig.name ?? defaultName(orig)}`,
			content: clonedContent,
			inputs: newInputs,
			outputs: newOutputs,
		} satisfies AiAgentNode;
		return { newNode, inputIdMap, outputIdMap };
	},
} satisfies NodeFactory<AiAgentNode, CreateAiAgentNodeInput>;

type CreateChatModelNodeInput = Pick<
	ChatModelNode["content"]["languageModel"],
	"id"
> &
	Partial<ChatModelNode["content"]["languageModel"]>;

const chatModelFactoryImpl = {
	create: (input: CreateChatModelNodeInput): ChatModelNode => {
		const languageModel = getEntry(input.id);
		return {
			id: NodeId.generate(),
			type: "operation",
			content: {
				type: "chatModel",
				languageModel: {
					provider: languageModel.providerId,
					id: languageModel.id,
					configuration: languageModel.defaultConfiguration,
				},
			},
			inputs: [],
			outputs: [
				{
					id: OutputId.generate(),
					label: "Model",
					accessor: "model",
				},
			],
		} satisfies ChatModelNode;
	},
	clone: (orig: ChatModelNode): NodeFactoryCloneResult<ChatModelNode> => {
		const clonedContent = structuredClone(orig.content);
		const { newIo: newInputs, idMap: inputIdMap } =
			cloneAndRenewInputIdsWithMap(orig.inputs);
		const { newIo: newOutputs, idMap: outputIdMap } =
			cloneAndRenewOutputIdsWithMap(orig.outputs);

		const newNode = {
			id: NodeId.generate(),
			type: "operation",
			name: `Copy of ${orig.name ?? defaultName(orig)}`,
			content: clonedContent,
			inputs: newInputs,
			outputs: newOutputs,
		} satisfies ChatModelNode;
		return { newNode, inputIdMap, outputIdMap };
	},
} satisfies NodeFactory<ChatModelNode, CreateChatModelNodeInput>;

interface ToolNodeCreateInput {
	toolType: ToolNodeContent["toolType"];
	pieceName?: string;
	actionName?: string;
	pieceVersion?: string;
	builtinToolName?: string;
}

const toolNodeFactoryImpl = {
	create: (input: ToolNodeCreateInput): ToolNodeNode => {
		const name =
			input.toolType === "integration" && input.pieceName && input.actionName
				? `${input.pieceName}: ${input.actionName}`
				: input.toolType === "builtinTool" && input.builtinToolName
					? input.builtinToolName
					: "Tool";
		return {
			id: NodeId.generate(),
			type: "operation",
			name,
			content: {
				type: "toolNode",
				toolType: input.toolType,
				pieceName: input.pieceName,
				actionName: input.actionName,
				pieceVersion: input.pieceVersion,
				builtinToolName: input.builtinToolName as any,
				configuration: {},
			},
			inputs: [],
			outputs: [
				{
					id: OutputId.generate(),
					label: "Tool",
					accessor: "tool",
				},
			],
		} satisfies ToolNodeNode;
	},
	clone: (orig: ToolNodeNode): NodeFactoryCloneResult<ToolNodeNode> => {
		const clonedContent = structuredClone(orig.content);
		const { newIo: newInputs, idMap: inputIdMap } =
			cloneAndRenewInputIdsWithMap(orig.inputs);
		const { newIo: newOutputs, idMap: outputIdMap } =
			cloneAndRenewOutputIdsWithMap(orig.outputs);

		const newNode = {
			id: NodeId.generate(),
			type: "operation",
			name: `Copy of ${orig.name ?? defaultName(orig)}`,
			content: clonedContent,
			inputs: newInputs,
			outputs: newOutputs,
		} satisfies ToolNodeNode;
		return { newNode, inputIdMap, outputIdMap };
	},
} satisfies NodeFactory<ToolNodeNode, ToolNodeCreateInput>;

interface MemoryNodeCreateInput {
	memoryType: MemoryNodeContent["memoryType"];
	contextWindowLength?: number;
	sessionScope?: MemoryNodeContent["sessionScope"];
}

const memoryNodeFactoryImpl = {
	create: (input: MemoryNodeCreateInput): MemoryNodeNode => {
		const memoryNames: Record<string, string> = {
			simpleMemory: "Simple Memory",
			windowBuffer: "Window Buffer Memory",
			tokenBuffer: "Token Buffer Memory",
			summary: "Summary Memory",
		};
		return {
			id: NodeId.generate(),
			type: "operation",
			name: memoryNames[input.memoryType] ?? "Memory",
			content: {
				type: "memoryNode",
				memoryType: input.memoryType,
				contextWindowLength: input.contextWindowLength ?? 10,
				sessionScope: input.sessionScope ?? "agent",
			},
			inputs: [],
			outputs: [
				{
					id: OutputId.generate(),
					label: "Memory",
					accessor: "memory",
				},
			],
		} satisfies MemoryNodeNode;
	},
	clone: (orig: MemoryNodeNode): NodeFactoryCloneResult<MemoryNodeNode> => {
		const clonedContent = structuredClone(orig.content);
		const { newIo: newInputs, idMap: inputIdMap } =
			cloneAndRenewInputIdsWithMap(orig.inputs);
		const { newIo: newOutputs, idMap: outputIdMap } =
			cloneAndRenewOutputIdsWithMap(orig.outputs);

		const newNode = {
			id: NodeId.generate(),
			type: "operation",
			name: `Copy of ${orig.name ?? defaultName(orig)}`,
			content: clonedContent,
			inputs: newInputs,
			outputs: newOutputs,
		} satisfies MemoryNodeNode;
		return { newNode, inputIdMap, outputIdMap };
	},
} satisfies NodeFactory<MemoryNodeNode, MemoryNodeCreateInput>;

// --- Flow Control & Data Transform Node Factories ---

function createSimpleOperationFactory<N extends OperationNode>(
	contentType: string,
	defaultInputs: Input[],
	defaultOutputs: Output[],
	defaultContent: Record<string, unknown>,
) {
	return {
		create: (): N =>
			({
				id: NodeId.generate(),
				type: "operation",
				content: { type: contentType, ...defaultContent },
				inputs: defaultInputs.map((inp) => ({ ...inp, id: InputId.generate() })),
				outputs: defaultOutputs.map((out) => ({
					...out,
					id: OutputId.generate(),
				})),
			}) as unknown as N,
		clone: (orig: N): NodeFactoryCloneResult<N> => {
			const { newIo: newInputs, idMap: inputIdMap } =
				cloneAndRenewInputIdsWithMap(orig.inputs);
			const { newIo: newOutputs, idMap: outputIdMap } =
				cloneAndRenewOutputIdsWithMap(orig.outputs);
			const newNode = {
				id: NodeId.generate(),
				type: "operation",
				name: `Copy of ${orig.name ?? defaultName(orig)}`,
				content: structuredClone(orig.content),
				inputs: newInputs,
				outputs: newOutputs,
			} satisfies OperationNode as unknown as N;
			return { newNode, inputIdMap, outputIdMap };
		},
	} satisfies NodeFactory<N>;
}

const ifFactoryImpl = createSimpleOperationFactory<IfNode>(
	"if",
	[{ id: InputId.generate(), label: "Input", accessor: "input" }],
	[
		{ id: OutputId.generate(), label: "True", accessor: "true" },
		{ id: OutputId.generate(), label: "False", accessor: "false" },
	],
	{ conditionGroup: { conditions: [], combineWith: "and" } },
);

const switchFactoryImpl = createSimpleOperationFactory<SwitchNode>(
	"switch",
	[{ id: InputId.generate(), label: "Input", accessor: "input" }],
	[{ id: OutputId.generate(), label: "Fallback", accessor: "fallback" }],
	{ mode: "rules", rules: [], hasFallback: true },
);

const mergeFactoryImpl = createSimpleOperationFactory<MergeNode>(
	"merge",
	[
		{ id: InputId.generate(), label: "Input 1", accessor: "input1" },
		{ id: InputId.generate(), label: "Input 2", accessor: "input2" },
	],
	[{ id: OutputId.generate(), label: "Output", accessor: "output" }],
	{ mode: "chooseBranch" },
);

const loopFactoryImpl = createSimpleOperationFactory<LoopNode>(
	"loop",
	[{ id: InputId.generate(), label: "Items", accessor: "items" }],
	[
		{ id: OutputId.generate(), label: "Item", accessor: "item" },
		{ id: OutputId.generate(), label: "Output", accessor: "output" },
	],
	{ mode: "forEach", maxIterations: 100 },
);

const codeFactoryImpl = createSimpleOperationFactory<CodeNode>(
	"code",
	[{ id: InputId.generate(), label: "Input", accessor: "input" }],
	[{ id: OutputId.generate(), label: "Output", accessor: "output" }],
	{ code: "// Process items and return result\nreturn items;", language: "javascript", timeout: 10000 },
);

const filterFactoryImpl = createSimpleOperationFactory<FilterNode>(
	"filter",
	[{ id: InputId.generate(), label: "Input", accessor: "input" }],
	[
		{ id: OutputId.generate(), label: "Kept", accessor: "kept" },
		{ id: OutputId.generate(), label: "Discarded", accessor: "discarded" },
	],
	{ conditionGroup: { conditions: [], combineWith: "and" } },
);

const editFieldsFactoryImpl = createSimpleOperationFactory<EditFieldsNode>(
	"editFields",
	[{ id: InputId.generate(), label: "Input", accessor: "input" }],
	[{ id: OutputId.generate(), label: "Output", accessor: "output" }],
	{ operations: [], keepOnlySet: false },
);

const sortFactoryImpl = createSimpleOperationFactory<SortNode>(
	"sort",
	[{ id: InputId.generate(), label: "Input", accessor: "input" }],
	[{ id: OutputId.generate(), label: "Output", accessor: "output" }],
	{ sortKeys: [] },
);

const waitFactoryImpl = createSimpleOperationFactory<WaitNode>(
	"wait",
	[{ id: InputId.generate(), label: "Input", accessor: "input" }],
	[{ id: OutputId.generate(), label: "Output", accessor: "output" }],
	{ mode: "fixedTime", delaySeconds: 0, timeoutSeconds: 86400 },
);

const errorTriggerFactoryImpl = createSimpleOperationFactory<ErrorTriggerNode>(
	"errorTrigger",
	[],
	[
		{ id: OutputId.generate(), label: "Error Message", accessor: "errorMessage" },
		{ id: OutputId.generate(), label: "Failed Node", accessor: "failedNodeId" },
		{ id: OutputId.generate(), label: "Output", accessor: "output" },
	],
	{},
);

const dataTableFactoryImpl = createSimpleOperationFactory<DataTableNode>(
	"dataTable",
	[{ id: InputId.generate(), label: "Input", accessor: "input" }],
	[{ id: OutputId.generate(), label: "Data", accessor: "data" }],
	{ tableId: "", tableName: "", operation: "query", fields: [], limit: 100 },
);

const formTriggerFactoryImpl = createSimpleOperationFactory<FormTriggerNode>(
	"formTrigger",
	[],
	[{ id: OutputId.generate(), label: "Form Data", accessor: "formData" }],
	{ fields: [], submitButtonText: "Submit", successMessage: "Form submitted successfully!", title: "", description: "" },
);

const executeSubWorkflowFactoryImpl = createSimpleOperationFactory<ExecuteSubWorkflowNode>(
	"executeSubWorkflow",
	[{ id: InputId.generate(), label: "Input", accessor: "input" }],
	[
		{ id: OutputId.generate(), label: "Output", accessor: "output" },
		{ id: OutputId.generate(), label: "Status", accessor: "status" },
	],
	{ targetWorkspaceId: "", inputMapping: {}, outputMapping: {}, timeout: 300000, waitForCompletion: true },
);

const respondToWebhookFactoryImpl = createSimpleOperationFactory<RespondToWebhookNode>(
	"respondToWebhook",
	[{ id: InputId.generate(), label: "Input", accessor: "input" }],
	[],
	{ statusCode: 200, headers: {}, responseBody: "", contentType: "application/json" },
);

const customVariablesFactoryImpl = createSimpleOperationFactory<CustomVariablesNode>(
	"customVariables",
	[],
	[{ id: OutputId.generate(), label: "Variables", accessor: "variables" }],
	{ variableKeys: [], prefix: "vars" },
);

const aggregateFactoryImpl = createSimpleOperationFactory<AggregateNode>(
	"aggregate",
	[{ id: InputId.generate(), label: "Input", accessor: "input" }],
	[{ id: OutputId.generate(), label: "Output", accessor: "output" }],
	{ operations: [], groupBy: [] },
);

const summarizeFactoryImpl = createSimpleOperationFactory<SummarizeNode>(
	"summarize",
	[{ id: InputId.generate(), label: "Input", accessor: "input" }],
	[{ id: OutputId.generate(), label: "Output", accessor: "output" }],
	{ fields: [], operations: ["count", "sum", "avg", "min", "max"] },
);

const limitFactoryImpl = createSimpleOperationFactory<LimitNode>(
	"limit",
	[{ id: InputId.generate(), label: "Input", accessor: "input" }],
	[{ id: OutputId.generate(), label: "Output", accessor: "output" }],
	{ maxItems: 10, keep: "first" },
);

const removeDuplicatesFactoryImpl = createSimpleOperationFactory<RemoveDuplicatesNode>(
	"removeDuplicates",
	[{ id: InputId.generate(), label: "Input", accessor: "input" }],
	[{ id: OutputId.generate(), label: "Output", accessor: "output" }],
	{ fields: [], keepFirst: true },
);

const renameKeysFactoryImpl = createSimpleOperationFactory<RenameKeysNode>(
	"renameKeys",
	[{ id: InputId.generate(), label: "Input", accessor: "input" }],
	[{ id: OutputId.generate(), label: "Output", accessor: "output" }],
	{ mappings: [] },
);

const splitOutFactoryImpl = createSimpleOperationFactory<SplitOutNode>(
	"splitOut",
	[{ id: InputId.generate(), label: "Input", accessor: "input" }],
	[{ id: OutputId.generate(), label: "Output", accessor: "output" }],
	{ fieldToSplit: "", includeOtherFields: true },
);

const compareDatasetsFactoryImpl = createSimpleOperationFactory<CompareDatasetsNode>(
	"compareDatasets",
	[
		{ id: InputId.generate(), label: "Input A", accessor: "inputA" },
		{ id: InputId.generate(), label: "Input B", accessor: "inputB" },
	],
	[
		{ id: OutputId.generate(), label: "In A Only", accessor: "inAOnly" },
		{ id: OutputId.generate(), label: "In B Only", accessor: "inBOnly" },
		{ id: OutputId.generate(), label: "Same", accessor: "same" },
		{ id: OutputId.generate(), label: "Different", accessor: "different" },
	],
	{ mergeByFields: [], mode: "allMatches" },
);

// --- Factories Manager ---
const factoryImplementations = {
	textGeneration: textGenerationFactoryImpl,
	imageGeneration: imageGenerationFactoryImpl,
	trigger: triggerFactoryImpl,
	action: actionFactoryImpl,
	query: queryFactoryImpl,
	dataQuery: dataQueryFactoryImpl,
	end: endFactoryImpl,
	integration: integrationFactoryImpl,
	text: textVariableFactoryImpl,
	file: fileVariableFactoryImpl,
	github: githubVariableFactoryImpl,
	vectorStore: vectorStoreFactoryImpl,
	dataStore: dataStoreFactoryImpl,
	webPage: webPageFactoryImpl,
	appEntry: appEntryFactoryImpl,
	contentGeneration: contentGenerationFactoryImpl,
	aiAgent: aiAgentFactoryImpl,
	chatModel: chatModelFactoryImpl,
	toolNode: toolNodeFactoryImpl,
	memoryNode: memoryNodeFactoryImpl,
	if: ifFactoryImpl,
	switch: switchFactoryImpl,
	merge: mergeFactoryImpl,
	loop: loopFactoryImpl,
	code: codeFactoryImpl,
	filter: filterFactoryImpl,
	editFields: editFieldsFactoryImpl,
	sort: sortFactoryImpl,
	wait: waitFactoryImpl,
	errorTrigger: errorTriggerFactoryImpl,
	dataTable: dataTableFactoryImpl,
	formTrigger: formTriggerFactoryImpl,
	executeSubWorkflow: executeSubWorkflowFactoryImpl,
	respondToWebhook: respondToWebhookFactoryImpl,
	customVariables: customVariablesFactoryImpl,
	aggregate: aggregateFactoryImpl,
	summarize: summarizeFactoryImpl,
	limit: limitFactoryImpl,
	removeDuplicates: removeDuplicatesFactoryImpl,
	renameKeys: renameKeysFactoryImpl,
	splitOut: splitOutFactoryImpl,
	compareDatasets: compareDatasetsFactoryImpl,
} as const;

type CreateArgMap = {
	textGeneration: Parameters<typeof textGenerationFactoryImpl.create>[0];
	imageGeneration: Parameters<typeof imageGenerationFactoryImpl.create>[0];
	trigger: Parameters<typeof triggerFactoryImpl.create>[0];
	action: Parameters<typeof actionFactoryImpl.create>[0];
	query: undefined; // queryFactoryImpl.create is no argument
	dataQuery: undefined; // dataQueryFactoryImpl.create is no argument
	end: undefined;
	integration: IntegrationCreateInput;
	text: undefined; // textVariableFactoryImpl.create is no argument
	file: Parameters<typeof fileVariableFactoryImpl.create>[0];
	github: Parameters<typeof githubVariableFactoryImpl.create>[0];
	vectorStore: Parameters<typeof vectorStoreFactoryImpl.create>[0];
	dataStore: undefined; // dataStoreFactoryImpl.create is no argument
	webPage: undefined;
	appEntry: undefined;
	contentGeneration: CreateContentGenerationNodeInput;
	aiAgent: CreateAiAgentNodeInput;
	chatModel: CreateChatModelNodeInput;
	toolNode: ToolNodeCreateInput;
	memoryNode: MemoryNodeCreateInput;
	if: undefined;
	switch: undefined;
	merge: undefined;
	loop: undefined;
	code: undefined;
	filter: undefined;
	editFields: undefined;
	sort: undefined;
	wait: undefined;
	errorTrigger: undefined;
	dataTable: undefined;
	formTrigger: undefined;
	executeSubWorkflow: undefined;
	respondToWebhook: undefined;
	customVariables: undefined;
	aggregate: undefined;
	summarize: undefined;
	limit: undefined;
	removeDuplicates: undefined;
	renameKeys: undefined;
	splitOut: undefined;
	compareDatasets: undefined;
};

const nodeTypesRequiringArg = (
	Object.keys(factoryImplementations) as Array<
		keyof typeof factoryImplementations
	>
).filter(
	(type) => factoryImplementations[type].create.length > 0,
) as NodeContentType[];

export function createAiAgentNode(
	input: CreateAiAgentNodeInput,
): AiAgentNode {
	return aiAgentFactoryImpl.create(input);
}

export function createChatModelNode(
	input: CreateChatModelNodeInput,
): ChatModelNode {
	return chatModelFactoryImpl.create(input);
}

export function createToolNodeNode(input: ToolNodeCreateInput): ToolNodeNode {
	return toolNodeFactoryImpl.create(input);
}

export function createMemoryNodeNode(
	input: MemoryNodeCreateInput,
): MemoryNodeNode {
	return memoryNodeFactoryImpl.create(input);
}

export function createTextGenerationNode(
	llm: TextGenerationContent["llm"],
): TextGenerationNode {
	return textGenerationFactoryImpl.create(llm);
}

export function createContentGenerationNode(
	input: CreateContentGenerationNodeInput,
): ContentGenerationNode {
	return contentGenerationFactoryImpl.create(input);
}

export function createImageGenerationNode(
	llm: ImageGenerationContent["llm"],
): ImageGenerationNode {
	return imageGenerationFactoryImpl.create(llm);
}

export function createTriggerNode(
	provider: TriggerContent["provider"],
): TriggerNode {
	return triggerFactoryImpl.create(provider);
}

export function createActionNode(provider: ActionProvider): ActionNode {
	return actionFactoryImpl.create(provider);
}

export function createQueryNode(): QueryNode {
	return queryFactoryImpl.create();
}

export function createEndNode(): EndNode {
	return endFactoryImpl.create();
}

export function createIntegrationNode(
	input: IntegrationCreateInput,
): IntegrationNode {
	return integrationFactoryImpl.create(input);
}

export function createTextNode(): TextNode {
	return textVariableFactoryImpl.create();
}

export function createFileNode(category: FileContent["category"]): FileNode {
	return fileVariableFactoryImpl.create(category);
}

export function createGitHubNode(
	objectReferences: GitHubContent["objectReferences"] = [],
): GitHubNode {
	return githubVariableFactoryImpl.create(objectReferences);
}

export function createVectorStoreNode(
	provider: VectorStoreContent["source"]["provider"],
): VectorStoreNode {
	return vectorStoreFactoryImpl.create(provider);
}

export function createGitHubVectorStoreNode(): VectorStoreNode {
	return vectorStoreFactoryImpl.create("github");
}

export function createDocumentVectorStoreNode(): VectorStoreNode {
	return vectorStoreFactoryImpl.create("document");
}

export function createDataStoreNode(): DataStoreNode {
	return dataStoreFactoryImpl.create();
}

export function createDataQueryNode(): DataQueryNode {
	return dataQueryFactoryImpl.create();
}

export function createWebPageNode(): WebPageNode {
	return webPageFactoryImpl.create();
}

export function createAppEntryNode() {
	return appEntryFactoryImpl.create();
}

export function createIfNode(): IfNode {
	return ifFactoryImpl.create();
}

export function createSwitchNode(): SwitchNode {
	return switchFactoryImpl.create();
}

export function createMergeNode(): MergeNode {
	return mergeFactoryImpl.create();
}

export function createLoopNode(): LoopNode {
	return loopFactoryImpl.create();
}

export function createCodeNode(): CodeNode {
	return codeFactoryImpl.create();
}

export function createFilterNode(): FilterNode {
	return filterFactoryImpl.create();
}

export function createEditFieldsNode(): EditFieldsNode {
	return editFieldsFactoryImpl.create();
}

export function createSortNode(): SortNode {
	return sortFactoryImpl.create();
}

export function createWaitNode(): WaitNode {
	return waitFactoryImpl.create();
}

export function createErrorTriggerNode(): ErrorTriggerNode {
	return errorTriggerFactoryImpl.create();
}

export function createDataTableNode(): DataTableNode {
	return dataTableFactoryImpl.create();
}

export function createFormTriggerNode(): FormTriggerNode {
	return formTriggerFactoryImpl.create();
}

export function createExecuteSubWorkflowNode(): ExecuteSubWorkflowNode {
	return executeSubWorkflowFactoryImpl.create();
}

export function createRespondToWebhookNode(): RespondToWebhookNode {
	return respondToWebhookFactoryImpl.create();
}

export function createCustomVariablesNode(): CustomVariablesNode {
	return customVariablesFactoryImpl.create();
}

export function createAggregateNode(): AggregateNode {
	return aggregateFactoryImpl.create();
}

export function createSummarizeNode(): SummarizeNode {
	return summarizeFactoryImpl.create();
}

export function createLimitNode(): LimitNode {
	return limitFactoryImpl.create();
}

export function createRemoveDuplicatesNode(): RemoveDuplicatesNode {
	return removeDuplicatesFactoryImpl.create();
}

export function createRenameKeysNode(): RenameKeysNode {
	return renameKeysFactoryImpl.create();
}

export function createSplitOutNode(): SplitOutNode {
	return splitOutFactoryImpl.create();
}

export function createCompareDatasetsNode(): CompareDatasetsNode {
	return compareDatasetsFactoryImpl.create();
}

export function cloneNode<N extends Node>(
	sourceNode: N,
): NodeFactoryCloneResult<N> {
	const contentType = sourceNode.content.type;
	switch (contentType) {
		case "textGeneration":
			if (isTextGenerationNode(sourceNode)) {
				return textGenerationFactoryImpl.clone(
					sourceNode,
				) as NodeFactoryCloneResult<N>;
			}
			break;
		case "imageGeneration":
			if (isImageGenerationNode(sourceNode)) {
				return imageGenerationFactoryImpl.clone(
					sourceNode,
				) as NodeFactoryCloneResult<N>;
			}
			break;
		case "trigger":
			if (isTriggerNode(sourceNode)) {
				return triggerFactoryImpl.clone(
					sourceNode,
				) as NodeFactoryCloneResult<N>;
			}
			break;
		case "action":
			if (isActionNode(sourceNode)) {
				return actionFactoryImpl.clone(sourceNode) as NodeFactoryCloneResult<N>;
			}
			break;
		case "query":
			if (isQueryNode(sourceNode)) {
				return queryFactoryImpl.clone(sourceNode) as NodeFactoryCloneResult<N>;
			}
			break;
		case "dataQuery":
			if (isDataQueryNode(sourceNode)) {
				return dataQueryFactoryImpl.clone(
					sourceNode,
				) as NodeFactoryCloneResult<N>;
			}
			break;
		case "end":
			if (isEndNode(sourceNode)) {
				return endFactoryImpl.clone(sourceNode) as NodeFactoryCloneResult<N>;
			}
			break;
		case "integration":
			if (isIntegrationNode(sourceNode)) {
				return integrationFactoryImpl.clone(
					sourceNode,
				) as NodeFactoryCloneResult<N>;
			}
			break;
		case "text":
			if (isTextNode(sourceNode)) {
				return textVariableFactoryImpl.clone(
					sourceNode,
				) as NodeFactoryCloneResult<N>;
			}
			break;
		case "file":
			if (isFileNode(sourceNode)) {
				return fileVariableFactoryImpl.clone(
					sourceNode,
				) as NodeFactoryCloneResult<N>;
			}
			break;
		case "github":
			if (isGitHubNode(sourceNode)) {
				return githubVariableFactoryImpl.clone(
					sourceNode,
				) as NodeFactoryCloneResult<N>;
			}
			break;
		case "vectorStore":
			if (isVectorStoreNode(sourceNode)) {
				return vectorStoreFactoryImpl.clone(
					sourceNode,
				) as NodeFactoryCloneResult<N>;
			}
			break;
		case "dataStore":
			if (isDataStoreNode(sourceNode)) {
				return dataStoreFactoryImpl.clone(
					sourceNode,
				) as NodeFactoryCloneResult<N>;
			}
			break;
		case "webPage":
			if (isWebPageNode(sourceNode)) {
				return webPageFactoryImpl.clone(
					sourceNode,
				) as NodeFactoryCloneResult<N>;
			}
			break;
		case "appEntry":
			if (isAppEntryNode(sourceNode)) {
				return appEntryFactoryImpl.clone(
					sourceNode,
				) as NodeFactoryCloneResult<N>;
			}
			break;
		case "contentGeneration":
			if (isContentGenerationNode(sourceNode)) {
				return contentGenerationFactoryImpl.clone(
					sourceNode,
				) as NodeFactoryCloneResult<N>;
			}
			break;
		case "aiAgent":
			if (isAiAgentNode(sourceNode)) {
				return aiAgentFactoryImpl.clone(
					sourceNode,
				) as NodeFactoryCloneResult<N>;
			}
			break;
		case "chatModel":
			if (isChatModelNode(sourceNode)) {
				return chatModelFactoryImpl.clone(
					sourceNode,
				) as NodeFactoryCloneResult<N>;
			}
			break;
		case "toolNode":
			if (isToolNodeNode(sourceNode)) {
				return toolNodeFactoryImpl.clone(
					sourceNode,
				) as NodeFactoryCloneResult<N>;
			}
			break;
		case "memoryNode":
			if (isMemoryNodeNode(sourceNode)) {
				return memoryNodeFactoryImpl.clone(
					sourceNode,
				) as NodeFactoryCloneResult<N>;
			}
			break;
		case "if":
			if (isIfNode(sourceNode))
				return ifFactoryImpl.clone(sourceNode) as NodeFactoryCloneResult<N>;
			break;
		case "switch":
			if (isSwitchNode(sourceNode))
				return switchFactoryImpl.clone(sourceNode) as NodeFactoryCloneResult<N>;
			break;
		case "merge":
			if (isMergeNode(sourceNode))
				return mergeFactoryImpl.clone(sourceNode) as NodeFactoryCloneResult<N>;
			break;
		case "loop":
			if (isLoopNode(sourceNode))
				return loopFactoryImpl.clone(sourceNode) as NodeFactoryCloneResult<N>;
			break;
		case "code":
			if (isCodeNode(sourceNode))
				return codeFactoryImpl.clone(sourceNode) as NodeFactoryCloneResult<N>;
			break;
		case "filter":
			if (isFilterNode(sourceNode))
				return filterFactoryImpl.clone(sourceNode) as NodeFactoryCloneResult<N>;
			break;
		case "editFields":
			if (isEditFieldsNode(sourceNode))
				return editFieldsFactoryImpl.clone(sourceNode) as NodeFactoryCloneResult<N>;
			break;
		case "sort":
			if (isSortNode(sourceNode))
				return sortFactoryImpl.clone(sourceNode) as NodeFactoryCloneResult<N>;
			break;
		case "wait":
			if (isWaitNode(sourceNode))
				return waitFactoryImpl.clone(sourceNode) as NodeFactoryCloneResult<N>;
			break;
		case "errorTrigger":
			if (isErrorTriggerNode(sourceNode))
				return errorTriggerFactoryImpl.clone(sourceNode) as NodeFactoryCloneResult<N>;
			break;
		case "dataTable":
			if (isDataTableNode(sourceNode))
				return dataTableFactoryImpl.clone(sourceNode) as NodeFactoryCloneResult<N>;
			break;
		case "formTrigger":
			if (isFormTriggerNode(sourceNode))
				return formTriggerFactoryImpl.clone(sourceNode) as NodeFactoryCloneResult<N>;
			break;
		case "executeSubWorkflow":
			if (isExecuteSubWorkflowNode(sourceNode))
				return executeSubWorkflowFactoryImpl.clone(sourceNode) as NodeFactoryCloneResult<N>;
			break;
		case "respondToWebhook":
			if (isRespondToWebhookNode(sourceNode))
				return respondToWebhookFactoryImpl.clone(sourceNode) as NodeFactoryCloneResult<N>;
			break;
		case "customVariables":
			if (isCustomVariablesNode(sourceNode))
				return customVariablesFactoryImpl.clone(sourceNode) as NodeFactoryCloneResult<N>;
			break;
		case "aggregate":
			if (isAggregateNode(sourceNode))
				return aggregateFactoryImpl.clone(sourceNode) as NodeFactoryCloneResult<N>;
			break;
		case "summarize":
			if (isSummarizeNode(sourceNode))
				return summarizeFactoryImpl.clone(sourceNode) as NodeFactoryCloneResult<N>;
			break;
		case "limit":
			if (isLimitNode(sourceNode))
				return limitFactoryImpl.clone(sourceNode) as NodeFactoryCloneResult<N>;
			break;
		case "removeDuplicates":
			if (isRemoveDuplicatesNode(sourceNode))
				return removeDuplicatesFactoryImpl.clone(sourceNode) as NodeFactoryCloneResult<N>;
			break;
		case "renameKeys":
			if (isRenameKeysNode(sourceNode))
				return renameKeysFactoryImpl.clone(sourceNode) as NodeFactoryCloneResult<N>;
			break;
		case "splitOut":
			if (isSplitOutNode(sourceNode))
				return splitOutFactoryImpl.clone(sourceNode) as NodeFactoryCloneResult<N>;
			break;
		case "compareDatasets":
			if (isCompareDatasetsNode(sourceNode))
				return compareDatasetsFactoryImpl.clone(sourceNode) as NodeFactoryCloneResult<N>;
			break;
		default: {
			const _exhaustive: never = contentType;
			throw new Error(`No clone factory for content type: ${_exhaustive}`);
		}
	}

	throw new Error(`Invalid node structure for content type: ${contentType}`);
}

export const nodeFactories = {
	create: <K extends NodeContentType>(type: K, arg?: CreateArgMap[K]) => {
		if (nodeTypesRequiringArg.includes(type) && arg === undefined) {
			throw new Error(`Argument required for node type: ${type}`);
		}

		switch (type) {
			case "textGeneration":
				return factoryImplementations.textGeneration.create(
					arg as CreateArgMap["textGeneration"],
				);
			case "imageGeneration":
				return factoryImplementations.imageGeneration.create(
					arg as CreateArgMap["imageGeneration"],
				);
			case "trigger":
				return factoryImplementations.trigger.create(
					arg as CreateArgMap["trigger"],
				);
			case "action":
				return factoryImplementations.action.create(
					arg as CreateArgMap["action"],
				);
			case "query":
				return factoryImplementations.query.create();
			case "dataQuery":
				return factoryImplementations.dataQuery.create();
			case "end":
				return factoryImplementations.end.create();
			case "integration":
				return factoryImplementations.integration.create(
					arg as CreateArgMap["integration"],
				);
			case "text":
				return factoryImplementations.text.create();
			case "file":
				return factoryImplementations.file.create(arg as CreateArgMap["file"]);
			case "github":
				return factoryImplementations.github.create(
					arg as CreateArgMap["github"],
				);
			case "vectorStore":
				return factoryImplementations.vectorStore.create(
					arg as CreateArgMap["vectorStore"],
				);
			case "dataStore":
				return factoryImplementations.dataStore.create();
			case "webPage":
				return factoryImplementations.webPage.create();
			case "appEntry":
				return factoryImplementations.appEntry.create();
			case "contentGeneration":
				return factoryImplementations.contentGeneration.create(
					arg as CreateArgMap["contentGeneration"],
				);
			case "aiAgent":
				return factoryImplementations.aiAgent.create(
					arg as CreateArgMap["aiAgent"],
				);
			case "chatModel":
				return factoryImplementations.chatModel.create(
					arg as CreateArgMap["chatModel"],
				);
			case "toolNode":
				return factoryImplementations.toolNode.create(
					arg as CreateArgMap["toolNode"],
				);
			case "memoryNode":
				return factoryImplementations.memoryNode.create(
					arg as CreateArgMap["memoryNode"],
				);
			case "if":
				return factoryImplementations.if.create();
			case "switch":
				return factoryImplementations.switch.create();
			case "merge":
				return factoryImplementations.merge.create();
			case "loop":
				return factoryImplementations.loop.create();
			case "code":
				return factoryImplementations.code.create();
			case "filter":
				return factoryImplementations.filter.create();
			case "editFields":
				return factoryImplementations.editFields.create();
			case "sort":
				return factoryImplementations.sort.create();
			case "wait":
				return factoryImplementations.wait.create();
			case "errorTrigger":
				return factoryImplementations.errorTrigger.create();
			case "dataTable":
				return factoryImplementations.dataTable.create();
			case "formTrigger":
				return factoryImplementations.formTrigger.create();
			case "executeSubWorkflow":
				return factoryImplementations.executeSubWorkflow.create();
			case "respondToWebhook":
				return factoryImplementations.respondToWebhook.create();
			case "customVariables":
				return factoryImplementations.customVariables.create();
			case "aggregate":
				return factoryImplementations.aggregate.create();
			case "summarize":
				return factoryImplementations.summarize.create();
			case "limit":
				return factoryImplementations.limit.create();
			case "removeDuplicates":
				return factoryImplementations.removeDuplicates.create();
			case "renameKeys":
				return factoryImplementations.renameKeys.create();
			case "splitOut":
				return factoryImplementations.splitOut.create();
			case "compareDatasets":
				return factoryImplementations.compareDatasets.create();
			default: {
				const _exhaustive: never = type;
				throw new Error(`No create factory for content type: ${_exhaustive}`);
			}
		}
	},
	clone: (sourceNode: Node) => {
		const contentType = sourceNode.content.type;
		switch (contentType) {
			case "textGeneration":
				if (isTextGenerationNode(sourceNode)) {
					return factoryImplementations.textGeneration.clone(sourceNode);
				}
				break;
			case "imageGeneration":
				if (isImageGenerationNode(sourceNode)) {
					return factoryImplementations.imageGeneration.clone(sourceNode);
				}
				break;
			case "trigger":
				if (isTriggerNode(sourceNode)) {
					return factoryImplementations.trigger.clone(sourceNode);
				}
				break;
			case "action":
				if (isActionNode(sourceNode)) {
					return factoryImplementations.action.clone(sourceNode);
				}
				break;
			case "query":
				if (isQueryNode(sourceNode)) {
					return factoryImplementations.query.clone(sourceNode);
				}
				break;
			case "dataQuery":
				if (isDataQueryNode(sourceNode)) {
					return factoryImplementations.dataQuery.clone(sourceNode);
				}
				break;
			case "end":
				if (isEndNode(sourceNode)) {
					return factoryImplementations.end.clone(sourceNode);
				}
				break;
			case "integration":
				if (isIntegrationNode(sourceNode)) {
					return factoryImplementations.integration.clone(sourceNode);
				}
				break;
			case "text":
				if (isTextNode(sourceNode)) {
					return factoryImplementations.text.clone(sourceNode);
				}
				break;
			case "file":
				if (isFileNode(sourceNode)) {
					return factoryImplementations.file.clone(sourceNode);
				}
				break;
			case "github":
				if (isGitHubNode(sourceNode)) {
					return factoryImplementations.github.clone(sourceNode);
				}
				break;
			case "vectorStore":
				if (isVectorStoreNode(sourceNode)) {
					return factoryImplementations.vectorStore.clone(sourceNode);
				}
				break;
			case "dataStore":
				if (isDataStoreNode(sourceNode)) {
					return factoryImplementations.dataStore.clone(sourceNode);
				}
				break;
			case "webPage":
				if (isWebPageNode(sourceNode)) {
					return factoryImplementations.webPage.clone(sourceNode);
				}
				break;
			case "appEntry":
				if (isAppEntryNode(sourceNode)) {
					return factoryImplementations.appEntry.clone(sourceNode);
				}
				break;
			case "contentGeneration":
				if (isContentGenerationNode(sourceNode)) {
					return factoryImplementations.contentGeneration.clone(sourceNode);
				}
				break;
			case "aiAgent":
				if (isAiAgentNode(sourceNode)) {
					return factoryImplementations.aiAgent.clone(sourceNode);
				}
				break;
			case "chatModel":
				if (isChatModelNode(sourceNode)) {
					return factoryImplementations.chatModel.clone(sourceNode);
				}
				break;
			case "toolNode":
				if (isToolNodeNode(sourceNode)) {
					return factoryImplementations.toolNode.clone(sourceNode);
				}
				break;
			case "memoryNode":
				if (isMemoryNodeNode(sourceNode)) {
					return factoryImplementations.memoryNode.clone(sourceNode);
				}
				break;
			case "if":
				if (isIfNode(sourceNode))
					return factoryImplementations.if.clone(sourceNode);
				break;
			case "switch":
				if (isSwitchNode(sourceNode))
					return factoryImplementations.switch.clone(sourceNode);
				break;
			case "merge":
				if (isMergeNode(sourceNode))
					return factoryImplementations.merge.clone(sourceNode);
				break;
			case "loop":
				if (isLoopNode(sourceNode))
					return factoryImplementations.loop.clone(sourceNode);
				break;
			case "code":
				if (isCodeNode(sourceNode))
					return factoryImplementations.code.clone(sourceNode);
				break;
			case "filter":
				if (isFilterNode(sourceNode))
					return factoryImplementations.filter.clone(sourceNode);
				break;
			case "editFields":
				if (isEditFieldsNode(sourceNode))
					return factoryImplementations.editFields.clone(sourceNode);
				break;
			case "sort":
				if (isSortNode(sourceNode))
					return factoryImplementations.sort.clone(sourceNode);
				break;
			case "wait":
				if (isWaitNode(sourceNode))
					return factoryImplementations.wait.clone(sourceNode);
				break;
			case "errorTrigger":
				if (isErrorTriggerNode(sourceNode))
					return factoryImplementations.errorTrigger.clone(sourceNode);
				break;
			case "dataTable":
				if (isDataTableNode(sourceNode))
					return factoryImplementations.dataTable.clone(sourceNode);
				break;
			case "formTrigger":
				if (isFormTriggerNode(sourceNode))
					return factoryImplementations.formTrigger.clone(sourceNode);
				break;
			case "executeSubWorkflow":
				if (isExecuteSubWorkflowNode(sourceNode))
					return factoryImplementations.executeSubWorkflow.clone(sourceNode);
				break;
			case "respondToWebhook":
				if (isRespondToWebhookNode(sourceNode))
					return factoryImplementations.respondToWebhook.clone(sourceNode);
				break;
			case "customVariables":
				if (isCustomVariablesNode(sourceNode))
					return factoryImplementations.customVariables.clone(sourceNode);
				break;
			case "aggregate":
				if (isAggregateNode(sourceNode))
					return factoryImplementations.aggregate.clone(sourceNode);
				break;
			case "summarize":
				if (isSummarizeNode(sourceNode))
					return factoryImplementations.summarize.clone(sourceNode);
				break;
			case "limit":
				if (isLimitNode(sourceNode))
					return factoryImplementations.limit.clone(sourceNode);
				break;
			case "removeDuplicates":
				if (isRemoveDuplicatesNode(sourceNode))
					return factoryImplementations.removeDuplicates.clone(sourceNode);
				break;
			case "renameKeys":
				if (isRenameKeysNode(sourceNode))
					return factoryImplementations.renameKeys.clone(sourceNode);
				break;
			case "splitOut":
				if (isSplitOutNode(sourceNode))
					return factoryImplementations.splitOut.clone(sourceNode);
				break;
			case "compareDatasets":
				if (isCompareDatasetsNode(sourceNode))
					return factoryImplementations.compareDatasets.clone(sourceNode);
				break;
			default: {
				const _exhaustive: never = contentType;
				throw new Error(`No clone factory for content type: ${_exhaustive}`);
			}
		}

		throw new Error(`Invalid node structure for content type: ${contentType}`);
	},
};
