"use client";

import type {
	AggregateNode,
	CodeNode,
	CompareDatasetsNode,
	ConditionOperator,
	CustomVariablesNode,
	DataTableNode,
	EditFieldsNode,
	ExecuteSubWorkflowNode,
	FormTriggerNode,
	ErrorTriggerNode,
	FilterNode,
	IfNode,
	LimitNode,
	LoopNode,
	MergeNode,
	NodeId,
	OperationNode,
	RemoveDuplicatesNode,
	RenameKeysNode,
	RespondToWebhookNode,
	SortNode,
	SplitOutNode,
	SummarizeNode,
	SwitchNode,
	WaitNode,
} from "@giselles-ai/protocol";
import type { ReactNode } from "react";
import {
	useDeleteNode,
	useUpdateNodeDataContent,
} from "../../../app-designer";
import {
	NodePanelHeader,
	PropertiesPanelContent,
	PropertiesPanelRoot,
} from "../ui";
import { CommentsTab } from "../ui/comments-tab";
import { ExpressionInput } from "../ui/expression-input";
import { NodeSettingsTab } from "../ui/node-settings-tab";
import { PanelTabs } from "../ui/panel-tabs";
import { SettingLabel } from "../ui/setting-label";

type FlowControlNodeType =
	| IfNode
	| SwitchNode
	| MergeNode
	| LoopNode
	| CodeNode
	| FilterNode
	| EditFieldsNode
	| SortNode
	| WaitNode
	| ErrorTriggerNode
	| DataTableNode
	| FormTriggerNode
	| AggregateNode
	| SummarizeNode
	| LimitNode
	| RemoveDuplicatesNode
	| RenameKeysNode
	| SplitOutNode
	| CompareDatasetsNode
	| ExecuteSubWorkflowNode
	| RespondToWebhookNode
	| CustomVariablesNode;

function FlowControlPanelLayout({
	node,
	onDelete,
	children,
}: {
	node: FlowControlNodeType;
	onDelete: () => void;
	children: ReactNode;
}) {
	return (
		<PropertiesPanelRoot>
			<NodePanelHeader node={node} onDelete={onDelete} />
			<PanelTabs
				tabs={[
					{
						id: "parameters",
						label: "Parameters",
						content: (
							<PropertiesPanelContent>{children}</PropertiesPanelContent>
						),
					},
					{
						id: "settings",
						label: "Settings",
						content: (
							<NodeSettingsTab node={node as unknown as OperationNode} />
						),
					},
					{
						id: "comments",
						label: "Comments",
						content: <CommentsTab nodeId={node.id} />,
					},
				]}
			/>
		</PropertiesPanelRoot>
	);
}

export function FlowControlPropertiesPanel({
	node,
}: {
	node: FlowControlNodeType;
}) {
	const deleteNode = useDeleteNode();

	switch (node.content.type) {
		case "if":
			return (
				<IfPanel
					node={node as IfNode}
					onDelete={() => deleteNode(node.id)}
				/>
			);
		case "switch":
			return (
				<SwitchPanel
					node={node as SwitchNode}
					onDelete={() => deleteNode(node.id)}
				/>
			);
		case "merge":
			return (
				<MergePanel
					node={node as MergeNode}
					onDelete={() => deleteNode(node.id)}
				/>
			);
		case "loop":
			return (
				<LoopPanel
					node={node as LoopNode}
					onDelete={() => deleteNode(node.id)}
				/>
			);
		case "code":
			return (
				<CodePanel
					node={node as CodeNode}
					onDelete={() => deleteNode(node.id)}
				/>
			);
		case "filter":
			return (
				<FilterPanel
					node={node as FilterNode}
					onDelete={() => deleteNode(node.id)}
				/>
			);
		case "editFields":
			return (
				<EditFieldsPanel
					node={node as EditFieldsNode}
					onDelete={() => deleteNode(node.id)}
				/>
			);
		case "sort":
			return (
				<SortPanel
					node={node as SortNode}
					onDelete={() => deleteNode(node.id)}
				/>
			);
		case "wait":
			return (
				<WaitPanel
					node={node as WaitNode}
					onDelete={() => deleteNode(node.id)}
				/>
			);
		case "errorTrigger":
			return (
				<ErrorTriggerPanel
					node={node as ErrorTriggerNode}
					onDelete={() => deleteNode(node.id)}
				/>
			);
		case "dataTable":
			return (
				<DataTablePanel
					node={node as DataTableNode}
					onDelete={() => deleteNode(node.id)}
				/>
			);
		case "formTrigger":
			return (
				<FormTriggerPanel
					node={node as FormTriggerNode}
					onDelete={() => deleteNode(node.id)}
				/>
			);
		case "aggregate":
		case "summarize":
		case "limit":
		case "removeDuplicates":
		case "renameKeys":
		case "splitOut":
		case "compareDatasets":
		case "executeSubWorkflow":
		case "respondToWebhook":
		case "customVariables":
			return (
				<GenericFlowControlPanel
					node={node}
					onDelete={() => deleteNode(node.id)}
				/>
			);
	}
}

// ---- If Panel ----
function IfPanel({
	node,
	onDelete,
}: { node: IfNode; onDelete: () => void }) {
	const updateContent = useUpdateNodeDataContent();

	return (
		<FlowControlPanelLayout node={node} onDelete={onDelete}>
			<div className="flex flex-col gap-[16px]">
				<div>
					<SettingLabel>Conditions</SettingLabel>
					<p className="text-[11px] text-text-muted/50">
						Evaluates conditions on input data. Routes to True or False output
						port.
					</p>
				</div>
				<div className="flex flex-col gap-[8px]">
					<label className="text-[12px] text-text-muted">Combine with</label>
					<select
						className="rounded-[8px] border border-border-muted bg-transparent px-[12px] py-[8px] text-[13px] text-text"
						value={node.content.conditionGroup.combineWith}
						onChange={(e) =>
							updateContent(node, {
								conditionGroup: {
									...node.content.conditionGroup,
									combineWith: e.target.value as "and" | "or",
								},
							})
						}
					>
						<option value="and">AND (all must match)</option>
						<option value="or">OR (any must match)</option>
					</select>
				</div>
				{node.content.conditionGroup.conditions.map((cond, i) => (
					<ConditionRow
						key={`condition-${i}`}
						condition={cond}
						nodeId={node.id as NodeId}
						onChange={(updated) => {
							const conditions = [
								...node.content.conditionGroup.conditions,
							];
							conditions[i] = updated;
							updateContent(node, {
								conditionGroup: {
									...node.content.conditionGroup,
									conditions,
								},
							});
						}}
						onRemove={() => {
							const conditions =
								node.content.conditionGroup.conditions.filter(
									(_, j) => j !== i,
								);
							updateContent(node, {
								conditionGroup: {
									...node.content.conditionGroup,
									conditions,
								},
							});
						}}
					/>
				))}
				<button
					type="button"
					className="rounded-[8px] border border-dashed border-border-muted px-[12px] py-[8px] text-[12px] text-text-muted hover:border-text-muted/50 transition-colors"
					onClick={() =>
						updateContent(node, {
							conditionGroup: {
								...node.content.conditionGroup,
								conditions: [
									...node.content.conditionGroup.conditions,
									{ field: "", operator: "equals", value: "" },
								],
							},
						})
					}
				>
					+ Add Condition
				</button>
			</div>
		</FlowControlPanelLayout>
	);
}

// ---- Condition Row (shared by If, Switch, Filter) ----
function ConditionRow({
	condition,
	onChange,
	onRemove,
	nodeId,
}: {
	condition: {
		field: string;
		operator: ConditionOperator;
		value?: string;
	};
	onChange: (updated: {
		field: string;
		operator: ConditionOperator;
		value?: string;
	}) => void;
	onRemove: () => void;
	nodeId?: NodeId;
}) {
	return (
		<div className="flex gap-[4px] items-end">
			<div className="flex-1">
				<label className="text-[10px] text-text-muted/70">Field</label>
				<ExpressionInput
					value={condition.field}
					onChange={(v) => onChange({ ...condition, field: v })}
					placeholder="e.g. status"
					nodeId={nodeId}
				/>
			</div>
			<div className="w-[120px]">
				<label className="text-[10px] text-text-muted/70">Operator</label>
				<select
					className="w-full rounded-[6px] border border-border-muted bg-transparent px-[6px] py-[6px] text-[12px] text-text"
					value={condition.operator}
					onChange={(e) =>
						onChange({
							...condition,
							operator: e.target.value as ConditionOperator,
						})
					}
				>
					<optgroup label="Comparison">
						<option value="equals">Equals</option>
						<option value="notEquals">Not Equals</option>
						<option value="greaterThan">Greater Than</option>
						<option value="lessThan">Less Than</option>
						<option value="greaterThanOrEqual">Greater Or Equal</option>
						<option value="lessThanOrEqual">Less Or Equal</option>
					</optgroup>
					<optgroup label="Text">
						<option value="contains">Contains</option>
						<option value="notContains">Not Contains</option>
						<option value="startsWith">Starts With</option>
						<option value="endsWith">Ends With</option>
						<option value="regex">Regex</option>
					</optgroup>
					<optgroup label="State">
						<option value="isEmpty">Is Empty</option>
						<option value="isNotEmpty">Is Not Empty</option>
						<option value="isTrue">Is True</option>
						<option value="isFalse">Is False</option>
					</optgroup>
				</select>
			</div>
			<div className="flex-1">
				<label className="text-[10px] text-text-muted/70">Value</label>
				<ExpressionInput
					value={condition.value ?? ""}
					onChange={(v) => onChange({ ...condition, value: v })}
					placeholder="compare value"
					nodeId={nodeId}
				/>
			</div>
			<button
				type="button"
				className="shrink-0 px-[6px] py-[6px] text-[12px] text-error-500 hover:text-error-400"
				onClick={onRemove}
			>
				x
			</button>
		</div>
	);
}

// ---- Switch Panel ----
function SwitchPanel({
	node,
	onDelete,
}: { node: SwitchNode; onDelete: () => void }) {
	const updateContent = useUpdateNodeDataContent();

	return (
		<FlowControlPanelLayout node={node} onDelete={onDelete}>
			<div className="flex flex-col gap-[16px]">
				<div>
					<SettingLabel>Rules</SettingLabel>
					<p className="text-[11px] text-text-muted/50">
						Evaluates rules in order. First matching rule activates its output
						port.
					</p>
				</div>
				<div className="flex items-center gap-[8px]">
					<label className="text-[12px] text-text-muted">
						<input
							type="checkbox"
							className="mr-[6px]"
							checked={node.content.hasFallback}
							onChange={(e) =>
								updateContent(node, { hasFallback: e.target.checked })
							}
						/>
						Enable fallback output
					</label>
				</div>
				{node.content.rules.map((rule, i) => (
					<div
						key={`rule-${i}`}
						className="rounded-[8px] border border-border-muted p-[12px] flex flex-col gap-[8px]"
					>
						<div className="flex items-center gap-[8px]">
							{/* Reorder buttons */}
							<div className="flex flex-col gap-[1px] shrink-0">
								<button
									type="button"
									className="text-[10px] text-text-muted/50 hover:text-text-muted disabled:opacity-20"
									disabled={i === 0}
									onClick={() => {
										const rules = [...node.content.rules];
										[rules[i - 1], rules[i]] = [rules[i], rules[i - 1]];
										updateContent(node, { rules });
									}}
									title="Move up"
								>
									&#9650;
								</button>
								<button
									type="button"
									className="text-[10px] text-text-muted/50 hover:text-text-muted disabled:opacity-20"
									disabled={i === node.content.rules.length - 1}
									onClick={() => {
										const rules = [...node.content.rules];
										[rules[i], rules[i + 1]] = [rules[i + 1], rules[i]];
										updateContent(node, { rules });
									}}
									title="Move down"
								>
									&#9660;
								</button>
							</div>
							<input
								type="text"
								className="flex-1 rounded-[6px] border border-border-muted bg-transparent px-[8px] py-[4px] text-[12px] text-text"
								value={rule.name}
								onChange={(e) => {
									const rules = [...node.content.rules];
									rules[i] = { ...rule, name: e.target.value };
									updateContent(node, { rules });
								}}
								placeholder="Rule name"
							/>
							<input
								type="text"
								className="w-[100px] rounded-[6px] border border-border-muted bg-transparent px-[8px] py-[4px] text-[12px] text-text"
								value={rule.outputPortName}
								onChange={(e) => {
									const rules = [...node.content.rules];
									rules[i] = {
										...rule,
										outputPortName: e.target.value,
									};
									updateContent(node, { rules });
								}}
								placeholder="Output port"
							/>
							<button
								type="button"
								className="text-[12px] text-error-500"
								onClick={() => {
									const rules = node.content.rules.filter(
										(_, j) => j !== i,
									);
									updateContent(node, { rules });
								}}
							>
								x
							</button>
						</div>
						{/* Conditions within this rule */}
						<div className="pl-[24px] flex flex-col gap-[6px]">
							<div className="flex items-center gap-[6px]">
								<label className="text-[10px] text-text-muted/70">Combine</label>
								<select
									className="rounded-[4px] border border-border-muted bg-transparent px-[6px] py-[2px] text-[11px] text-text"
									value={rule.conditionGroup.combineWith}
									onChange={(e) => {
										const rules = [...node.content.rules];
										rules[i] = {
											...rule,
											conditionGroup: {
												...rule.conditionGroup,
												combineWith: e.target.value as "and" | "or",
											},
										};
										updateContent(node, { rules });
									}}
								>
									<option value="and">AND</option>
									<option value="or">OR</option>
								</select>
							</div>
							{rule.conditionGroup.conditions.map((cond, j) => (
								<ConditionRow
									key={`rule-${i}-cond-${j}`}
									condition={cond}
									nodeId={node.id as NodeId}
									onChange={(updated) => {
										const rules = [...node.content.rules];
										const conditions = [...rule.conditionGroup.conditions];
										conditions[j] = updated;
										rules[i] = {
											...rule,
											conditionGroup: { ...rule.conditionGroup, conditions },
										};
										updateContent(node, { rules });
									}}
									onRemove={() => {
										const rules = [...node.content.rules];
										const conditions = rule.conditionGroup.conditions.filter(
											(_, k) => k !== j,
										);
										rules[i] = {
											...rule,
											conditionGroup: { ...rule.conditionGroup, conditions },
										};
										updateContent(node, { rules });
									}}
								/>
							))}
							<button
								type="button"
								className="rounded-[6px] border border-dashed border-border-muted px-[8px] py-[4px] text-[11px] text-text-muted hover:border-text-muted/50 transition-colors"
								onClick={() => {
									const rules = [...node.content.rules];
									rules[i] = {
										...rule,
										conditionGroup: {
											...rule.conditionGroup,
											conditions: [
												...rule.conditionGroup.conditions,
												{ field: "", operator: "equals" as const, value: "" },
											],
										},
									};
									updateContent(node, { rules });
								}}
							>
								+ Add Condition
							</button>
						</div>
					</div>
				))}
				<button
					type="button"
					className="rounded-[8px] border border-dashed border-border-muted px-[12px] py-[8px] text-[12px] text-text-muted hover:border-text-muted/50"
					onClick={() =>
						updateContent(node, {
							rules: [
								...node.content.rules,
								{
									name: `Rule ${node.content.rules.length + 1}`,
									conditionGroup: {
										conditions: [],
										combineWith: "and",
									},
									outputPortName: `rule_${node.content.rules.length}`,
								},
							],
						})
					}
				>
					+ Add Rule
				</button>
			</div>
		</FlowControlPanelLayout>
	);
}

// ---- Merge Panel ----
function MergePanel({
	node,
	onDelete,
}: { node: MergeNode; onDelete: () => void }) {
	const updateContent = useUpdateNodeDataContent();

	return (
		<FlowControlPanelLayout node={node} onDelete={onDelete}>
			<div className="flex flex-col gap-[16px]">
				<div>
					<SettingLabel>Mode</SettingLabel>
					<p className="text-[11px] text-text-muted/50">
						How to combine inputs from multiple branches.
					</p>
				</div>
				<select
					className="rounded-[8px] border border-border-muted bg-transparent px-[12px] py-[8px] text-[13px] text-text"
					value={node.content.mode}
					onChange={(e) =>
						updateContent(node, {
							mode: e.target.value as MergeNode["content"]["mode"],
						})
					}
				>
					<option value="chooseBranch">
						Choose Branch (use whichever ran)
					</option>
					<option value="waitAll">Wait All (combine all inputs)</option>
					<option value="waitAny">Wait Any (first available)</option>
					<option value="append">Append (concatenate as array)</option>
				</select>
			</div>
		</FlowControlPanelLayout>
	);
}

// ---- Loop Panel ----
function LoopPanel({
	node,
	onDelete,
}: { node: LoopNode; onDelete: () => void }) {
	const updateContent = useUpdateNodeDataContent();

	return (
		<FlowControlPanelLayout node={node} onDelete={onDelete}>
			<div className="flex flex-col gap-[16px]">
				<div>
					<SettingLabel>Mode</SettingLabel>
					<select
						className="rounded-[8px] border border-border-muted bg-transparent px-[12px] py-[8px] text-[13px] text-text"
						value={node.content.mode}
						onChange={(e) =>
							updateContent(node, {
								mode: e.target.value as "forEach" | "nTimes",
							})
						}
					>
						<option value="forEach">For Each (iterate array)</option>
						<option value="nTimes">N Times (repeat count)</option>
					</select>
				</div>
				{node.content.mode === "nTimes" && (
					<div>
						<SettingLabel>Times</SettingLabel>
						<input
							type="number"
							className="w-full rounded-[8px] border border-border-muted bg-transparent px-[12px] py-[8px] text-[13px] text-text"
							value={node.content.nTimes ?? 1}
							min={1}
							max={node.content.maxIterations}
							onChange={(e) =>
								updateContent(node, {
									nTimes: Number(e.target.value),
								})
							}
						/>
					</div>
				)}
				<div>
					<SettingLabel>Max Iterations</SettingLabel>
					<input
						type="number"
						className="w-full rounded-[8px] border border-border-muted bg-transparent px-[12px] py-[8px] text-[13px] text-text"
						value={node.content.maxIterations}
						min={1}
						max={10000}
						onChange={(e) =>
							updateContent(node, {
								maxIterations: Number(e.target.value),
							})
						}
					/>
					<p className="mt-[4px] text-[10px] text-text-muted/50">
						Safety limit to prevent infinite loops.
					</p>
				</div>
			</div>
		</FlowControlPanelLayout>
	);
}

// ---- Code Panel ----
function CodePanel({
	node,
	onDelete,
}: { node: CodeNode; onDelete: () => void }) {
	const updateContent = useUpdateNodeDataContent();

	return (
		<FlowControlPanelLayout node={node} onDelete={onDelete}>
			<div className="flex flex-col gap-[16px]">
				<div>
					<SettingLabel>JavaScript Code</SettingLabel>
					<p className="text-[11px] text-text-muted/50">
						Input data is available as <code>items</code> (array) and{" "}
						<code>data</code> (object). Return the processed result.
					</p>
				</div>
				<textarea
					className="w-full min-h-[200px] rounded-[8px] border border-border-muted bg-transparent px-[12px] py-[8px] text-[12px] text-text font-mono resize-y"
					value={node.content.code}
					onChange={(e) => updateContent(node, { code: e.target.value })}
					spellCheck={false}
				/>
				<div>
					<SettingLabel>Timeout (ms)</SettingLabel>
					<input
						type="number"
						className="w-[120px] rounded-[8px] border border-border-muted bg-transparent px-[12px] py-[8px] text-[13px] text-text"
						value={node.content.timeout}
						min={1000}
						max={30000}
						step={1000}
						onChange={(e) =>
							updateContent(node, {
								timeout: Number(e.target.value),
							})
						}
					/>
				</div>
			</div>
		</FlowControlPanelLayout>
	);
}

// ---- Filter Panel ----
function FilterPanel({
	node,
	onDelete,
}: { node: FilterNode; onDelete: () => void }) {
	const updateContent = useUpdateNodeDataContent();

	return (
		<FlowControlPanelLayout node={node} onDelete={onDelete}>
			<div className="flex flex-col gap-[16px]">
				<div>
					<SettingLabel>Filter Conditions</SettingLabel>
					<p className="text-[11px] text-text-muted/50">
						Items matching conditions go to Kept output, others to
						Discarded.
					</p>
				</div>
				<select
					className="rounded-[8px] border border-border-muted bg-transparent px-[12px] py-[8px] text-[13px] text-text"
					value={node.content.conditionGroup.combineWith}
					onChange={(e) =>
						updateContent(node, {
							conditionGroup: {
								...node.content.conditionGroup,
								combineWith: e.target.value as "and" | "or",
							},
						})
					}
				>
					<option value="and">AND (all must match)</option>
					<option value="or">OR (any must match)</option>
				</select>
				{node.content.conditionGroup.conditions.map((cond, i) => (
					<ConditionRow
						key={`filter-cond-${i}`}
						condition={cond}
						nodeId={node.id as NodeId}
						onChange={(updated) => {
							const conditions = [
								...node.content.conditionGroup.conditions,
							];
							conditions[i] = updated;
							updateContent(node, {
								conditionGroup: {
									...node.content.conditionGroup,
									conditions,
								},
							});
						}}
						onRemove={() => {
							const conditions =
								node.content.conditionGroup.conditions.filter(
									(_, j) => j !== i,
								);
							updateContent(node, {
								conditionGroup: {
									...node.content.conditionGroup,
									conditions,
								},
							});
						}}
					/>
				))}
				<button
					type="button"
					className="rounded-[8px] border border-dashed border-border-muted px-[12px] py-[8px] text-[12px] text-text-muted hover:border-text-muted/50"
					onClick={() =>
						updateContent(node, {
							conditionGroup: {
								...node.content.conditionGroup,
								conditions: [
									...node.content.conditionGroup.conditions,
									{ field: "", operator: "equals", value: "" },
								],
							},
						})
					}
				>
					+ Add Condition
				</button>
			</div>
		</FlowControlPanelLayout>
	);
}

// ---- Edit Fields Panel ----
function EditFieldsPanel({
	node,
	onDelete,
}: { node: EditFieldsNode; onDelete: () => void }) {
	const updateContent = useUpdateNodeDataContent();

	return (
		<FlowControlPanelLayout node={node} onDelete={onDelete}>
			<div className="flex flex-col gap-[16px]">
				<div>
					<SettingLabel>Field Operations</SettingLabel>
					<p className="text-[11px] text-text-muted/50">
						Set, remove, or rename fields on each item.
					</p>
				</div>
				<label className="text-[12px] text-text-muted">
					<input
						type="checkbox"
						className="mr-[6px]"
						checked={node.content.keepOnlySet}
						onChange={(e) =>
							updateContent(node, {
								keepOnlySet: e.target.checked,
							})
						}
					/>
					Keep only set fields (remove all others)
				</label>
				{node.content.operations.map((op, i) => (
					<div key={`op-${i}`} className="flex gap-[4px] items-end">
						<div className="w-[90px]">
							<label className="text-[10px] text-text-muted/70">
								Operation
							</label>
							<select
								className="w-full rounded-[6px] border border-border-muted bg-transparent px-[6px] py-[6px] text-[12px] text-text"
								value={op.operation}
								onChange={(e) => {
									const operations = [
										...node.content.operations,
									];
									operations[i] = {
										...op,
										operation: e.target.value as
											| "set"
											| "remove"
											| "rename",
									};
									updateContent(node, { operations });
								}}
							>
								<option value="set">Set</option>
								<option value="remove">Remove</option>
								<option value="rename">Rename</option>
							</select>
						</div>
						<div className="flex-1">
							<label className="text-[10px] text-text-muted/70">
								Field Name
							</label>
							<input
								type="text"
								className="w-full rounded-[6px] border border-border-muted bg-transparent px-[8px] py-[6px] text-[12px] text-text"
								value={op.fieldName}
								onChange={(e) => {
									const operations = [
										...node.content.operations,
									];
									operations[i] = {
										...op,
										fieldName: e.target.value,
									};
									updateContent(node, { operations });
								}}
							/>
						</div>
						{op.operation === "set" && (
							<div className="flex-1">
								<label className="text-[10px] text-text-muted/70">
									Value
								</label>
								<ExpressionInput
									value={op.value ?? ""}
									onChange={(v) => {
										const operations = [
											...node.content.operations,
										];
										operations[i] = {
											...op,
											value: v,
										};
										updateContent(node, { operations });
									}}
									placeholder="value or expression"
									nodeId={node.id as NodeId}
								/>
							</div>
						)}
						{op.operation === "rename" && (
							<div className="flex-1">
								<label className="text-[10px] text-text-muted/70">
									New Name
								</label>
								<input
									type="text"
									className="w-full rounded-[6px] border border-border-muted bg-transparent px-[8px] py-[6px] text-[12px] text-text"
									value={op.newFieldName ?? ""}
									onChange={(e) => {
										const operations = [
											...node.content.operations,
										];
										operations[i] = {
											...op,
											newFieldName: e.target.value,
										};
										updateContent(node, { operations });
									}}
								/>
							</div>
						)}
						<button
							type="button"
							className="shrink-0 px-[6px] py-[6px] text-[12px] text-error-500"
							onClick={() => {
								const operations =
									node.content.operations.filter(
										(_, j) => j !== i,
									);
								updateContent(node, { operations });
							}}
						>
							x
						</button>
					</div>
				))}
				<button
					type="button"
					className="rounded-[8px] border border-dashed border-border-muted px-[12px] py-[8px] text-[12px] text-text-muted hover:border-text-muted/50"
					onClick={() =>
						updateContent(node, {
							operations: [
								...node.content.operations,
								{
									operation: "set",
									fieldName: "",
									value: "",
								},
							],
						})
					}
				>
					+ Add Operation
				</button>
			</div>
		</FlowControlPanelLayout>
	);
}

// ---- Sort Panel ----
function SortPanel({
	node,
	onDelete,
}: { node: SortNode; onDelete: () => void }) {
	const updateContent = useUpdateNodeDataContent();

	return (
		<FlowControlPanelLayout node={node} onDelete={onDelete}>
			<div className="flex flex-col gap-[16px]">
				<div>
					<SettingLabel>Sort Keys</SettingLabel>
					<p className="text-[11px] text-text-muted/50">
						Sort items by one or more fields.
					</p>
				</div>
				{node.content.sortKeys.map((key, i) => (
					<div
						key={`sort-${i}`}
						className="flex gap-[4px] items-end"
					>
						<div className="flex-1">
							<label className="text-[10px] text-text-muted/70">
								Field
							</label>
							<input
								type="text"
								className="w-full rounded-[6px] border border-border-muted bg-transparent px-[8px] py-[6px] text-[12px] text-text"
								value={key.field}
								onChange={(e) => {
									const sortKeys = [
										...node.content.sortKeys,
									];
									sortKeys[i] = {
										...key,
										field: e.target.value,
									};
									updateContent(node, { sortKeys });
								}}
								placeholder="field name"
							/>
						</div>
						<div className="w-[100px]">
							<label className="text-[10px] text-text-muted/70">
								Direction
							</label>
							<select
								className="w-full rounded-[6px] border border-border-muted bg-transparent px-[6px] py-[6px] text-[12px] text-text"
								value={key.direction}
								onChange={(e) => {
									const sortKeys = [
										...node.content.sortKeys,
									];
									sortKeys[i] = {
										...key,
										direction: e.target.value as
											| "asc"
											| "desc",
									};
									updateContent(node, { sortKeys });
								}}
							>
								<option value="asc">Ascending</option>
								<option value="desc">Descending</option>
							</select>
						</div>
						<button
							type="button"
							className="shrink-0 px-[6px] py-[6px] text-[12px] text-error-500"
							onClick={() => {
								const sortKeys =
									node.content.sortKeys.filter(
										(_, j) => j !== i,
									);
								updateContent(node, { sortKeys });
							}}
						>
							x
						</button>
					</div>
				))}
				<button
					type="button"
					className="rounded-[8px] border border-dashed border-border-muted px-[12px] py-[8px] text-[12px] text-text-muted hover:border-text-muted/50"
					onClick={() =>
						updateContent(node, {
							sortKeys: [
								...node.content.sortKeys,
								{ field: "", direction: "asc" },
							],
						})
					}
				>
					+ Add Sort Key
				</button>
			</div>
		</FlowControlPanelLayout>
	);
}

// ---- Wait Panel ----
function WaitPanel({
	node,
	onDelete,
}: { node: WaitNode; onDelete: () => void }) {
	const updateContent = useUpdateNodeDataContent();

	return (
		<FlowControlPanelLayout node={node} onDelete={onDelete}>
			<div className="flex flex-col gap-[16px]">
				<div>
					<SettingLabel>Mode</SettingLabel>
					<select
						className="rounded-[8px] border border-border-muted bg-transparent px-[12px] py-[8px] text-[13px] text-text"
						value={node.content.mode}
						onChange={(e) =>
							updateContent(node, {
								mode: e.target.value as
									| "fixedTime"
									| "webhook"
									| "approval",
							})
						}
					>
						<option value="fixedTime">Fixed Time Delay</option>
						<option value="webhook">Wait for Webhook</option>
						<option value="approval">Wait for Approval</option>
					</select>
				</div>
				{node.content.mode === "fixedTime" && (
					<div>
						<SettingLabel>Delay (seconds)</SettingLabel>
						<input
							type="number"
							className="w-full rounded-[8px] border border-border-muted bg-transparent px-[12px] py-[8px] text-[13px] text-text"
							value={node.content.delaySeconds}
							min={0}
							onChange={(e) =>
								updateContent(node, {
									delaySeconds: Number(e.target.value),
								})
							}
						/>
					</div>
				)}
				<div>
					<SettingLabel>Timeout (seconds)</SettingLabel>
					<input
						type="number"
						className="w-full rounded-[8px] border border-border-muted bg-transparent px-[12px] py-[8px] text-[13px] text-text"
						value={node.content.timeoutSeconds}
						min={1}
						onChange={(e) =>
							updateContent(node, {
								timeoutSeconds: Number(e.target.value),
							})
						}
					/>
				</div>
			</div>
		</FlowControlPanelLayout>
	);
}

// ---- Error Trigger Panel ----
function ErrorTriggerPanel({
	node,
	onDelete,
}: { node: ErrorTriggerNode; onDelete: () => void }) {
	return (
		<FlowControlPanelLayout node={node} onDelete={onDelete}>
			<div className="flex flex-col gap-[16px]">
				<div>
					<SettingLabel>Error Trigger</SettingLabel>
					<p className="text-[11px] text-text-muted/50">
						This node fires when any other node in the workflow fails.
						Connect it to downstream nodes to handle errors (e.g., send
						notifications).
					</p>
				</div>
				<div className="rounded-[8px] border border-border-muted p-[12px] text-[12px] text-text-muted">
					<p>Outputs:</p>
					<ul className="mt-[4px] list-disc pl-[16px] space-y-[2px]">
						<li>Error Message</li>
						<li>Failed Node ID</li>
						<li>Timestamp</li>
					</ul>
				</div>
			</div>
		</FlowControlPanelLayout>
	);
}

// ---- Form Trigger Panel ----
function FormTriggerPanel({
	node,
	onDelete,
}: { node: FormTriggerNode; onDelete: () => void }) {
	const updateContent = useUpdateNodeDataContent();

	const addField = () => {
		const id = `field_${Date.now()}`;
		updateContent(node, {
			fields: [
				...node.content.fields,
				{
					id,
					name: id,
					label: `Field ${node.content.fields.length + 1}`,
					type: "text",
					required: false,
					options: [],
					placeholder: "",
					defaultValue: "",
				},
			],
		});
	};

	const removeField = (index: number) => {
		updateContent(node, {
			fields: node.content.fields.filter((_, i) => i !== index),
		});
	};

	const updateField = (
		index: number,
		updates: Partial<FormTriggerNode["content"]["fields"][number]>,
	) => {
		const fields = [...node.content.fields];
		fields[index] = { ...fields[index], ...updates };
		updateContent(node, { fields });
	};

	return (
		<FlowControlPanelLayout node={node} onDelete={onDelete}>
			<div className="flex flex-col gap-[16px]">
				<div>
					<SettingLabel>Form Trigger</SettingLabel>
					<p className="text-[11px] text-text-muted/50">
						Creates a public form that triggers this workflow when submitted.
						Form data flows as structured output to downstream nodes.
					</p>
				</div>
				<div>
					<SettingLabel>Form Title</SettingLabel>
					<input
						type="text"
						className="w-full rounded-[8px] border border-border-muted bg-transparent px-[12px] py-[8px] text-[12px] text-text"
						value={node.content.title}
						onChange={(e) => updateContent(node, { title: e.target.value })}
						placeholder="My Form"
					/>
				</div>
				<div>
					<SettingLabel>Description</SettingLabel>
					<textarea
						className="w-full min-h-[60px] rounded-[8px] border border-border-muted bg-transparent px-[12px] py-[8px] text-[12px] text-text resize-y"
						value={node.content.description}
						onChange={(e) =>
							updateContent(node, { description: e.target.value })
						}
						placeholder="Describe what this form is for..."
					/>
				</div>
				<div>
					<SettingLabel>Fields</SettingLabel>
					<div className="flex flex-col gap-[8px] mt-[4px]">
						{node.content.fields.map((field, i) => (
							<div
								key={field.id}
								className="rounded-[8px] border border-border-muted p-[10px] flex flex-col gap-[6px]"
							>
								<div className="flex gap-[4px] items-end">
									<div className="flex-1">
										<label className="text-[10px] text-text-muted/70">
											Label
										</label>
										<input
											type="text"
											className="w-full rounded-[6px] border border-border-muted bg-transparent px-[8px] py-[4px] text-[12px] text-text"
											value={field.label}
											onChange={(e) =>
												updateField(i, {
													label: e.target.value,
													name: e.target.value
														.toLowerCase()
														.replace(/\s+/g, "_")
														.replace(/[^a-z0-9_]/g, ""),
												})
											}
										/>
									</div>
									<div className="w-[100px]">
										<label className="text-[10px] text-text-muted/70">
											Type
										</label>
										<select
											className="w-full rounded-[6px] border border-border-muted bg-transparent px-[6px] py-[4px] text-[12px] text-text"
											value={field.type}
											onChange={(e) =>
												updateField(i, {
													type: e.target.value as FormTriggerNode["content"]["fields"][number]["type"],
												})
											}
										>
											<option value="text">Text</option>
											<option value="number">Number</option>
											<option value="email">Email</option>
											<option value="textarea">Textarea</option>
											<option value="select">Select</option>
											<option value="checkbox">Checkbox</option>
											<option value="date">Date</option>
										</select>
									</div>
									<label className="flex items-center gap-[4px] text-[10px] text-text-muted/70 shrink-0">
										<input
											type="checkbox"
											checked={field.required}
											onChange={(e) =>
												updateField(i, { required: e.target.checked })
											}
										/>
										Req
									</label>
									<button
										type="button"
										className="shrink-0 px-[6px] py-[4px] text-[12px] text-error-500 hover:text-error-400"
										onClick={() => removeField(i)}
									>
										x
									</button>
								</div>
								{field.type === "select" && (
									<div>
										<label className="text-[10px] text-text-muted/70">
											Options (comma-separated)
										</label>
										<input
											type="text"
											className="w-full rounded-[6px] border border-border-muted bg-transparent px-[8px] py-[4px] text-[12px] text-text"
											value={field.options.join(", ")}
											onChange={(e) =>
												updateField(i, {
													options: e.target.value
														.split(",")
														.map((s) => s.trim())
														.filter(Boolean),
												})
											}
											placeholder="Option 1, Option 2, Option 3"
										/>
									</div>
								)}
								<div>
									<label className="text-[10px] text-text-muted/70">
										Placeholder
									</label>
									<input
										type="text"
										className="w-full rounded-[6px] border border-border-muted bg-transparent px-[8px] py-[4px] text-[12px] text-text"
										value={field.placeholder}
										onChange={(e) =>
											updateField(i, { placeholder: e.target.value })
										}
									/>
								</div>
							</div>
						))}
					</div>
					<button
						type="button"
						className="mt-[8px] w-full rounded-[8px] border border-dashed border-border-muted px-[12px] py-[8px] text-[12px] text-text-muted hover:border-text-muted/50 transition-colors"
						onClick={addField}
					>
						+ Add Field
					</button>
				</div>
				<div>
					<SettingLabel>Submit Button Text</SettingLabel>
					<input
						type="text"
						className="w-full rounded-[8px] border border-border-muted bg-transparent px-[12px] py-[8px] text-[12px] text-text"
						value={node.content.submitButtonText}
						onChange={(e) =>
							updateContent(node, { submitButtonText: e.target.value })
						}
					/>
				</div>
				<div>
					<SettingLabel>Success Message</SettingLabel>
					<input
						type="text"
						className="w-full rounded-[8px] border border-border-muted bg-transparent px-[12px] py-[8px] text-[12px] text-text"
						value={node.content.successMessage}
						onChange={(e) =>
							updateContent(node, { successMessage: e.target.value })
						}
					/>
				</div>
				<div className="rounded-[8px] border border-border-muted p-[12px] text-[12px] text-text-muted">
					<p>Outputs:</p>
					<ul className="mt-[4px] list-disc pl-[16px] space-y-[2px]">
						<li>Form Data (all submitted field values as JSON)</li>
					</ul>
				</div>
			</div>
		</FlowControlPanelLayout>
	);
}

// ---- Generic panel for newer data transform nodes ----
const genericDescriptions: Record<string, string> = {
	aggregate:
		"Groups items by a field and computes aggregations (sum, count, avg, min, max) on each group.",
	summarize:
		"Produces a statistical summary (count, sum, average, min, max) for numeric fields across all input items.",
	limit: "Keeps only the first N items from the input, discarding the rest.",
	removeDuplicates:
		"Removes duplicate items based on a specified field, keeping only unique entries.",
	renameKeys:
		"Renames fields (keys) on each item according to configured old-name to new-name mappings.",
	splitOut:
		"Takes an array field inside each item and splits it out so each array element becomes its own item.",
	compareDatasets:
		"Compares two input datasets and outputs items that appear in both, only in Input 1, or only in Input 2.",
	executeSubWorkflow:
		"Executes another workflow as a sub-workflow, passing data in and receiving results back.",
	respondToWebhook:
		"Sends an HTTP response back to the webhook that triggered this workflow execution.",
	customVariables:
		"Reads and writes team-level custom variables that persist across workflow executions.",
};

function GenericFlowControlPanel({
	node,
	onDelete,
}: { node: FlowControlNodeType; onDelete: () => void }) {
	const desc = genericDescriptions[node.content.type] ?? "Configure this node.";
	return (
		<FlowControlPanelLayout node={node} onDelete={onDelete}>
			<div className="flex flex-col gap-[16px]">
				<div>
					<SettingLabel>Description</SettingLabel>
					<p className="text-[11px] text-text-muted/50">{desc}</p>
				</div>
				<div className="rounded-[8px] border border-border-muted p-[12px] text-[12px] text-text-muted">
					<p>
						This node processes data automatically based on its inputs.
						Connect upstream nodes to provide data.
					</p>
				</div>
			</div>
		</FlowControlPanelLayout>
	);
}

function DataTablePanel({
	node,
	onDelete,
}: { node: DataTableNode; onDelete: () => void }) {
	const updateContent = useUpdateNodeDataContent();

	return (
		<FlowControlPanelLayout node={node} onDelete={onDelete}>
			<div className="flex flex-col gap-[16px]">
				<div>
					<SettingLabel>Data Table</SettingLabel>
					<p className="text-[11px] text-text-muted/50">
						Persistent storage that persists across workflow executions.
						Perform CRUD operations on structured data tables.
					</p>
				</div>
				<div>
					<SettingLabel>Table Name</SettingLabel>
					<input
						type="text"
						className="w-full rounded-[8px] border border-border-muted bg-transparent px-[12px] py-[8px] text-[12px] text-text-default"
						value={(node.content as { tableName?: string }).tableName ?? ""}
						onChange={(e) =>
							updateContent(node.id, { tableName: e.target.value })
						}
						placeholder="Enter table name..."
					/>
				</div>
				<div>
					<SettingLabel>Operation</SettingLabel>
					<select
						className="w-full rounded-[8px] border border-border-muted bg-transparent px-[12px] py-[8px] text-[12px] text-text-default"
						value={(node.content as { operation?: string }).operation ?? "query"}
						onChange={(e) =>
							updateContent(node.id, { operation: e.target.value })
						}
					>
						<option value="query">Query (Read)</option>
						<option value="insert">Insert (Create)</option>
						<option value="update">Update</option>
						<option value="delete">Delete</option>
						<option value="upsert">Upsert (Create or Update)</option>
					</select>
				</div>
				<div>
					<SettingLabel>Row Limit</SettingLabel>
					<input
						type="number"
						className="w-full rounded-[8px] border border-border-muted bg-transparent px-[12px] py-[8px] text-[12px] text-text-default"
						value={(node.content as { limit?: number }).limit ?? 100}
						onChange={(e) =>
							updateContent(node.id, {
								limit: Number.parseInt(e.target.value, 10) || 100,
							})
						}
						min={0}
						max={10000}
					/>
				</div>
				<div className="rounded-[8px] border border-border-muted p-[12px] text-[12px] text-text-muted">
					<p>Outputs:</p>
					<ul className="mt-[4px] list-disc pl-[16px] space-y-[2px]">
						<li>Data (query results or operation status)</li>
						<li>Operation type</li>
					</ul>
				</div>
			</div>
		</FlowControlPanelLayout>
	);
}
