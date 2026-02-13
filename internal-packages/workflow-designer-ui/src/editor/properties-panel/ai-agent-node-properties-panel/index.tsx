import { Toggle } from "@giselle-internal/ui/toggle";
import { useToasts } from "@giselle-internal/ui/toast";
import {
	getEntry,
	type LanguageModelId,
	type LanguageModelTier,
} from "@giselles-ai/language-model-registry";
import {
	type AiAgentNode,
	type Connection,
	type ContentGenerationNode,
	Node,
	type NodeLike,
	type OperationNode,
} from "@giselles-ai/protocol";
import { useNodeGenerations, useUsageLimits } from "@giselles-ai/react";
import { useCallback, useState } from "react";
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
import { NodeSettingsTab } from "../ui/node-settings-tab";
import { CommentsTab } from "../ui/comments-tab";
import { PanelTabs } from "../ui/panel-tabs";
import { PromptEditor } from "../ui/prompt-editor";
import { SettingDetail, SettingLabel } from "../ui/setting-label";
import { AdvancedOptions } from "../text-generation-node-properties-panel-v2/advanced-options";
import { GenerationPanel } from "../text-generation-node-properties-panel-v2/generation-panel";
import { ModelSettings } from "../text-generation-node-properties-panel-v2/model";
import { useNodeContext } from "../text-generation-node-properties-panel-v2/node-context";
import { ModelPickerV2 } from "../../../ui/model-picker-v2";
import { AgentOutputPanel } from "./output-panel";
import { chainTemplates, type ChainTemplate } from "../../lib/chain-templates";

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

	const agentType = (node.content as { agentType?: string }).agentType ?? "tools";
	const isConversational = agentType === "conversational";
	const isSqlAgent = agentType === "sql";

	const parametersContent = (
		<div className="flex flex-col gap-[12px]">
			{/* Agent Type Selector */}
			<div className="flex items-center justify-between gap-[12px] px-[8px]">
				<SettingDetail size="md">Agent Type</SettingDetail>
				<select
					value={agentType}
					onChange={(e) => {
						const newType = e.target.value;
						const updates: Record<string, unknown> = { agentType: newType };
						// Set sensible defaults per type
						if (newType === "conversational") {
							updates.maxSteps = 1;
						} else if (newType === "sql") {
							updates.maxSteps = 15;
						} else if (newType === "planAndExecute") {
							updates.maxSteps = 50;
						}
						updateNodeDataContent(node, updates as Record<string, unknown>);
					}}
					className="bg-[color-mix(in_srgb,var(--color-text-inverse,#fff)_10%,transparent)] text-inverse text-[13px] rounded-[6px] px-[8px] py-[5px] border border-white-400/20 outline-none cursor-pointer min-w-[160px]"
				>
					<option value="tools">Tools Agent</option>
					<option value="conversational">Conversational</option>
					<option value="react">ReAct Agent</option>
					<option value="planAndExecute">Plan &amp; Execute</option>
					<option value="sql">SQL Agent</option>
				</select>
			</div>
			<p className="text-[11px] text-white/40 px-[8px] -mt-[8px]">
				{agentType === "tools" && "Multi-step agent with tool calling (default)"}
				{agentType === "conversational" && "Multi-turn chat without tools"}
				{agentType === "react" && "Thought \u2192 Action \u2192 Observation reasoning loop"}
				{agentType === "planAndExecute" && "Creates a plan, then executes each step"}
				{agentType === "sql" && "Specialized for database queries with schema awareness"}
			</p>

			{/* Chain Template Selector */}
			<div className="flex items-center justify-between gap-[12px] px-[8px]">
				<SettingDetail size="md">Template</SettingDetail>
				<select
					value={(node.content as { chainTemplateId?: string }).chainTemplateId ?? "custom"}
					onChange={(e) => {
						const templateId = e.target.value;
						if (templateId === "custom") {
							updateNodeDataContent(node, {
								chainTemplateId: undefined,
							} as Record<string, unknown>);
							return;
						}
						const template = chainTemplates.find(
							(t) => t.id === templateId,
						);
						if (template) {
							updateNodeDataContent(node, {
								chainTemplateId: template.id,
								systemPrompt: template.systemPrompt,
								structuredOutput: template.structuredOutput,
							} as Record<string, unknown>);
						}
					}}
					className="bg-[color-mix(in_srgb,var(--color-text-inverse,#fff)_10%,transparent)] text-inverse text-[13px] rounded-[6px] px-[8px] py-[5px] border border-white-400/20 outline-none cursor-pointer min-w-[160px]"
				>
					<option value="custom">Custom</option>
					{chainTemplates.map((t) => (
						<option key={t.id} value={t.id}>
							{t.name}
						</option>
					))}
				</select>
			</div>

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

			{!isConversational && (
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
			)}

			<Toggle
				name="structured-output"
				checked={node.content.structuredOutput?.enabled ?? false}
				onCheckedChange={(checked) => {
					updateNodeDataContent(node, {
						structuredOutput: {
							...(node.content.structuredOutput ?? {
								enabled: false,
								schema: "",
							}),
							enabled: checked as boolean,
						},
					});
				}}
			>
				<label
					htmlFor="structured-output"
					className="text-[14px]"
				>
					Require Structured Output
				</label>
			</Toggle>

			{node.content.structuredOutput?.enabled && (
				<div className="flex flex-col gap-[4px] px-[8px]">
					<SettingDetail size="sm">
						JSON Schema for the expected output format
					</SettingDetail>
					<textarea
						value={node.content.structuredOutput?.schema ?? ""}
						onChange={(e) => {
							updateNodeDataContent(node, {
								structuredOutput: {
									...(node.content.structuredOutput ?? {
										enabled: true,
										schema: "",
									}),
									schema: e.target.value,
								},
							});
						}}
						placeholder={`{\n  "type": "object",\n  "properties": {\n    "result": { "type": "string" }\n  }\n}`}
						rows={6}
						className="w-full rounded-[8px] border border-[hsla(0,0%,100%,0.1)] bg-[hsla(0,0%,100%,0.05)] px-[12px] py-[8px] text-[13px] text-white font-mono outline-none focus:border-[hsla(0,0%,100%,0.3)] resize-y"
					/>
				</div>
			)}

			<Toggle
				name="fallback-model"
				checked={node.content.fallbackModel?.enabled ?? false}
				onCheckedChange={(checked) => {
					updateNodeDataContent(node, {
						fallbackModel: {
							...(node.content.fallbackModel ?? {
								enabled: false,
							}),
							enabled: checked as boolean,
						},
					});
				}}
			>
				<label htmlFor="fallback-model" className="text-[14px]">
					Enable Fallback Model
				</label>
			</Toggle>

			{node.content.fallbackModel?.enabled && (
				<div className="flex flex-col gap-[4px] px-[8px]">
					<SettingDetail size="sm">
						If the primary model fails, retry with this model
					</SettingDetail>
					<div className="flex items-center justify-between gap-[12px]">
						<SettingDetail size="md">Fallback Model</SettingDetail>
						<ModelPickerV2
							userTier={userTier}
							value={node.content.fallbackModel?.id}
							onValueChange={(value: LanguageModelId) => {
								const lm = getEntry(value);
								updateNodeDataContent(node, {
									fallbackModel: {
										enabled: true,
										provider: lm.providerId,
										id: lm.id,
										configuration:
											lm.defaultConfiguration,
									},
								});
							}}
						/>
					</div>
				</div>
			)}

			{/* Output Parser */}
			<div className="flex items-center justify-between gap-[12px] px-[8px]">
				<SettingDetail size="md">Output Parser</SettingDetail>
				<select
					value={(node.content as { outputParser?: { type: string } }).outputParser?.type ?? "none"}
					onChange={(e) => {
						updateNodeDataContent(node, {
							outputParser: {
								...((node.content as { outputParser?: { type: string; retryAttempts: number } }).outputParser ?? { type: "none", retryAttempts: 3 }),
								type: e.target.value,
							},
						});
					}}
					className="bg-[color-mix(in_srgb,var(--color-text-inverse,#fff)_10%,transparent)] text-inverse text-[13px] rounded-[6px] px-[8px] py-[5px] border border-white-400/20 outline-none cursor-pointer min-w-[140px]"
				>
					<option value="none">None</option>
					<option value="autoFixing">Auto-Fixing</option>
					<option value="structured">Structured JSON</option>
					<option value="itemList">Item List</option>
				</select>
			</div>
			{(node.content as { outputParser?: { type: string } }).outputParser?.type === "autoFixing" && (
				<div className="flex items-center justify-between gap-[12px] px-[8px]">
					<SettingDetail size="sm">Retry Attempts</SettingDetail>
					<input
						type="number"
						min={1}
						max={10}
						value={(node.content as { outputParser?: { retryAttempts: number } }).outputParser?.retryAttempts ?? 3}
						onChange={(e) => {
							const value = Number.parseInt(e.target.value, 10);
							if (!Number.isNaN(value) && value >= 1 && value <= 10) {
								updateNodeDataContent(node, {
									outputParser: {
										...((node.content as { outputParser?: { type: string; retryAttempts: number } }).outputParser ?? { type: "autoFixing", retryAttempts: 3 }),
										retryAttempts: value,
									},
								});
							}
						}}
						className="w-[50px] bg-[color-mix(in_srgb,var(--color-text-inverse,#fff)_10%,transparent)] text-inverse text-[13px] rounded-[6px] px-[6px] py-[3px] border border-white-400/20 text-center"
					/>
				</div>
			)}
			{(node.content as { outputParser?: { type: string } }).outputParser?.type === "itemList" && (
				<p className="text-[11px] text-white/40 px-[8px]">
					Parses output into a list of items (one per line or JSON array)
				</p>
			)}

			<Toggle
				name="guardrails"
				checked={node.content.guardrails?.enabled ?? false}
				onCheckedChange={(checked) => {
					updateNodeDataContent(node, {
						guardrails: {
							...(node.content.guardrails ?? {
								enabled: false,
								inputRules: [],
								outputRules: [],
							}),
							enabled: checked as boolean,
						},
					});
				}}
			>
				<label htmlFor="guardrails" className="text-[14px]">
					Enable Guardrails
				</label>
			</Toggle>

			{node.content.guardrails?.enabled && (
				<GuardrailsSection
					node={node}
					updateNodeDataContent={updateNodeDataContent}
				/>
			)}

			<AdvancedOptions
				node={node as unknown as ContentGenerationNode}
			/>

			<div className="flex flex-col gap-[4px]">
				<SettingLabel>Output</SettingLabel>
				<AgentOutputPanel nodeId={node.id} />
			</div>
		</div>
	);

	return (
		<PropertiesPanelRoot>
			{usageLimitsReached && <UsageLimitWarning />}
			<NodePanelHeader
				node={node}
				onChangeName={(name) => updateNodeData(node, { name })}
				onDelete={() => deleteNode(node.id)}
			/>

			<PanelTabs
				tabs={[
					{
						id: "parameters",
						label: "Parameters",
						content: parametersContent,
					},
					{
						id: "settings",
						label: "Settings",
						content: (
							<NodeSettingsTab
								node={node as unknown as OperationNode}
							/>
						),
					},
					{
						id: "comments",
						label: "Comments",
						content: <CommentsTab nodeId={node.id} />,
					},
				]}
			/>

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

const RULE_TYPES = [
	{ value: "blocklist", label: "Blocklist", desc: "Block specific words or phrases" },
	{ value: "regex", label: "Regex Pattern", desc: "Block text matching a pattern" },
	{ value: "length", label: "Length Limit", desc: "Enforce min/max character count" },
	{ value: "pii", label: "PII Detection", desc: "Detect personal info (email, phone, SSN)" },
	{ value: "custom", label: "Custom", desc: "Custom JavaScript expression" },
] as const;

const RULE_ACTIONS = [
	{ value: "block", label: "Block" },
	{ value: "warn", label: "Warn" },
	{ value: "redact", label: "Redact" },
] as const;

type GuardrailRule = {
	id: string;
	type: "blocklist" | "regex" | "length" | "pii" | "custom";
	config: Record<string, unknown>;
	action: "block" | "warn" | "redact";
	enabled: boolean;
};

function GuardrailRuleEditor({
	rule,
	onUpdate,
	onRemove,
}: {
	rule: GuardrailRule;
	onUpdate: (updated: GuardrailRule) => void;
	onRemove: () => void;
}) {
	return (
		<div className="rounded-[8px] border border-border-muted p-[8px] flex flex-col gap-[6px]">
			<div className="flex items-center justify-between">
				<select
					className="rounded-[6px] border border-border-muted bg-transparent px-[8px] py-[4px] text-[11px] text-text-default"
					value={rule.type}
					onChange={(e) =>
						onUpdate({ ...rule, type: e.target.value as GuardrailRule["type"], config: {} })
					}
				>
					{RULE_TYPES.map((t) => (
						<option key={t.value} value={t.value}>{t.label}</option>
					))}
				</select>
				<div className="flex items-center gap-[4px]">
					<select
						className="rounded-[6px] border border-border-muted bg-transparent px-[6px] py-[3px] text-[10px] text-text-default"
						value={rule.action}
						onChange={(e) =>
							onUpdate({ ...rule, action: e.target.value as GuardrailRule["action"] })
						}
					>
						{RULE_ACTIONS.map((a) => (
							<option key={a.value} value={a.value}>{a.label}</option>
						))}
					</select>
					<button
						type="button"
						className="text-[10px] text-red-400 hover:text-red-300 px-[4px]"
						onClick={onRemove}
					>
						Remove
					</button>
				</div>
			</div>

			{rule.type === "blocklist" && (
				<textarea
					className="w-full rounded-[6px] border border-border-muted bg-transparent px-[8px] py-[4px] text-[11px] text-text-default font-mono resize-y"
					placeholder="Enter blocked words, one per line..."
					rows={3}
					value={((rule.config.words as string[]) ?? []).join("\n")}
					onChange={(e) =>
						onUpdate({
							...rule,
							config: { ...rule.config, words: e.target.value.split("\n").filter(Boolean) },
						})
					}
				/>
			)}

			{rule.type === "regex" && (
				<input
					type="text"
					className="w-full rounded-[6px] border border-border-muted bg-transparent px-[8px] py-[4px] text-[11px] text-text-default font-mono"
					placeholder="Regex pattern (e.g., \\b(DROP|DELETE)\\s+TABLE\\b)"
					value={(rule.config.pattern as string) ?? ""}
					onChange={(e) =>
						onUpdate({
							...rule,
							config: { ...rule.config, pattern: e.target.value },
						})
					}
				/>
			)}

			{rule.type === "length" && (
				<div className="flex gap-[8px]">
					<input
						type="number"
						className="w-[80px] rounded-[6px] border border-border-muted bg-transparent px-[8px] py-[4px] text-[11px] text-text-default"
						placeholder="Min"
						value={(rule.config.min as number) ?? ""}
						onChange={(e) =>
							onUpdate({
								...rule,
								config: { ...rule.config, min: Number.parseInt(e.target.value, 10) || 0 },
							})
						}
					/>
					<input
						type="number"
						className="w-[80px] rounded-[6px] border border-border-muted bg-transparent px-[8px] py-[4px] text-[11px] text-text-default"
						placeholder="Max"
						value={(rule.config.max as number) ?? ""}
						onChange={(e) =>
							onUpdate({
								...rule,
								config: { ...rule.config, max: Number.parseInt(e.target.value, 10) || 10000 },
							})
						}
					/>
				</div>
			)}

			{rule.type === "pii" && (
				<p className="text-[10px] text-text-muted/50">
					Detects: email, phone, SSN, credit card, IP address
				</p>
			)}

			{rule.type === "custom" && (
				<input
					type="text"
					className="w-full rounded-[6px] border border-border-muted bg-transparent px-[8px] py-[4px] text-[11px] text-text-default font-mono"
					placeholder='JS expression, e.g.: text.includes("secret")'
					value={(rule.config.expression as string) ?? ""}
					onChange={(e) =>
						onUpdate({
							...rule,
							config: { ...rule.config, expression: e.target.value },
						})
					}
				/>
			)}
		</div>
	);
}

function GuardrailsSection({
	node,
	updateNodeDataContent,
}: {
	node: AiAgentNode;
	updateNodeDataContent: (node: AiAgentNode, content: Partial<AiAgentNode["content"]>) => void;
}) {
	const [activeTab, setActiveTab] = useState<"input" | "output">("input");
	const guardrails = node.content.guardrails ?? {
		enabled: true,
		inputRules: [],
		outputRules: [],
	};
	const rules = activeTab === "input" ? guardrails.inputRules : guardrails.outputRules;
	const rulesKey = activeTab === "input" ? "inputRules" : "outputRules";

	const addRule = () => {
		const newRule: GuardrailRule = {
			id: `gr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
			type: "blocklist",
			config: {},
			action: "block",
			enabled: true,
		};
		updateNodeDataContent(node, {
			guardrails: {
				...guardrails,
				[rulesKey]: [...rules, newRule],
			},
		});
	};

	const updateRule = (index: number, updated: GuardrailRule) => {
		const newRules = [...rules];
		newRules[index] = updated;
		updateNodeDataContent(node, {
			guardrails: {
				...guardrails,
				[rulesKey]: newRules,
			},
		});
	};

	const removeRule = (index: number) => {
		const newRules = rules.filter((_, i) => i !== index);
		updateNodeDataContent(node, {
			guardrails: {
				...guardrails,
				[rulesKey]: newRules,
			},
		});
	};

	return (
		<div className="flex flex-col gap-[8px] px-[8px]">
			<SettingDetail size="sm">
				Validate inputs before sending to LLM and outputs before passing downstream
			</SettingDetail>

			<div className="flex gap-[4px]">
				<button
					type="button"
					className={`px-[10px] py-[4px] rounded-[6px] text-[11px] ${
						activeTab === "input"
							? "bg-primary-900 text-white"
							: "bg-transparent text-text-muted border border-border-muted"
					}`}
					onClick={() => setActiveTab("input")}
				>
					Input Rules ({guardrails.inputRules.length})
				</button>
				<button
					type="button"
					className={`px-[10px] py-[4px] rounded-[6px] text-[11px] ${
						activeTab === "output"
							? "bg-primary-900 text-white"
							: "bg-transparent text-text-muted border border-border-muted"
					}`}
					onClick={() => setActiveTab("output")}
				>
					Output Rules ({guardrails.outputRules.length})
				</button>
			</div>

			<div className="flex flex-col gap-[6px]">
				{rules.map((rule, index) => (
					<GuardrailRuleEditor
						key={rule.id}
						rule={rule}
						onUpdate={(updated) => updateRule(index, updated)}
						onRemove={() => removeRule(index)}
					/>
				))}
			</div>

			<button
				type="button"
				className="w-full rounded-[8px] border border-dashed border-border-muted py-[6px] text-[11px] text-text-muted hover:border-text-muted/50 hover:text-text-default"
				onClick={addRule}
			>
				+ Add {activeTab === "input" ? "Input" : "Output"} Rule
			</button>
		</div>
	);
}
