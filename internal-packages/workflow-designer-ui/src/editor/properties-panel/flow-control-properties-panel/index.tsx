"use client";

import type {
	CodeNode,
	ConditionOperator,
	EditFieldsNode,
	ErrorTriggerNode,
	FilterNode,
	IfNode,
	LoopNode,
	MergeNode,
	OperationNode,
	SortNode,
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
	| ErrorTriggerNode;

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
}) {
	return (
		<div className="flex gap-[4px] items-end">
			<div className="flex-1">
				<label className="text-[10px] text-text-muted/70">Field</label>
				<input
					type="text"
					className="w-full rounded-[6px] border border-border-muted bg-transparent px-[8px] py-[6px] text-[12px] text-text"
					value={condition.field}
					onChange={(e) =>
						onChange({ ...condition, field: e.target.value })
					}
					placeholder="e.g. status"
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
					<option value="equals">Equals</option>
					<option value="notEquals">Not Equals</option>
					<option value="contains">Contains</option>
					<option value="greaterThan">Greater Than</option>
					<option value="lessThan">Less Than</option>
					<option value="isEmpty">Is Empty</option>
					<option value="isNotEmpty">Is Not Empty</option>
					<option value="isTrue">Is True</option>
					<option value="isFalse">Is False</option>
					<option value="regex">Regex</option>
					<option value="startsWith">Starts With</option>
					<option value="endsWith">Ends With</option>
				</select>
			</div>
			<div className="flex-1">
				<label className="text-[10px] text-text-muted/70">Value</label>
				<input
					type="text"
					className="w-full rounded-[6px] border border-border-muted bg-transparent px-[8px] py-[6px] text-[12px] text-text"
					value={condition.value ?? ""}
					onChange={(e) =>
						onChange({ ...condition, value: e.target.value })
					}
					placeholder="compare value"
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
								<input
									type="text"
									className="w-full rounded-[6px] border border-border-muted bg-transparent px-[8px] py-[6px] text-[12px] text-text"
									value={op.value ?? ""}
									onChange={(e) => {
										const operations = [
											...node.content.operations,
										];
										operations[i] = {
											...op,
											value: e.target.value,
										};
										updateContent(node, { operations });
									}}
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
