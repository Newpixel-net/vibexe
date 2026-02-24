import { getPieceCategoryColor } from "@vibexe-ai/activepieces-adapter";
import type { NodeId } from "@vibexe-ai/protocol";
import { useNodeGenerations } from "@vibexe-ai/react";
import { BaseEdge, type EdgeProps, getBezierPath } from "@xyflow/react";
import clsx from "clsx/lite";
import type { PropsWithChildren } from "react";
import { useShallow } from "zustand/shallow";
import { useAppDesignerStore } from "../../app-designer";
import { STAGE_NODE_COLOR_VAR } from "../node/node-utils";

function ConnectedNodeRunning({
	inputNodeId,
	children,
}: PropsWithChildren<{
	inputNodeId: NodeId;
}>) {
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);
	const { currentGeneration: inputNodeCurrentGeneration } = useNodeGenerations({
		nodeId: inputNodeId,
		origin: { type: "studio", workspaceId },
	});
	if (
		inputNodeCurrentGeneration?.status === "queued" ||
		inputNodeCurrentGeneration?.status === "running"
	) {
		return children;
	}
	return null;
}

const edgeColorMap: Record<string, string> = {
	textGeneration: "var(--color-generation-node-1)",
	contentGeneration: "var(--color-generation-node-1)",
	aiAgent: "var(--color-generation-node-1)",
	chatModel: "var(--color-generation-node-1)",
	toolNode: "var(--color-generation-node-1)",
	memoryNode: "var(--color-generation-node-1)",
	file: "var(--color-file-node-1)",
	webPage: "var(--color-webPage-node-1)",
	text: "var(--color-text-node-1)",
	imageGeneration: "var(--color-image-generation-node-1)",
	trigger: "var(--color-trigger-node-1)",
	action: "var(--color-action-node-1)",
	query: "var(--color-query-node-1)",
	dataQuery: "var(--color-data-query-node-1)",
	vectorStore: "var(--color-vector-store-node-1)",
	dataStore: "var(--color-data-store-node-1)",
	integration: "var(--color-integration-node-1)",
	github: "var(--color-github-node-1)",
	appEntry: STAGE_NODE_COLOR_VAR,
	end: STAGE_NODE_COLOR_VAR,
	// Flow control nodes
	if: "var(--color-branching-node-1)",
	switch: "var(--color-branching-node-1)",
	merge: "var(--color-merge-node-1)",
	loop: "var(--color-flow-control-node-1)",
	wait: "var(--color-wait-node-1)",
	// Data transform nodes
	code: "var(--color-data-transform-node-1)",
	filter: "var(--color-data-processing-node-1)",
	editFields: "var(--color-data-processing-node-1)",
	sort: "var(--color-data-processing-node-1)",
	// Error & storage
	errorTrigger: "var(--color-error-trigger-node-1)",
	dataTable: "var(--color-data-store-node-1)",
	formTrigger: "var(--color-trigger-node-1)",
	// Wave 10 nodes
	executeSubWorkflow: "var(--color-flow-control-node-1)",
	respondToWebhook: "var(--color-flow-control-node-1)",
	customVariables: "var(--color-data-processing-node-1)",
	// Wave 12 data transform nodes
	aggregate: "var(--color-data-processing-node-1)",
	summarize: "var(--color-data-processing-node-1)",
	limit: "var(--color-data-processing-node-1)",
	removeDuplicates: "var(--color-data-processing-node-1)",
	renameKeys: "var(--color-data-processing-node-1)",
	splitOut: "var(--color-data-processing-node-1)",
	compareDatasets: "var(--color-data-processing-node-1)",
};

function getNodeEdgeColor(nodeContent: {
	type: string;
	[key: string]: unknown;
}): string {
	// Integration nodes use per-piece category colors (purple, red, orange, etc.)
	if (
		nodeContent.type === "integration" &&
		typeof nodeContent.pieceName === "string"
	) {
		const pieceColor = getPieceCategoryColor(nodeContent.pieceName);
		if (pieceColor) return pieceColor;
	}

	return edgeColorMap[nodeContent.type] ?? "var(--color-primary-900)";
}

export function Connector({
	id,
	sourceX,
	sourceY,
	sourcePosition,
	targetX,
	targetY,
	targetPosition,
}: EdgeProps) {
	const { connection, outputNodeContent, inputNodeContent } =
		useAppDesignerStore(
			useShallow((s) => {
				const conn = s.connections.find(
					(connection) => connection.id === id,
				);
				if (!conn) return { connection: undefined, outputNodeContent: undefined, inputNodeContent: undefined };
				// Look up full nodes from store to get complete content (including pieceName for integrations)
				const fullOutputNode = s.nodes.find(
					(n) => n.id === conn.outputNode.id,
				);
				const fullInputNode = s.nodes.find(
					(n) => n.id === conn.inputNode.id,
				);
				return {
					connection: conn,
					outputNodeContent: fullOutputNode?.content ?? conn.outputNode.content,
					inputNodeContent: fullInputNode?.content ?? conn.inputNode.content,
				};
			}),
		);
	if (connection === undefined || !outputNodeContent || !inputNodeContent) {
		return null;
	}

	const isSubNodeConnection = connection.connectionType === "subNode";

	const [edgePath] = getBezierPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
	});

	const outputContentType = outputNodeContent.type;
	const inputContentType = inputNodeContent.type;
	const gradientId = `gradient-${id}`;
	const filterId = `glow-${id}`;
	const startColor = getNodeEdgeColor(outputNodeContent);
	const endColor = getNodeEdgeColor(inputNodeContent);

	// Calculate direction vector for animation
	const dx = targetX - sourceX;
	const dy = targetY - sourceY;
	const distance = Math.sqrt(dx * dx + dy * dy);
	const unitDx = distance > 0 ? dx / distance : 0;
	const unitDy = distance > 0 ? dy / distance : 0;

	// Animation distance (2x the path length for smooth animation)
	const animationDistance = distance * 2;

	return (
		<g
			className="group"
			data-output-node-type={connection.outputNode.type}
			data-output-node-content-type={outputContentType}
			data-input-node-type={connection.inputNode.type}
			data-input-node-content-type={inputContentType}
			data-sub-node-connection={isSubNodeConnection || undefined}
		>
			<defs>
				<filter
					id={filterId}
					filterUnits="userSpaceOnUse"
					x={Math.min(sourceX, targetX) - 10}
					y={Math.min(sourceY, targetY) - 10}
					width={Math.abs(targetX - sourceX) + 20}
					height={Math.abs(targetY - sourceY) + 20}
				>
					<feGaussianBlur stdDeviation="3.5" result="blur" />
					<feComposite in="SourceGraphic" in2="blur" operator="over" />
				</filter>
				<linearGradient
					id={gradientId}
					gradientUnits="userSpaceOnUse"
					x1={sourceX}
					y1={sourceY}
					x2={targetX}
					y2={targetY}
				>
					<stop offset="0%" stopColor={startColor} />
					<stop offset="100%" stopColor={endColor} />
				</linearGradient>
				<linearGradient
					id={`${gradientId}-animation`}
					gradientUnits="userSpaceOnUse"
					x1={sourceX}
					y1={sourceY}
					x2={targetX}
					y2={targetY}
				>
					<stop offset="0%" stopColor="rgba(255,255,255,0)" />
					<stop offset="25%" stopColor="rgba(255,255,255,0)" />
					<stop offset="49%" stopColor="rgba(255,255,255,0.4)" />
					<stop offset="51%" stopColor="rgba(255,255,255,0.4)" />
					<stop offset="75%" stopColor="rgba(255,255,255,0)" />
					<stop offset="100%" stopColor="rgba(255,255,255,0)" />
					<animate
						attributeName="x1"
						from={sourceX - animationDistance * unitDx}
						to={targetX + animationDistance * unitDx}
						dur="1.8s"
						repeatCount="indefinite"
					/>
					<animate
						attributeName="x2"
						from={sourceX}
						to={targetX + 2 * animationDistance * unitDx}
						dur="1.8s"
						repeatCount="indefinite"
					/>
					<animate
						attributeName="y1"
						from={sourceY - animationDistance * unitDy}
						to={targetY + animationDistance * unitDy}
						dur="1.8s"
						repeatCount="indefinite"
					/>
					<animate
						attributeName="y2"
						from={sourceY}
						to={targetY + 2 * animationDistance * unitDy}
						dur="1.8s"
						repeatCount="indefinite"
					/>
				</linearGradient>
			</defs>
			<BaseEdge
				id={id}
				path={edgePath}
				className={clsx("!stroke-[2px] bg-bg")}
				style={{
					stroke: `url(#${gradientId})`,
					...(isSubNodeConnection ? { strokeDasharray: "6 4" } : {}),
				}}
				filter={`url(#${filterId})`}
			/>
			{!isSubNodeConnection && (
				<ConnectedNodeRunning inputNodeId={connection.inputNode.id}>
					<path
						d={edgePath}
						stroke={`url(#${gradientId}-animation)`}
						strokeWidth="2"
						fill="none"
						strokeLinecap="round"
						filter={`url(#${filterId})`}
					/>
				</ConnectedNodeRunning>
			)}
		</g>
	);
}

/** @deprecated Filter is now defined inline in each Connector's defs */
export function GradientDef() {
	return null;
}
