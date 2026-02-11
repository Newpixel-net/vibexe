"use client";

import { defaultName } from "@giselles-ai/node-registry";
import type { NodeId, OperationNode } from "@giselles-ai/protocol";
import { ArrowRightIcon, LinkIcon } from "lucide-react";
import { useMemo } from "react";
import { useAppDesignerStore } from "../../app-designer";
import { NodeIcon } from "../../icons/node";
import { EmptyState } from "../../ui/empty-state";

export function InputPanel({ nodeId }: { nodeId: NodeId }) {
	const { nodes, connections } = useAppDesignerStore((s) => ({
		nodes: s.nodes,
		connections: s.connections,
	}));

	const inputConnections = useMemo(() => {
		// Find all non-subNode connections targeting this node
		const conns = connections.filter(
			(c) =>
				c.inputNode.id === nodeId &&
				c.connectionType !== "subNode",
		);

		return conns
			.map((conn) => {
				const sourceNode = nodes.find((n) => n.id === conn.outputNode.id);
				if (!sourceNode) return null;

				const sourceOutput = sourceNode.outputs.find(
					(o) => o.id === conn.outputId,
				);
				const targetInput = nodes
					.find((n) => n.id === nodeId)
					?.inputs.find((i) => i.id === conn.inputId);

				return {
					connectionId: conn.id,
					sourceNode,
					sourceOutput,
					targetInput,
				};
			})
			.filter(Boolean);
	}, [connections, nodes, nodeId]);

	if (inputConnections.length === 0) {
		return (
			<div className="p-[12px]">
				<EmptyState
					icon={<LinkIcon className="size-[16px]" />}
					title="No inputs connected"
					description="Connect nodes to provide input data."
					className="text-inverse/40"
				/>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-[2px] p-[8px]">
			{inputConnections.map((conn) => {
				if (!conn) return null;
				return (
					<div
						key={conn.connectionId}
						className="flex flex-col gap-[4px] rounded-[6px] bg-inverse/5 p-[8px]"
					>
						<div className="flex items-center gap-[6px]">
							<NodeIcon
								node={conn.sourceNode}
								className="size-[14px] text-inverse/60"
							/>
							<span className="text-[12px] text-inverse/80 font-medium truncate">
								{defaultName(conn.sourceNode)}
							</span>
							<ArrowRightIcon className="size-[10px] text-inverse/30 flex-shrink-0" />
							<span className="text-[11px] text-inverse/50 truncate">
								{conn.targetInput?.accessor ?? "input"}
							</span>
						</div>
						{conn.sourceOutput && (
							<div className="text-[10px] text-inverse/40 pl-[20px]">
								output: {conn.sourceOutput.accessor}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
