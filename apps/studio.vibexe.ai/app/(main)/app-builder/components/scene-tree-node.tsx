"use client";

/**
 * SceneTreeNode — Recursive collapsible tree node for scene hierarchy.
 * Shows type icon, name, color dot, expand/collapse for groups.
 */

import { useCallback, useState } from "react";
import {
	Box,
	ChevronDown,
	ChevronRight,
	Circle,
	Eye,
	EyeOff,
	Lightbulb,
	Folder,
	Camera,
	Video,
} from "lucide-react";
import type { SceneNode } from "../lib/game-editor-context";

interface SceneTreeNodeProps {
	node: SceneNode;
	depth: number;
	selectedUuid: string | null;
	onSelect: (uuid: string) => void;
	onDoubleClick?: (uuid: string) => void;
}

function getIcon(node: SceneNode) {
	if (node._isLight) return <Lightbulb className="w-3 h-3 text-yellow-400" />;
	if (node.type === "PerspectiveCamera" || node.type === "OrthographicCamera")
		return <Camera className="w-3 h-3 text-blue-400" />;
	if (node.type === "Scene") return <Video className="w-3 h-3 text-green-400" />;
	if (node._isMesh) return <Box className="w-3 h-3 text-cyan-400" />;
	if (node._isGroup || node.children.length > 0)
		return <Folder className="w-3 h-3 text-orange-300" />;
	return <Circle className="w-2.5 h-2.5 text-white/30" />;
}

export function SceneTreeNode({
	node,
	depth,
	selectedUuid,
	onSelect,
	onDoubleClick,
}: SceneTreeNodeProps) {
	const [expanded, setExpanded] = useState(depth < 1);
	const hasChildren = node.children.length > 0;
	const isSelected = node.uuid === selectedUuid;

	// Skip editor helpers, particles, trails
	if (
		node.name.startsWith("__editor_") ||
		node.name.startsWith("__particle_") ||
		node.name.startsWith("__trail_") ||
		node.type === "BoxHelper" ||
		node.type === "TransformControlsGizmo" ||
		node.type === "TransformControlsPlane" ||
		node.type === "GridHelper" ||
		node.type === "Points"
	) {
		return null;
	}

	const handleClick = useCallback(() => {
		onSelect(node.uuid);
	}, [node.uuid, onSelect]);

	const handleDoubleClick = useCallback(() => {
		onDoubleClick?.(node.uuid);
	}, [node.uuid, onDoubleClick]);

	const handleToggle = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			setExpanded((v) => !v);
		},
		[],
	);

	// Compute display name
	let displayName = node.name || node.type;
	if (node.userData?.vibexeType) {
		displayName = node.name || `${node.userData.vibexeType}`;
	}

	return (
		<div>
			<div
				className={`flex items-center gap-1 px-1 py-[3px] cursor-pointer rounded-sm transition-colors ${
					isSelected
						? "bg-violet-500/20 text-violet-200"
						: "hover:bg-white/[0.06] text-white/60 hover:text-white/80"
				}`}
				style={{ paddingLeft: depth * 12 + 4 }}
				onClick={handleClick}
				onDoubleClick={handleDoubleClick}
			>
				{/* Expand toggle */}
				<span
					className="w-3 h-3 flex items-center justify-center flex-shrink-0"
					onClick={hasChildren ? handleToggle : undefined}
				>
					{hasChildren ? (
						expanded ? (
							<ChevronDown className="w-3 h-3" />
						) : (
							<ChevronRight className="w-3 h-3" />
						)
					) : null}
				</span>

				{/* Icon */}
				{getIcon(node)}

				{/* Name */}
				<span className="text-[11px] truncate flex-1">{displayName}</span>

				{/* Color dot */}
				{node._materialColor && (
					<span
						className="w-2 h-2 rounded-full flex-shrink-0"
						style={{ backgroundColor: node._materialColor }}
					/>
				)}

				{/* Visibility */}
				{!node.visible && (
					<EyeOff className="w-2.5 h-2.5 text-white/20 flex-shrink-0" />
				)}
			</div>

			{/* Children */}
			{hasChildren && expanded && (
				<div>
					{node.children.map((child) => (
						<SceneTreeNode
							key={child.uuid}
							node={child}
							depth={depth + 1}
							selectedUuid={selectedUuid}
							onSelect={onSelect}
							onDoubleClick={onDoubleClick}
						/>
					))}
				</div>
			)}
		</div>
	);
}
