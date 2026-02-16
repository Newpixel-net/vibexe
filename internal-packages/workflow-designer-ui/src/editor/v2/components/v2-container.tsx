"use client";

import {
	InputId,
	isAppEntryNode,
	isEndNode,
	isTriggerNode,
	type NodeId,
} from "@giselles-ai/protocol";
import { createAppEntryNode, createChatModelNode, createToolNodeNode, createMemoryNodeNode } from "@giselles-ai/node-registry";
import {
	type Connection,
	type Edge,
	type IsValidConnection,
	MiniMap,
	type NodeMouseHandler,
	type OnEdgesChange,
	type OnMoveEnd,
	type OnNodesChange,
	ReactFlow,
	type Node as RFNode,
	useNodesInitialized,
	useReactFlow,
	useUpdateNodeInternals,
	useViewport,
	Panel as XYFlowPanel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useToasts } from "@giselle-internal/ui/toast";
import { isSupportedConnection } from "@giselles-ai/react";
import clsx from "clsx/lite";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useShallow } from "zustand/shallow";
import {
	ConfirmProvider,
	useAddAppEntryWithEndNodes,
	useAddConnection,
	useAddNode,
	useAppDesignerStore,
	useAppDesignerStoreApi,
	useClearSelection,
	useConnectNodes,
	useDeleteNodes,
	useDeselectConnection,
	useSelectConnection,
	useSelectSingleNode,
	useSetCurrentShortcutScope,
	useUndoRedoActions,
	useWorkspaceActions,
} from "../../../app-designer";
import { Background } from "../../../ui/background";
import { edgeTypes } from "../../connector";
import { GradientDef } from "../../connector/component";
import { ContextMenu } from "../../context-menu";
import type { ContextMenuProps } from "../../context-menu/types";
import { useAutoArrange } from "../../hooks/use-auto-arrange";
import { useExecuteToHere } from "../../hooks/use-execute-to-here";
import { useKeyboardShortcuts } from "../../hooks/use-keyboard-shortcuts";
import {
	CardXyFlowNode,
	CircleXyFlowNode,
	DiamondXyFlowNode,
	HexagonXyFlowNode,
	PillXyFlowNode,
	SmallCircleXyFlowNode,
	WideXyFlowNode,
} from "../../node";
import { StickyNoteNode } from "../../node/sticky-note-node";
import { PropertiesPanel } from "../../properties-panel";
import { RunHistoryTable } from "../../run-history/run-history-table";
import { useDebugSessionStore } from "../../debug-session-store";
import { SecretTable } from "../../secret/secret-table";
import { FloatingNodePreview, Toolbar, useToolbar } from "../../tool";
import type { V2LayoutState } from "../state";
import { AppSetupHint } from "./app-setup-hint";
import { FloatingPropertiesPanel } from "./floating-properties-panel";
import { ImportWarningBanner } from "./import-warning-banner";
import { LeftPanel } from "./left-panel";
import { TriggerPickerOverlay } from "./trigger-picker-overlay";
import { WhatHappensNextPanel } from "./what-happens-next-panel";

interface V2ContainerProps extends V2LayoutState {
	onLeftPanelClose: () => void;
}

function DebugBanner() {
	const debugSession = useDebugSessionStore((s) => s.debugSession);
	const exitDebug = useDebugSessionStore((s) => s.exitDebugSession);

	if (!debugSession) return null;

	const date = new Date(debugSession.createdAt);
	const timeStr = date.toLocaleString();

	return (
		<div className="flex items-center gap-3 px-4 py-2 bg-purple-600/20 border-b border-purple-500/30 z-50">
			<div className="size-2 rounded-full bg-purple-400 animate-pulse" />
			<span className="text-[11px] text-purple-300 font-medium">
				Debugging run from {timeStr}
			</span>
			<span className="text-[10px] text-purple-400/60">
				{debugSession.taskName}
			</span>
			<div className="flex-1" />
			<button
				type="button"
				onClick={exitDebug}
				className="px-3 py-1 text-[10px] font-medium rounded-[4px] bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 border border-purple-500/30 transition-colors"
			>
				Exit Debug
			</button>
		</div>
	);
}

function DebugWorkspacePanel() {
	const [isEnabled, setIsEnabled] = useState(false);

	useEffect(() => {
		if (process.env.NODE_ENV === "production") return;
		const params = new URLSearchParams(window.location.search);
		setIsEnabled(params.get("debugPanel") === "1");
	}, []);

	const debug = useAppDesignerStore(
		useShallow((s) => ({
			hasStartNode: s.hasStartNode(),
			hasEndNode: s.hasEndNode(),
			isStartNodeConnectedToEndNode: s.isStartNodeConnectedToEndNode(),
			nodeCount: s.nodes.length,
			connectionCount: s.connections.length,
			// IMPORTANT: keep snapshot stable (no new arrays/objects) to avoid
			// "The result of getSnapshot should be cached..." warning.
			startNodeIdsText: s.nodes
				.filter((node) => isAppEntryNode(node))
				.map((node) => node.id)
				.join(", "),
			endNodeIdsText: s.nodes
				.filter((node) => isEndNode(node))
				.map((node) => node.id)
				.join(", "),
		})),
	);

	if (!isEnabled) return null;

	return (
		<XYFlowPanel position="top-right">
			<div className="rounded-md border border-border bg-bg/80 backdrop-blur px-3 py-2 text-xs">
				<div className="font-semibold">Debug</div>
				<div className="mt-1 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
					<div className="text-muted-foreground">hasStartNode</div>
					<div>{String(debug.hasStartNode)}</div>
					<div className="text-muted-foreground">hasEndNode</div>
					<div>{String(debug.hasEndNode)}</div>
					<div className="text-muted-foreground">connected</div>
					<div>{String(debug.isStartNodeConnectedToEndNode)}</div>
					<div className="text-muted-foreground">nodes</div>
					<div>{debug.nodeCount}</div>
					<div className="text-muted-foreground">connections</div>
					<div>{debug.connectionCount}</div>
				</div>

				<details className="mt-2">
					<summary className="cursor-pointer select-none text-muted-foreground">
						IDs
					</summary>
					<div className="mt-1 space-y-1">
						<div>
							<span className="text-muted-foreground">start:</span>{" "}
							{debug.startNodeIdsText || "-"}
						</div>
						<div>
							<span className="text-muted-foreground">end:</span>{" "}
							{debug.endNodeIdsText || "-"}
						</div>
					</div>
				</details>
			</div>
		</XYFlowPanel>
	);
}

function getXyNodeType(contentType: string): string {
	switch (contentType) {
		case "appEntry":
		case "end":
			return "pill";
		case "trigger":
		case "formTrigger":
		case "errorTrigger":
			return "circle"; // D-shape trigger
		case "aiAgent":
			return "wide"; // N8N configurable: 256x96 horizontal
		case "chatModel":
		case "toolNode":
		case "memoryNode":
			return "smallCircle"; // N8N configuration: 80x80 circle
		case "code":
			return "hexagon"; // Hexagon shape for Code node
		default:
			return "card"; // N8N default: 96x96 rounded square
	}
}

/** Zoom level indicator - bottom right above minimap */
function ZoomIndicator() {
	const { zoom } = useViewport();
	const zoomPercent = Math.round(zoom * 100);
	const reactFlowInstance = useReactFlow();

	return (
		<XYFlowPanel position="bottom-right" className="mr-[8px] mb-[140px]">
			<button
				type="button"
				onClick={() => reactFlowInstance.fitView({ padding: 0.2, duration: 300 })}
				className="rounded-[6px] bg-black/60 backdrop-blur-sm border border-white/10 px-[8px] py-[3px] text-[11px] text-white/50 hover:text-white/80 transition-colors cursor-pointer"
				title="Click to fit view"
			>
				{zoomPercent}%
			</button>
		</XYFlowPanel>
	);
}

function V2NodeCanvas() {
	const { nodes, connections, nodeState, viewport, selectedConnectionIds, stickyNotes } =
		useAppDesignerStore((s) => ({
			nodes: s.nodes,
			connections: s.connections,
			nodeState: s.ui.nodeState,
			viewport: s.ui.viewport,
			selectedConnectionIds: s.ui.selectedConnectionIds ?? [],
			stickyNotes: s.stickyNotes ?? [],
		}));
	const { setUiNodeState, setUiViewport, addStickyNote, updateStickyNote, removeStickyNote, removeConnectionById } = useWorkspaceActions((a) => ({
		setUiNodeState: a.setUiNodeState,
		setUiViewport: a.setUiViewport,
		addStickyNote: a.addStickyNote,
		updateStickyNote: a.updateStickyNote,
		removeStickyNote: a.removeStickyNote,
		removeConnectionById: a.removeConnectionById,
	}));
	const deleteNodes = useDeleteNodes();
	const selectConnection = useSelectConnection();
	const deselectConnection = useDeselectConnection();
	const addNode = useAddNode();
	const addAppEntryWithEndNodes = useAddAppEntryWithEndNodes();
	const selectSingleNode = useSelectSingleNode();
	const clearSelection = useClearSelection();
	const setCurrentShortcutScope = useSetCurrentShortcutScope();
	const { selectedTool, reset } = useToolbar();
	const connectNodes = useConnectNodes();
	const toast = useToasts();
	const [menu, setMenu] = useState<Omit<ContextMenuProps, "onClose" | "onSelectAll" | "onFitView" | "onExecuteToHere" | "onTidyUp"> | null>(
		null,
	);
	const [snapToGrid, setSnapToGrid] = useState(false);
	const reactFlowRef = useRef<HTMLDivElement>(null);
	const didInitialAutoFitViewRef = useRef(false);
	const autoArrange = useAutoArrange();
	const executeToHere = useExecuteToHere();

	const reactFlowInstance = useReactFlow();
	const updateNodeInternals = useUpdateNodeInternals();
	const { handleKeyDown } = useKeyboardShortcuts();
	const nodesInitialized = useNodesInitialized();

	// Trigger-flow mode: check if workspace has trigger nodes but no appEntry
	const hasTriggerNode = useMemo(
		() => nodes.some((n) => isTriggerNode(n)),
		[nodes],
	);
	const hasAppEntryNode = useMemo(
		() => nodes.some((n) => isAppEntryNode(n)),
		[nodes],
	);
	const isTriggerFlowMode = hasTriggerNode && !hasAppEntryNode;
	const nodeTypes = useMemo(
		() => ({
			card: CardXyFlowNode,
			pill: PillXyFlowNode,
			circle: CircleXyFlowNode,
			diamond: DiamondXyFlowNode, // backward compat alias → card
			smallCircle: SmallCircleXyFlowNode,
			wide: WideXyFlowNode,
			hexagon: HexagonXyFlowNode,
			stickyNote: StickyNoteNode,
		}),
		[],
	);

	const cacheNodesRef = useRef<Map<NodeId, RFNode>>(new Map());
	const reactFlowNodes = useMemo(() => {
		const next = new Map<NodeId, RFNode>();
		const arr = nodes
			.map((node) => {
				const nodeUiState = nodeState[node.id];
				const prev = cacheNodesRef.current.get(node.id);
				const xyNodeType = getXyNodeType(node.content.type);
				if (nodeUiState === undefined) {
					return null;
				}
				if (
					prev !== undefined &&
					prev.type === xyNodeType &&
					prev.selected === nodeUiState.selected &&
					prev.position.x === nodeUiState.position.x &&
					prev.position.y === nodeUiState.position.y &&
					prev.measured?.width === nodeUiState.measured?.width &&
					prev.measured?.height === nodeUiState.measured?.height
				) {
					next.set(node.id, prev);
					return prev;
				}
				const nextNode: RFNode = {
					id: node.id,
					type: xyNodeType,
					position: nodeUiState.position,
					selected: nodeUiState.selected,
					measured: nodeUiState.measured,
					data: {},
				};
				updateNodeInternals(node.id);
				next.set(node.id, nextNode);
				return nextNode;
			})
			.filter((node) => node !== null);
		cacheNodesRef.current = next;

		// Append sticky notes as ReactFlow nodes
		const stickyRfNodes: RFNode[] = stickyNotes.map((note) => ({
			id: `sticky-${note.id}`,
			type: "stickyNote" as const,
			position: note.position,
			zIndex: -1,
			style: { width: note.size.width, minHeight: note.size.height },
			data: {
				text: note.text,
				color: note.color,
				size: note.size,
				onUpdate: (id: string, updates: Record<string, unknown>) => {
					const noteId = id.replace("sticky-", "");
					updateStickyNote(noteId, updates as any);
				},
			},
			draggable: true,
		}));

		return [...arr, ...stickyRfNodes];
	}, [nodes, nodeState, updateNodeInternals, stickyNotes, updateStickyNote]);

	useEffect(() => {
		if (didInitialAutoFitViewRef.current) {
			return;
		}
		if (!nodesInitialized) {
			return;
		}

		const pane = reactFlowRef.current?.getBoundingClientRect();
		if (!pane) {
			return;
		}

		const internalNodes = reactFlowInstance.getNodes();
		if (internalNodes.length === 0) {
			didInitialAutoFitViewRef.current = true;
			return;
		}

		const topLeft = reactFlowInstance.screenToFlowPosition({
			x: pane.left,
			y: pane.top,
		});
		const bottomRight = reactFlowInstance.screenToFlowPosition({
			x: pane.right,
			y: pane.bottom,
		});

		const viewportRect = {
			minX: Math.min(topLeft.x, bottomRight.x),
			minY: Math.min(topLeft.y, bottomRight.y),
			maxX: Math.max(topLeft.x, bottomRight.x),
			maxY: Math.max(topLeft.y, bottomRight.y),
		};

		const isAnyNodeVisible = internalNodes.some((node) => {
			const position = node.position;
			const width = node.measured?.width ?? node.width ?? 0;
			const height = node.measured?.height ?? node.height ?? 0;

			if (width <= 0 || height <= 0) {
				return false;
			}

			const nodeRect = {
				minX: position.x,
				minY: position.y,
				maxX: position.x + width,
				maxY: position.y + height,
			};

			return (
				nodeRect.minX <= viewportRect.maxX &&
				nodeRect.maxX >= viewportRect.minX &&
				nodeRect.minY <= viewportRect.maxY &&
				nodeRect.maxY >= viewportRect.minY
			);
		});

		if (!isAnyNodeVisible) {
			reactFlowInstance.fitView({ padding: 0.2 });
		}

		didInitialAutoFitViewRef.current = true;
	}, [nodesInitialized, reactFlowInstance]);

	// Listen for "add-sticky-note" events from Shift+S shortcut
	useEffect(() => {
		const handler = () => {
			const center = reactFlowInstance.screenToFlowPosition({
				x: window.innerWidth / 2,
				y: window.innerHeight / 2,
			});
			addStickyNote({
				id: `note-${Date.now()}`,
				text: "",
				color: "yellow",
				position: { x: center.x, y: center.y },
				size: { width: 200, height: 150 },
			});
		};
		window.addEventListener("add-sticky-note", handler);
		return () => window.removeEventListener("add-sticky-note", handler);
	}, [reactFlowInstance, addStickyNote]);

	const cacheEdgesRef = useRef<Map<string, Edge>>(new Map());
	const edges = useMemo(() => {
		const next = new Map<string, Edge>();
		const arr = connections.map((connection) => {
			const prev = cacheEdgesRef.current.get(connection.id);
			const selected = selectedConnectionIds.includes(connection.id);
			if (prev !== undefined && selected === prev.selected) {
				return prev;
			}

			// Resolve handle IDs: map connection outputId/inputId to actual Handle id props
			// on the node components. Without this mapping, ReactFlow can't find the handles
			// and silently drops edges.
			let sourceHandle: string | undefined;
			let targetHandle: string | undefined;

			if (connection.connectionType === "subNode") {
				// Sub-node connections: source has id="parent", target has named sub-node handles
				sourceHandle = "parent";
				const subType = connection.outputNode.content.type;
				if (subType === "chatModel") targetHandle = "chatModel";
				else if (subType === "memoryNode") targetHandle = "memory";
				else if (subType === "toolNode") targetHandle = "tool";
			} else {
				// Multi-output source nodes: map outputId to the named handle ID
				const sourceNode = nodes.find((n) => n.id === connection.outputNode.id);
				if (sourceNode) {
					const ct = sourceNode.content.type;
					if (ct === "if" || ct === "loop" || ct === "filter") {
						const idx = sourceNode.type === "operation"
							? (sourceNode as any).outputs?.findIndex((o: any) => o.id === connection.outputId) ?? -1
							: -1;
						if (ct === "if") sourceHandle = idx === 0 ? "true" : "false";
						else if (ct === "loop") sourceHandle = idx === 0 ? "done" : "loop";
						else if (ct === "filter") sourceHandle = idx === 0 ? "kept" : "discarded";
					} else if (ct === "switch") {
						// Match output by accessor (= outputPortName or "fallback")
						const output = sourceNode.type === "operation"
							? (sourceNode as any).outputs?.find((o: any) => o.id === connection.outputId)
							: null;
						if (output?.accessor) {
							// Check if accessor matches a known handle (rule_N or "fallback")
							const isKnownHandle = output.accessor === "fallback" || /^rule_\d+$/.test(output.accessor);
							if (isKnownHandle) {
								sourceHandle = output.accessor;
							} else {
								// Legacy: accessor doesn't match new handle IDs; use index
								const idx = sourceNode.type === "operation"
									? (sourceNode as any).outputs?.findIndex((o: any) => o.id === connection.outputId) ?? -1
									: -1;
								sourceHandle = `rule_${Math.max(0, idx)}`;
							}
						} else {
							const idx = sourceNode.type === "operation"
								? (sourceNode as any).outputs?.findIndex((o: any) => o.id === connection.outputId) ?? -1
								: -1;
							sourceHandle = `rule_${Math.max(0, idx)}`;
						}
					}
					// else: undefined — matches the default Handle (no id prop)
				}

				// Multi-input target nodes: map inputId to the named handle ID
				const targetNode = nodes.find((n) => n.id === connection.inputNode.id);
				if (targetNode?.content.type === "merge" && targetNode.type === "operation") {
					const idx = (targetNode as any).inputs?.findIndex(
						(i: any) => i.id === connection.inputId,
					) ?? -1;
					targetHandle = `input-${Math.max(1, idx + 1)}`;
				}
				// else: undefined — matches the default Handle (no id prop)
			}

			const nextEdge: Edge = {
				id: connection.id,
				source: connection.outputNode.id,
				target: connection.inputNode.id,
				type: "giselleConnector",
				selected,
				data: { connection },
				sourceHandle,
				targetHandle,
			};
			next.set(connection.id, nextEdge);
			return nextEdge;
		});
		cacheEdgesRef.current = next;
		return arr;
	}, [connections, selectedConnectionIds, nodes]);

	const handleConnect = useCallback(
		(connection: Connection) => {
			try {
				const outputNode = nodes.find((node) => node.id === connection.source);
				const inputNode = nodes.find((node) => node.id === connection.target);
				if (!outputNode || !inputNode) {
					throw new Error("Node not found");
				}

				const supported = isSupportedConnection(outputNode, inputNode, {
					existingConnections: connections,
				});
				if (!supported.canConnect) {
					throw new Error(supported.message);
				}

				connectNodes(outputNode.id, inputNode.id, connection.sourceHandle ?? undefined, connection.targetHandle ?? undefined);
			} catch (error: unknown) {
				toast.error(
					error instanceof Error ? error.message : "Failed to connect nodes",
				);
			}
		},
		[connectNodes, connections, nodes, toast],
	);

	const isValidConnection: IsValidConnection = useCallback(
		(connection) => {
			if (connection.source === connection.target) {
				return false;
			}
			// Check for duplicate connections
			if (connections.some(
				(conn) =>
					conn.inputNode.id === connection.target &&
					conn.outputNode.id === connection.source,
			)) {
				return false;
			}
			// Cycle detection: adding source→target would create a cycle if
			// target can already reach source through existing connections
			const visited = new Set<string>();
			const queue = [connection.target];
			while (queue.length > 0) {
				const current = queue.pop() as string;
				if (current === connection.source) {
					return false; // cycle detected
				}
				if (visited.has(current)) continue;
				visited.add(current);
				for (const conn of connections) {
					if (conn.outputNode.id === current) {
						queue.push(conn.inputNode.id);
					}
				}
			}
			// Semantic validation: check if the connection is actually supported
			const outputNode = nodes.find((n) => n.id === connection.source);
			const inputNode = nodes.find((n) => n.id === connection.target);
			if (!outputNode || !inputNode) {
				return false;
			}
			const supported = isSupportedConnection(outputNode, inputNode, {
				existingConnections: connections,
			});
			return supported.canConnect;
		},
		[connections, nodes],
	);

	const { pushUndoSnapshot } = useUndoRedoActions((s) => ({
		pushUndoSnapshot: s.pushUndoSnapshot,
	}));

	const handleMoveEnd: OnMoveEnd = useCallback(
		(_event, viewport) => {
			setUiViewport(viewport, { save: true });
		},
		[setUiViewport],
	);

	// Capture undo snapshot before node drag starts
	const handleNodeDragStart = useCallback(() => {
		pushUndoSnapshot();
	}, [pushUndoSnapshot]);

	const handleNodesChange: OnNodesChange = useCallback(
		(changes) => {
			const nodeIdsToRemove: string[] = [];
			for (const change of changes) {
				const isStickyNote = change.type !== "add" && change.id.startsWith("sticky-");
				const stickyNoteId = isStickyNote ? change.id.replace("sticky-", "") : "";

				switch (change.type) {
					case "position": {
						if (change.position === undefined) break;
						if (isStickyNote) {
							updateStickyNote(stickyNoteId, { position: change.position });
						} else {
							setUiNodeState(change.id, { position: change.position });
						}
						break;
					}
					case "dimensions": {
						if (!isStickyNote) {
							setUiNodeState(change.id, {
								measured: {
									width: change.dimensions?.width,
									height: change.dimensions?.height,
								},
							});
						}
						break;
					}
					case "select": {
						if (!isStickyNote) {
							setUiNodeState(change.id, { selected: change.selected });
						}
						break;
					}
					case "remove": {
						if (isStickyNote) {
							removeStickyNote(stickyNoteId);
						} else {
							nodeIdsToRemove.push(change.id);
						}
						break;
					}
				}
			}
			if (nodeIdsToRemove.length > 0) {
				void deleteNodes(nodeIdsToRemove);
			}
		},
		[deleteNodes, setUiNodeState, updateStickyNote, removeStickyNote],
	);

	const handleEdgesChange: OnEdgesChange = useCallback(
		(changes) => {
			for (const change of changes) {
				switch (change.type) {
					case "select": {
						if (change.selected) {
							selectConnection(change.id);
						} else {
							deselectConnection(change.id);
						}
						break;
					}
					case "remove": {
						const removeConnection = connections.find(
							(connection) => connection.id === change.id,
						);
						if (removeConnection === undefined) {
							console.warn(`Connection with id ${change.id} not found`);
							break;
						}
						// Remove only this specific connection (not all between same node pair)
						pushUndoSnapshot();
						removeConnectionById(removeConnection.id);
						break;
					}
				}
			}
		},
		[deselectConnection, selectConnection, connections, pushUndoSnapshot, removeConnectionById],
	);

	const handleNodeClick: NodeMouseHandler = useCallback(
		(_event, nodeClicked) => {
			selectSingleNode(nodeClicked.id);
			// Always maintain canvas focus when clicking nodes
			setCurrentShortcutScope("canvas");
			// Do NOT open properties panel on single click — double-click opens it
		},
		[selectSingleNode, setCurrentShortcutScope],
	);

	const handleNodeDoubleClick: NodeMouseHandler = useCallback(
		(_event, nodeClicked) => {
			selectSingleNode(nodeClicked.id);
			// Dispatch custom event so V2Container can open properties panel
			window.dispatchEvent(
				new CustomEvent("open-properties-panel", {
					detail: { nodeId: nodeClicked.id },
				}),
			);
		},
		[selectSingleNode],
	);

	const handlePanelClick = useCallback(
		(e: React.MouseEvent) => {
			setMenu(null);
			clearSelection();
			// Close properties panel when clicking on empty canvas
			window.dispatchEvent(new CustomEvent("close-properties-panel"));
			if (selectedTool?.action === "addNode") {
				const position = reactFlowInstance.screenToFlowPosition({
					x: e.clientX,
					y: e.clientY,
				});
				if (isAppEntryNode(selectedTool.node)) {
					addAppEntryWithEndNodes({
						appEntryNode: selectedTool.node,
						position,
					});
				} else {
					addNode(selectedTool.node, { position });
				}
			}
			reset();
			// Set canvas focus when clicking on canvas
			setCurrentShortcutScope("canvas");
		},
		[
			clearSelection,
			reactFlowInstance,
			selectedTool,
			addNode,
			addAppEntryWithEndNodes,
			reset,
			setCurrentShortcutScope,
		],
	);
	const handleEdgeClick = useCallback(
		(_event: any, edge: any) => {
			// Find the connection for this edge to get source/target info
			const conn = connections.find((c) => c.id === edge.id);
			if (!conn || conn.connectionType === "subNode") return;

			// Dispatch insert-on-edge event — "What Happens Next" panel will handle insertion
			window.dispatchEvent(
				new CustomEvent("insert-on-edge", {
					detail: {
						connectionId: conn.id,
						sourceNodeId: conn.outputNode.id,
						targetNodeId: conn.inputNode.id,
					},
				}),
			);
		},
		[connections],
	);

	const handleNodeContextMenu: NodeMouseHandler = useCallback((event, node) => {
		event.preventDefault();
		const pane = reactFlowRef.current?.getBoundingClientRect();
		if (!pane) return;
		setMenu({
			id: node.id,
			top: event.clientY < pane.height - 200 ? event.clientY : undefined,
			left: event.clientX < pane.width - 200 ? event.clientX : undefined,
			right:
				event.clientX >= pane.width - 200
					? pane.width - event.clientX
					: undefined,
			bottom:
				event.clientY >= pane.height - 200
					? pane.height - event.clientY
					: undefined,
		});
	}, []);

	const handleTriggerSelect = useCallback(
		(triggerNode: Parameters<typeof addNode>[0]) => {
			// Position at viewport center-left
			const center = reactFlowInstance.screenToFlowPosition({
				x: window.innerWidth * 0.35,
				y: window.innerHeight / 2,
			});
			addNode(triggerNode, { position: center });
			selectSingleNode(triggerNode.id);
		},
		[addNode, reactFlowInstance, selectSingleNode],
	);

	const handleLegacyFlow = useCallback(() => {
		const center = reactFlowInstance.screenToFlowPosition({
			x: window.innerWidth * 0.35,
			y: window.innerHeight / 2,
		});
		addAppEntryWithEndNodes({
			appEntryNode: createAppEntryNode(),
			position: center,
		});
	}, [addAppEntryWithEndNodes, reactFlowInstance]);

	// Show overlay only on completely empty canvas (no nodes at all, excluding sticky notes)
	const showTriggerPicker = nodes.length === 0;

	return (
		<ReactFlow
			ref={reactFlowRef}
			className="giselle-workflow-editor-v3"
			colorMode="dark"
			nodes={reactFlowNodes}
			edges={edges}
			nodeTypes={nodeTypes}
			edgeTypes={edgeTypes}
			defaultViewport={viewport}
			onConnect={handleConnect}
			isValidConnection={isValidConnection}
			panOnScroll={true}
			zoomOnScroll={false}
			zoomOnPinch={true}
			snapToGrid={snapToGrid}
			snapGrid={[16, 16]}
			tabIndex={0}
			onMoveEnd={handleMoveEnd}
			onNodeDragStart={handleNodeDragStart}
			onNodesChange={handleNodesChange}
			onNodeClick={handleNodeClick}
			onNodeDoubleClick={handleNodeDoubleClick}
			onPaneClick={handlePanelClick}
			onKeyDown={handleKeyDown}
			onNodeContextMenu={handleNodeContextMenu}
			onEdgeClick={handleEdgeClick}
			onEdgesChange={handleEdgesChange}
		>
			<Background />
			<DebugWorkspacePanel />
			{showTriggerPicker && (
				<TriggerPickerOverlay
					onSelect={handleTriggerSelect}
					onLegacyFlow={handleLegacyFlow}
				/>
			)}
			{selectedTool?.action === "addNode" && (
				<FloatingNodePreview node={selectedTool.node} />
			)}
			<XYFlowPanel position="top-left" className="m-[16px]">
				<AppSetupHint />
			</XYFlowPanel>
			<XYFlowPanel position="top-right" className="m-[16px]">
				<div className="flex gap-[6px]">
					<button
						type="button"
						className={clsx(
							"rounded-[8px] backdrop-blur-sm border px-[10px] py-[5px] text-[12px] transition-colors",
							snapToGrid
								? "bg-blue-500/20 border-blue-500/40 text-blue-300 hover:bg-blue-500/30"
								: "bg-black/60 border-white/10 text-white/70 hover:text-white hover:bg-black/80",
						)}
						onClick={() => setSnapToGrid((v) => !v)}
						title={snapToGrid ? "Disable snap to grid" : "Enable snap to grid"}
					>
						<svg className="w-[14px] h-[14px] inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
					</button>
					<button
						type="button"
						className="rounded-[8px] bg-black/60 backdrop-blur-sm border border-white/10 px-[10px] py-[5px] text-[12px] text-white/70 hover:text-white hover:bg-black/80 transition-colors"
						onClick={autoArrange}
						title="Auto-arrange nodes"
					>
						<svg className="w-[14px] h-[14px] inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
					</button>
					<button
						type="button"
						className="rounded-[8px] bg-black/60 backdrop-blur-sm border border-white/10 px-[10px] py-[5px] text-[12px] text-white/70 hover:text-white hover:bg-black/80 transition-colors"
						onClick={() => {
							const center = reactFlowInstance.screenToFlowPosition({
								x: window.innerWidth / 2,
								y: window.innerHeight / 2,
							});
							addStickyNote({
								id: `note-${Date.now()}`,
								text: "",
								color: "yellow",
								position: { x: center.x, y: center.y },
								size: { width: 200, height: 150 },
							});
						}}
						title="Add sticky note"
					>
						+ Note
					</button>
				</div>
			</XYFlowPanel>
			<XYFlowPanel position="bottom-center">
				<Toolbar />
			</XYFlowPanel>
			{menu && (
			<ContextMenu
				{...menu}
				onClose={() => setMenu(null)}
				onExecuteToHere={() => {
					executeToHere(menu.id);
				}}
				onSelectAll={() => {
					for (const n of nodes) {
						setUiNodeState(n.id, { selected: true });
					}
				}}
				onFitView={() => {
					reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
				}}
				onTidyUp={autoArrange}
			/>
		)}
		<MiniMap
			style={{
				background: "rgba(0, 0, 0, 0.6)",
				borderRadius: "8px",
				border: "1px solid rgba(255, 255, 255, 0.1)",
			}}
			maskColor="rgba(0, 0, 0, 0.5)"
			nodeColor={(node) => {
				const ct = node.data?.contentType ?? node.type;
				if (ct === "circle" || ct === "trigger" || ct === "formTrigger" || ct === "errorTrigger") return "hsl(220, 15%, 50%)";
				if (ct === "wide" || ct === "aiAgent") return "hsl(260, 70%, 55%)";
				if (ct === "pill" || ct === "appEntry" || ct === "end") return "hsl(220, 15%, 60%)";
				if (ct === "smallCircle") return "hsl(260, 50%, 45%)";
				return "hsl(220, 10%, 40%)";
			}}
			pannable
			zoomable
		/>
		<ZoomIndicator />
		</ReactFlow>
	);
}

export function V2Container({ leftPanel, onLeftPanelClose }: V2ContainerProps) {
	const [whatHappensNextSource, setWhatHappensNextSource] =
		useState<NodeId | null>(null);
	const [whatHappensNextOutputId, setWhatHappensNextOutputId] =
		useState<string | null>(null);
	const [insertEdgeConfig, setInsertEdgeConfig] = useState<{
		connectionId: string;
		targetNodeId: NodeId;
	} | null>(null);
	const [propertiesNodeId, setPropertiesNodeId] = useState<NodeId | null>(null);
	const clearSelection = useClearSelection();

	// Listen for "what-happens-next" custom events from node plus buttons
	useEffect(() => {
		const handler = (e: Event) => {
			const detail = (e as CustomEvent).detail as {
				sourceNodeId: NodeId;
				outputId?: string;
			};
			// Close properties panel
			clearSelection();
			setPropertiesNodeId(null);
			setWhatHappensNextSource(detail.sourceNodeId);
			setWhatHappensNextOutputId(detail.outputId ?? null);
		};
		window.addEventListener("what-happens-next", handler);
		return () => window.removeEventListener("what-happens-next", handler);
	}, [clearSelection]);

	// Listen for "insert-on-edge" events from edge clicks
	useEffect(() => {
		const handler = (e: Event) => {
			const detail = (e as CustomEvent).detail as {
				connectionId: string;
				sourceNodeId: NodeId;
				targetNodeId: NodeId;
			};
			clearSelection();
			setPropertiesNodeId(null);
			setWhatHappensNextSource(detail.sourceNodeId);
			setWhatHappensNextOutputId(null);
			setInsertEdgeConfig({
				connectionId: detail.connectionId,
				targetNodeId: detail.targetNodeId,
			});
		};
		window.addEventListener("insert-on-edge", handler);
		return () => window.removeEventListener("insert-on-edge", handler);
	}, [clearSelection]);

	// Listen for "open-properties-panel" custom events from double-click
	useEffect(() => {
		const openHandler = (e: Event) => {
			const detail = (e as CustomEvent).detail as { nodeId: NodeId };
			setPropertiesNodeId(detail.nodeId);
		};
		const closeHandler = () => {
			setPropertiesNodeId(null);
		};
		window.addEventListener("open-properties-panel", openHandler);
		window.addEventListener("close-properties-panel", closeHandler);
		return () => {
			window.removeEventListener("open-properties-panel", openHandler);
			window.removeEventListener("close-properties-panel", closeHandler);
		};
	}, []);

	// Listen for "open-properties" events from Enter shortcut
	useEffect(() => {
		const handler = (e: Event) => {
			const detail = (e as CustomEvent).detail as { nodeId: NodeId };
			setPropertiesNodeId(detail.nodeId);
		};
		window.addEventListener("open-properties", handler);
		return () => window.removeEventListener("open-properties", handler);
	}, []);

	// Listen for "toggle-shortcuts-overlay" events from ? shortcut
	const [showShortcutsOverlay, setShowShortcutsOverlay] = useState(false);
	useEffect(() => {
		const handler = () => setShowShortcutsOverlay((v) => !v);
		window.addEventListener("toggle-shortcuts-overlay", handler);
		return () => window.removeEventListener("toggle-shortcuts-overlay", handler);
	}, []);

	// Listen for "sub-node-add" custom events from AI Agent bottom handle "+" buttons
	const addNode = useAddNode();
	const addConnection = useAddConnection();
	const { addNodeInput } = useWorkspaceActions((s) => ({
		addNodeInput: s.addNodeInput,
	}));
	const { setUiNodeState } = useWorkspaceActions((s) => ({
		setUiNodeState: s.setUiNodeState,
	}));
	const subNodeStoreApi = useAppDesignerStoreApi();

	useEffect(() => {
		const handler = (e: Event) => {
			const detail = (e as CustomEvent).detail as {
				parentNodeId: NodeId;
				handleType: string;
			};

			if (detail.handleType === "chatModel") {
				// Use getState() for fresh state
				const currentNodes = subNodeStoreApi.getState().nodes;
				const currentNodeState = subNodeStoreApi.getState().ui.nodeState;

				// Find the parent AI Agent node and its position
				const parentNode = currentNodes.find(
					(n) => n.id === detail.parentNodeId,
				);
				if (!parentNode) return;

				const parentUi = currentNodeState[detail.parentNodeId];
				const parentPos = parentUi?.position ?? { x: 0, y: 0 };
				const parentHeight = parentUi?.measured?.height ?? 200;

				// Create chatModel node with default model
				const chatModelNode = createChatModelNode({
					id: "openai/gpt-5" as Parameters<
						typeof createChatModelNode
					>[0]["id"],
				});

				// Position below the AI Agent
				const position = {
					x: parentPos.x,
					y: parentPos.y + parentHeight + 60,
				};

				// Add node to store
				addNode(chatModelNode, { position });

				// Create an input on the AI Agent for this sub-node connection
				const inputId = InputId.generate();
				addNodeInput(detail.parentNodeId, {
					id: inputId,
					label: "Chat Model",
					accessor: "chatModel",
				});

				// Create sub-node connection
				const chatModelOutput = chatModelNode.outputs[0];
				if (chatModelOutput) {
					addConnection({
						outputNode: chatModelNode,
						outputId: chatModelOutput.id,
						inputNode: parentNode,
						inputId,
						connectionType: "subNode",
					});
				}

				// Select the new chatModel node
				clearSelection();
				setUiNodeState(chatModelNode.id, { selected: true });
			}

			if (detail.handleType === "toolNode") {
				const currentNodes = subNodeStoreApi.getState().nodes;
				const currentNodeState = subNodeStoreApi.getState().ui.nodeState;
				const currentConnections =
					subNodeStoreApi.getState().connections ?? [];

				const parentNode = currentNodes.find(
					(n) => n.id === detail.parentNodeId,
				);
				if (!parentNode) return;

				const parentUi = currentNodeState[detail.parentNodeId];
				const parentPos = parentUi?.position ?? { x: 0, y: 0 };
				const parentHeight = parentUi?.measured?.height ?? 200;

				// Count existing tool sub-nodes to offset position
				const existingToolCount = currentConnections.filter(
					(c) =>
						c.inputNode.id === detail.parentNodeId &&
						c.connectionType === "subNode" &&
						c.outputNode.content.type === "toolNode",
				).length;

				// Create a toolNode with default "builtinTool" type (user will configure later)
				const toolNode = createToolNodeNode({
					toolType: "builtinTool",
				});

				const position = {
					x: parentPos.x + 200 + existingToolCount * 180,
					y: parentPos.y + parentHeight + 60,
				};

				addNode(toolNode, { position });

				const inputId = InputId.generate();
				addNodeInput(detail.parentNodeId, {
					id: inputId,
					label: `Tool ${existingToolCount + 1}`,
					accessor: `tool-${existingToolCount}`,
				});

				const toolOutput = toolNode.outputs[0];
				if (toolOutput) {
					addConnection({
						outputNode: toolNode,
						outputId: toolOutput.id,
						inputNode: parentNode,
						inputId,
						connectionType: "subNode",
					});
				}

				clearSelection();
				setUiNodeState(toolNode.id, { selected: true });
			}

			if (detail.handleType === "memoryNode") {
				const currentNodes = subNodeStoreApi.getState().nodes;
				const currentNodeState = subNodeStoreApi.getState().ui.nodeState;

				const parentNode = currentNodes.find(
					(n) => n.id === detail.parentNodeId,
				);
				if (!parentNode) return;

				const parentUi = currentNodeState[detail.parentNodeId];
				const parentPos = parentUi?.position ?? { x: 0, y: 0 };
				const parentHeight = parentUi?.measured?.height ?? 200;

				const memoryNode = createMemoryNodeNode({
					memoryType: "simpleMemory",
				});

				const position = {
					x: parentPos.x + 100,
					y: parentPos.y + parentHeight + 60,
				};

				addNode(memoryNode, { position });

				const inputId = InputId.generate();
				addNodeInput(detail.parentNodeId, {
					id: inputId,
					label: "Memory",
					accessor: "memory",
				});

				const memoryOutput = memoryNode.outputs[0];
				if (memoryOutput) {
					addConnection({
						outputNode: memoryNode,
						outputId: memoryOutput.id,
						inputNode: parentNode,
						inputId,
						connectionType: "subNode",
					});
				}

				clearSelection();
				setUiNodeState(memoryNode.id, { selected: true });
			}
		};
		window.addEventListener("sub-node-add", handler);
		return () => window.removeEventListener("sub-node-add", handler);
	}, [
		subNodeStoreApi,
		addNode,
		addConnection,
		addNodeInput,
		clearSelection,
		setUiNodeState,
	]);

	const allNodes = useAppDesignerStore((s) => s.nodes);

	// Properties panel is driven by explicit double-click, not by selection
	const isPropertiesPanelOpen = propertiesNodeId !== null;
	const propertiesNode = propertiesNodeId
		? allNodes.find((n) => n.id === propertiesNodeId)
		: null;

	// Close properties panel if the node was deleted
	useEffect(() => {
		if (propertiesNodeId && !allNodes.some((n) => n.id === propertiesNodeId)) {
			setPropertiesNodeId(null);
		}
	}, [propertiesNodeId, allNodes]);

	// Close "What happens next?" panel when properties panel opens
	useEffect(() => {
		if (isPropertiesPanelOpen && whatHappensNextSource) {
			setWhatHappensNextSource(null);
		}
	}, [isPropertiesPanelOpen, whatHappensNextSource]);

	const selectSingleNode = useSelectSingleNode();

	// When properties panel opens, also select the node so PropertiesPanel reads it
	useEffect(() => {
		if (propertiesNodeId) {
			selectSingleNode(propertiesNodeId);
		}
	}, [propertiesNodeId, selectSingleNode]);

	const contentType = propertiesNode?.content.type;
	const isTextGenerationPanel =
		isPropertiesPanelOpen && contentType === "textGeneration";
	const isFilePanel =
		isPropertiesPanelOpen && contentType === "file";
	const isTextPanel =
		isPropertiesPanelOpen && contentType === "text";
	const isVectorStorePanel =
		isPropertiesPanelOpen && contentType === "vectorStore";
	const isWebPagePanel =
		isPropertiesPanelOpen && contentType === "webPage";
	const isManualTriggerPanel =
		isPropertiesPanelOpen &&
		contentType === "trigger" &&
		`${(propertiesNode as unknown as { content?: { provider?: string } })?.content?.provider}` ===
			"manual";
	const isStartOrEndPanel =
		isPropertiesPanelOpen &&
		(["appEntry", "end"] as const).includes(contentType as "appEntry" | "end");

	// 3-panel layout for generation/execution/flow-control nodes (INPUT | PARAMETERS | OUTPUT)
	const isThreePanelNode =
		isPropertiesPanelOpen &&
		[
			"textGeneration",
			"imageGeneration",
			"contentGeneration",
			"aiAgent",
			"integration",
			"dataQuery",
			"query",
			"if",
			"switch",
			"merge",
			"loop",
			"code",
			"filter",
			"editFields",
			"sort",
			"wait",
			"errorTrigger",
			"dataTable",
			"formTrigger",
		].includes(contentType ?? "");

	const mainRef = useRef<HTMLDivElement>(null);

	return (
		<ConfirmProvider>
			<main className="relative flex-1 bg-bg overflow-hidden" ref={mainRef}>
				<PanelGroup direction="horizontal" className="h-full flex">
					{leftPanel !== null && (
						<>
							<Panel order={1}>
								{leftPanel === "run-history" && (
									<LeftPanel onClose={onLeftPanelClose} title="Run History">
										<RunHistoryTable
											onDebug={(task) => {
												useDebugSessionStore.getState().enterDebugSession(task);
												onLeftPanelClose();
											}}
										/>
									</LeftPanel>
								)}
								{leftPanel === "secret" && (
									<LeftPanel onClose={onLeftPanelClose} title="Secrets">
										<SecretTable />
									</LeftPanel>
								)}
							</Panel>
							<PanelResizeHandle
								className={clsx(
									"w-[12px] cursor-col-resize group flex items-center justify-center",
								)}
							>
								<div
									className={clsx(
										"w-[3px] h-[32px] rounded-full transition-colors",
										"bg-[#6b7280] opacity-60",
										"group-data-[resize-handle-state=hover]:bg-[#4a90e2]",
										"group-data-[resize-handle-state=drag]:bg-[#4a90e2]",
									)}
								/>
							</PanelResizeHandle>
						</>
					)}

					<Panel order={2}>
						{/* Debug Session Banner */}
						<DebugBanner />
						{/* Import Warning Banner */}
						<ImportWarningBanner />
						{/* Main Content Area */}
						<V2NodeCanvas />
						{/* Floating Properties Panel */}
						<FloatingPropertiesPanel
							isOpen={isPropertiesPanelOpen}
							container={mainRef.current}
							title="Properties Panel"
							defaultWidth={
								isThreePanelNode ? 640 : isTextGenerationPanel ? 400 : undefined
							}
							minWidth={
								isThreePanelNode ? 520 : isTextGenerationPanel ? 400 : undefined
							}
							maxWidth={isThreePanelNode ? 1200 : undefined}
							autoHeight={
								isFilePanel ||
								isTextPanel ||
								isVectorStorePanel ||
								isWebPagePanel ||
								isManualTriggerPanel ||
								isStartOrEndPanel
							}
						>
							<PropertiesPanel />
						</FloatingPropertiesPanel>
					</Panel>
				</PanelGroup>
				{/* What Happens Next panel - shown when "+" button is clicked on a node */}
				{whatHappensNextSource && (
					<WhatHappensNextPanel
						sourceNodeId={whatHappensNextSource}
						sourceOutputId={whatHappensNextOutputId}
						insertEdgeConfig={insertEdgeConfig}
						onClose={() => {
							setWhatHappensNextSource(null);
							setWhatHappensNextOutputId(null);
							setInsertEdgeConfig(null);
						}}
					/>
				)}
				<GradientDef />
				{/* Keyboard shortcuts overlay — toggled by ? key */}
				{showShortcutsOverlay && (
					<div
						className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
						onClick={() => setShowShortcutsOverlay(false)}
						onKeyDown={(e) => { if (e.key === "Escape") setShowShortcutsOverlay(false); }}
						role="dialog"
						aria-label="Keyboard shortcuts"
					>
						<div
							className="bg-[#1a1a2e] border border-white/10 rounded-[12px] p-[24px] min-w-[400px] max-w-[480px] shadow-2xl"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="flex items-center justify-between mb-[16px]">
								<h2 className="text-[16px] font-semibold text-white">Keyboard Shortcuts</h2>
								<button type="button" onClick={() => setShowShortcutsOverlay(false)} className="text-white/40 hover:text-white text-[18px] cursor-pointer">&times;</button>
							</div>
							<div className="space-y-[6px] text-[12px]">
								{[
									["Ctrl+Z", "Undo"],
									["Ctrl+Shift+Z", "Redo"],
									["Ctrl+C", "Copy node"],
									["Ctrl+V", "Paste node"],
									["Ctrl+D", "Duplicate node"],
									["Ctrl+A", "Select all"],
									["Delete", "Delete selected"],
									["F2", "Rename node"],
									["D", "Toggle disable"],
									["P", "Toggle pin data"],
									["Enter", "Open properties"],
									["Shift+S", "Add sticky note"],
									["Escape", "Cancel / deselect"],
									["?", "Show this overlay"],
								].map(([key, desc]) => (
									<div key={key} className="flex items-center justify-between py-[4px] border-b border-white/5">
										<span className="text-white/60">{desc}</span>
										<kbd className="px-[8px] py-[2px] bg-white/10 rounded-[4px] text-white/80 font-mono text-[11px]">{key}</kbd>
									</div>
								))}
							</div>
						</div>
					</div>
				)}
			</main>
		</ConfirmProvider>
	);
}
