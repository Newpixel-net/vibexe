"use client";

/**
 * SceneTreeNode — Recursive collapsible tree node for scene hierarchy.
 * Shows type icon, name, color dot, expand/collapse for groups.
 * Visibility toggle via eye icon click.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
	Box,
	ChevronDown,
	ChevronRight,
	Circle,
	Diamond,
	Eye,
	EyeOff,
	Lightbulb,
	Folder,
	Camera,
	Video,
	Shield,
	TreePine,
	User,
	Star,
} from "lucide-react";
import type { SceneNode } from "../lib/game-editor-context";

interface SceneTreeNodeProps {
	node: SceneNode;
	depth: number;
	selectedUuid: string | null;
	onSelect: (uuid: string) => void;
	onDoubleClick?: (uuid: string) => void;
	onToggleVisibility?: (uuid: string) => void;
	searchFilter?: string;
}

function getIcon(node: SceneNode) {
	if (node._isLight) return <Lightbulb className="w-3 h-3 text-yellow-400" />;
	if (node.type === "PerspectiveCamera" || node.type === "OrthographicCamera")
		return <Camera className="w-3 h-3 text-blue-400" />;
	if (node.type === "Scene") return <Video className="w-3 h-3 text-green-400" />;

	// Vibexe factory-based icons
	const factory = node.userData?.vibexeFactory;
	if (factory === "createCollectible3D") return <Star className="w-3 h-3 text-yellow-400" />;
	if (factory === "createBarrier3D") return <Shield className="w-3 h-3 text-red-400" />;
	if (factory === "createDecoration3D") return <TreePine className="w-3 h-3 text-emerald-400" />;
	if (factory === "createPlayer3D") return <User className="w-3 h-3 text-violet-400" />;
	if (factory === "createAnimatedCharacter3D" || factory === "animatedCharacter") return <User className="w-3 h-3 text-amber-400" />;
	if (factory === "createPlatform3D") return <Box className="w-3 h-3 text-blue-400" />;

	if (node._isMesh) return <Box className="w-3 h-3 text-cyan-400" />;
	if (node._isGroup || node.children.length > 0)
		return <Folder className="w-3 h-3 text-orange-300" />;
	return <Circle className="w-2.5 h-2.5 text-white/30" />;
}

// Check if node or any descendant matches a search filter
function nodeMatchesSearch(node: SceneNode, filter: string): boolean {
	const name = (node.name || node.type).toLowerCase();
	if (name.includes(filter)) return true;
	if (node.children) {
		for (const child of node.children) {
			if (nodeMatchesSearch(child, filter)) return true;
		}
	}
	return false;
}

export function SceneTreeNode({
	node,
	depth,
	selectedUuid,
	onSelect,
	onDoubleClick,
	onToggleVisibility,
	searchFilter,
}: SceneTreeNodeProps) {
	const [expanded, setExpanded] = useState(depth < 1);
	const hasChildren = node.children.length > 0;
	const isSelected = node.uuid === selectedUuid;
	const rowRef = useRef<HTMLDivElement>(null);

	// Auto-expand when search filter is active and node matches
	useEffect(() => {
		if (searchFilter && hasChildren && nodeMatchesSearch(node, searchFilter)) {
			setExpanded(true);
		}
	}, [searchFilter, hasChildren, node]);

	// Auto-scroll to selected node when selection changes from viewport click
	useEffect(() => {
		if (isSelected && rowRef.current) {
			rowRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
		}
	}, [isSelected]);

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

	// Filter by search — hide non-matching nodes (unless they have matching children)
	if (searchFilter && !nodeMatchesSearch(node, searchFilter)) {
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

	const handleVisibilityToggle = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			onToggleVisibility?.(node.uuid);
		},
		[node.uuid, onToggleVisibility],
	);

	// Compute display name
	let displayName = node.name || node.type;
	if (node.userData?.vibexeType) {
		displayName = node.name || `${node.userData.vibexeType}`;
	}

	return (
		<div>
			<div
				ref={rowRef}
				className={`group/node flex items-center gap-1 px-1 py-[3px] cursor-pointer rounded-sm transition-colors ${
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

				{/* Visibility toggle — always show if hidden, show on hover if visible */}
				{onToggleVisibility && (
					<span
						className="flex-shrink-0 cursor-pointer"
						onClick={handleVisibilityToggle}
						title={node.visible ? "Hide" : "Show"}
					>
						{node.visible ? (
							<Eye className="w-2.5 h-2.5 text-white/0 group-hover/node:text-white/20 hover:!text-white/50 transition-colors" />
						) : (
							<EyeOff className="w-2.5 h-2.5 text-white/30 hover:text-white/50 transition-colors" />
						)}
					</span>
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
							onToggleVisibility={onToggleVisibility}
							searchFilter={searchFilter}
						/>
					))}
				</div>
			)}
		</div>
	);
}
