import { createEndNode } from "@vibexe-ai/node-registry";
import { isAppEntryNode, type Node } from "@vibexe-ai/protocol";
import { useMemo } from "react";
import { CircleNode } from "../../node/circle-node";
import { PillNode } from "../../node/pill-node";
import { SmallCircleNode } from "../../node/small-circle-node";
import { WideNode } from "../../node/wide-node";
import { NodeComponent } from "../../node/card-node";
import { useMousePosition } from "./state";

function PreviewConnector() {
	return (
		<svg
			aria-hidden="true"
			className="text-inverse/40"
			width="28"
			height="12"
			viewBox="0 0 28 12"
			fill="none"
		>
			<path d="M0 6H24" stroke="currentColor" strokeWidth="1.5" />
			<path
				d="M20 2L24 6L20 10"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function ShapePreview({ node }: { node: Node }) {
	const contentType = node.content.type;
	switch (contentType) {
		case "appEntry":
		case "end":
			return <PillNode node={node} preview />;
		case "trigger":
		case "formTrigger":
		case "errorTrigger":
			return <CircleNode node={node} preview />;
		case "aiAgent":
			return <WideNode node={node} preview />;
		case "chatModel":
		case "toolNode":
		case "memoryNode":
			return <SmallCircleNode node={node} preview />;
		default:
			return <NodeComponent node={node} preview />;
	}
}

export const FloatingNodePreview = ({ node }: { node: Node }) => {
	const mousePosition = useMousePosition();
	const isAppEntry = isAppEntryNode(node);
	const endNode = useMemo(
		() => (isAppEntry ? createEndNode() : null),
		[isAppEntry],
	);

	return (
		<div
			className="fixed pointer-events-none inset-0"
			style={{
				transform: `translate(${mousePosition.x}px, ${mousePosition.y}px)`,
			}}
		>
			<div className={isAppEntry ? "w-max" : "w-max"}>
				{isAppEntry ? (
					<div className="flex items-center gap-[12px]">
						<PillNode node={node} preview />
						<PreviewConnector />
						{endNode && <PillNode node={endNode} preview />}
					</div>
				) : (
					<ShapePreview node={node} />
				)}
			</div>
		</div>
	);
};
