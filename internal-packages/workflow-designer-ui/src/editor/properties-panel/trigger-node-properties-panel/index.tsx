import type { TriggerNode } from "@vibexe-ai/protocol";
import clsx from "clsx/lite";
import { createContext, useContext, useState } from "react";
import { useDeleteNode, useUpdateNodeData } from "../../../app-designer";
import { PropertiesPanelContent, PropertiesPanelRoot } from "../ui";
import { NodePanelHeader } from "../ui/node-panel-header";
import { AppEventTriggerPropertiesPanel } from "./providers/app-event-trigger/app-event-trigger-properties-panel";
import { ChatTriggerPropertiesPanel } from "./providers/chat-trigger/chat-trigger-properties-panel";
import { GitHubTriggerPropertiesPanel } from "./providers/github-trigger/github-trigger-properties-panel";
import { ManualTriggerPropertiesPanel } from "./providers/manual-trigger/manual-trigger-properties-panel";
import { ScheduleTriggerPropertiesPanel } from "./providers/schedule-trigger/schedule-trigger-properties-panel";
import { WebhookTriggerPropertiesPanel } from "./providers/webhook-trigger/webhook-trigger-properties-panel";

export function TriggerNodePropertiesPanel({ node }: { node: TriggerNode }) {
	const updateNodeData = useUpdateNodeData();
	const deleteNode = useDeleteNode();
	const [scrollMode, setScrollMode] = useState<"limited" | "full">("full");
	return (
		<PropertiesPanelRoot>
			<NodePanelHeader
				node={node}
				onChangeName={(name) => updateNodeData(node, { name })}
				docsUrl="https://docs.vibexe.ai/en/glossary/trigger-node"
				onDelete={() => deleteNode(node.id)}
			/>
			<PropertiesPanelContent>
				<PanelScrollModeContext.Provider value={setScrollMode}>
					<div
						className={clsx(
							"relative custom-scrollbar overflow-y-auto",
							scrollMode === "limited" ? "max-h-[560px]" : "h-full flex-1",
						)}
					>
						<PropertiesPanel node={node} />
					</div>
				</PanelScrollModeContext.Provider>
			</PropertiesPanelContent>
		</PropertiesPanelRoot>
	);
}
function PropertiesPanel({ node }: { node: TriggerNode }) {
	switch (node.content.provider) {
		case "github":
			return <GitHubTriggerPropertiesPanel node={node} />;
		case "manual":
			return <ManualTriggerPropertiesPanel node={node} />;
		case "schedule":
			return <ScheduleTriggerPropertiesPanel node={node} />;
		case "webhook":
			return <WebhookTriggerPropertiesPanel node={node} />;
		case "chat":
			return <ChatTriggerPropertiesPanel node={node} />;
		case "appEvent":
			return <AppEventTriggerPropertiesPanel node={node} />;
		default: {
			const _exhaustiveCheck: never = node.content.provider;
			throw new Error(`Unhandled action: ${_exhaustiveCheck}`);
		}
	}
}

const PanelScrollModeContext = createContext<
	(mode: "limited" | "full") => void
>(() => {});

export function usePanelScrollMode() {
	return useContext(PanelScrollModeContext);
}
