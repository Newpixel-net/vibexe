import { isTriggerNode, type NodeLike } from "@giselles-ai/protocol";
import { useCallback } from "react";
import { useAppDesignerStoreApi } from "../app-designer-provider";
import { useGiselle } from "../giselle-client-provider";
import { useUpdateNodeData } from "./use-update-node-data";

/**
 * Auto-configures manual trigger nodes when they're added to the canvas.
 * Manual triggers work fine with 0 parameters — this saves users from having
 * to open the properties panel and click "Save Configuration" just to run
 * a simple workflow.
 */
export function useAutoConfigureManualTrigger() {
	const client = useGiselle();
	const store = useAppDesignerStoreApi();
	const updateNodeData = useUpdateNodeData();

	return useCallback(
		async (node: NodeLike) => {
			if (!isTriggerNode(node)) {
				return;
			}
			if (node.content.provider !== "manual") {
				return;
			}
			if (node.content.state.status !== "unconfigured") {
				return;
			}

			const { workspaceId } = store.getState();

			try {
				const { triggerId } = await client.configureTrigger({
					trigger: {
						nodeId: node.id,
						workspaceId,
						enable: true,
						configuration: {
							provider: "manual",
							event: {
								id: "manual",
								parameters: [],
							},
							staged: false,
						},
					},
				});

				const nextState = store.getState();
				const existingNode = nextState.nodes.find((n) => n.id === node.id);
				if (!existingNode || !isTriggerNode(existingNode)) {
					return;
				}
				if (existingNode.content.state.status !== "unconfigured") {
					return;
				}

				updateNodeData(existingNode, {
					content: {
						...existingNode.content,
						state: {
							status: "configured",
							flowTriggerId: triggerId,
						},
					},
				} as any);
			} catch (error) {
				console.error("Failed to auto-configure manual trigger:", error);
			}
		},
		[client, store, updateNodeData],
	);
}
