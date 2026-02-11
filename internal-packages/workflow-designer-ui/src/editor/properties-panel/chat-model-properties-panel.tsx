import {
	getEntry,
	type LanguageModelId,
	type LanguageModelTier,
} from "@giselles-ai/language-model-registry";
import type { ChatModelNode } from "@giselles-ai/protocol";
import { useUsageLimits } from "@giselles-ai/react";
import { useCallback, useMemo } from "react";
import {
	useDeleteNode,
	useUpdateNodeData,
	useUpdateNodeDataContent,
} from "../../app-designer";
import { ModelPickerV2 } from "../../ui/model-picker-v2";
import { PropertiesPanelRoot } from "./ui";
import { NodePanelHeader } from "./ui/node-panel-header";
import { SettingDetail, SettingLabel } from "./ui/setting-label";
import { ConfigurationFormField } from "./text-generation-node-properties-panel-v2/model/configuration-form-field";

export function ChatModelPropertiesPanel({
	node,
}: {
	node: ChatModelNode;
}) {
	const updateNodeData = useUpdateNodeData();
	const updateNodeDataContent = useUpdateNodeDataContent();
	const deleteNode = useDeleteNode();
	const usageLimits = useUsageLimits();
	const userTier: LanguageModelTier = usageLimits?.featureTier ?? "free";

	const currentLanguageModel = useMemo(
		() => getEntry(node.content.languageModel.id),
		[node.content.languageModel.id],
	);

	const handleLanguageModelIdChange = useCallback(
		(value: LanguageModelId) => {
			const languageModel = getEntry(value);
			updateNodeDataContent(node, {
				languageModel: {
					id: languageModel.id,
					provider: languageModel.providerId,
					configuration: languageModel.defaultConfiguration,
				},
			});
		},
		[node, updateNodeDataContent],
	);

	function isDefaultConfigKey(
		k: string,
	): k is keyof typeof currentLanguageModel.defaultConfiguration {
		return k in currentLanguageModel.defaultConfiguration;
	}

	return (
		<PropertiesPanelRoot>
			<NodePanelHeader
				node={node}
				onChangeName={(name) => updateNodeData(node, { name })}
				onDelete={() => deleteNode(node.id)}
			/>
			<div className="flex flex-col gap-[16px] px-[16px] py-[8px] overflow-y-auto">
				{/* Model Picker */}
				<div className="flex items-center justify-between gap-[12px]">
					<SettingDetail size="md">Model</SettingDetail>
					<ModelPickerV2
						userTier={userTier}
						value={node.content.languageModel.id}
						onValueChange={handleLanguageModelIdChange}
					/>
				</div>

				{/* Model Configuration */}
				<SettingLabel>Model parameters</SettingLabel>
				<div className="col-span-2 flex flex-col gap-[12px]">
					{Object.entries(currentLanguageModel.configurationOptions).map(
						([key, option]) => {
							if (!isDefaultConfigKey(key)) return null;
							const currentValue =
								node.content.languageModel.configuration[key] ??
								currentLanguageModel.defaultConfiguration[key];
							return (
								<ConfigurationFormField
									key={key}
									name={key}
									option={option}
									value={currentValue}
									defaultValue={currentLanguageModel.defaultConfiguration[key]}
									onValueChange={(value: unknown) => {
										updateNodeDataContent(node, {
											languageModel: {
												...node.content.languageModel,
												configuration: {
													...node.content.languageModel.configuration,
													[key]: value,
												},
											},
										});
									}}
								/>
							);
						},
					)}
				</div>
			</div>
		</PropertiesPanelRoot>
	);
}
