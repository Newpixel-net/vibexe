import type { IntegrationNode, Node } from "@giselles-ai/protocol";
import { useNodeGenerations } from "@giselles-ai/react";
import { CableIcon } from "lucide-react";
import { useCallback } from "react";
import {
	useAppDesignerStore,
	useDeleteNode,
	useUpdateNodeData,
	useWorkspaceActions,
} from "../../../app-designer";
import {
	PropertiesPanelContent,
	PropertiesPanelRoot,
} from "../ui";
import { NodePanelHeader } from "../ui/node-panel-header";

export function IntegrationNodePropertiesPanel({
	node,
}: { node: IntegrationNode }) {
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);
	const connections = useAppDesignerStore((s) => s.connections);
	const updateNodeData = useUpdateNodeData();
	const deleteNode = useDeleteNode();
	const setUiNodeState = useWorkspaceActions((a) => a.setUiNodeState);
	const { createAndStartGenerationRunner, isGenerating, stopGenerationRunner } =
		useNodeGenerations({
			nodeId: node.id,
			origin: { type: "studio", workspaceId },
		});

	const handleClick = useCallback(() => {
		if (isGenerating) {
			stopGenerationRunner();
			return;
		}

		setUiNodeState(node.id, {
			showError: false,
		});
		createAndStartGenerationRunner({
			origin: {
				type: "studio",
				workspaceId,
			},
			operationNode: node,
			sourceNodes: connections
				.filter((c) => c.inputNode.id === node.id)
				.map((c) => c.outputNode as unknown as Node)
				.filter(Boolean),
			connections: connections.filter(
				(connection) => connection.inputNode.id === node.id,
			),
		});
	}, [
		isGenerating,
		stopGenerationRunner,
		setUiNodeState,
		node,
		connections,
		createAndStartGenerationRunner,
		workspaceId,
	]);

	return (
		<PropertiesPanelRoot>
			<NodePanelHeader
				node={node}
				onChangeName={(name) => updateNodeData(node, { name })}
				onDelete={() => deleteNode(node.id)}
				icon={
					<CableIcon className="size-[16px] text-inverse" />
				}
			/>
			<PropertiesPanelContent>
				<div className="overflow-y-auto flex-1 pr-2 custom-scrollbar h-full relative">
					<div className="flex flex-col gap-4 p-4">
						<div className="flex items-center gap-2 text-sm text-text-muted">
							<CableIcon className="size-4" />
							<span>Integration Node</span>
						</div>

						<div className="flex flex-col gap-2">
							<div className="text-xs text-text-muted">Piece</div>
							<div className="text-sm text-inverse font-medium">
								{node.content.pieceName}
							</div>
						</div>

						<div className="flex flex-col gap-2">
							<div className="text-xs text-text-muted">Action</div>
							<div className="text-sm text-inverse font-medium">
								{node.content.actionName}
							</div>
						</div>

						<div className="flex flex-col gap-2">
							<div className="text-xs text-text-muted">Version</div>
							<div className="text-sm text-inverse font-medium">
								{node.content.pieceVersion}
							</div>
						</div>

						{node.content.credentialId && (
							<div className="flex flex-col gap-2">
								<div className="text-xs text-text-muted">Credential</div>
								<div className="text-sm text-inverse font-medium">
									Configured
								</div>
							</div>
						)}

						<button
							type="button"
							className="mt-4 w-full py-2 px-4 rounded-lg bg-action-node-1 text-inverse text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
							onClick={handleClick}
							disabled={isGenerating}
						>
							{isGenerating ? "Running..." : "Run Integration"}
						</button>
					</div>
				</div>
			</PropertiesPanelContent>
		</PropertiesPanelRoot>
	);
}
