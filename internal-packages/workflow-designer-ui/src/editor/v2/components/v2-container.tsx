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
	type NodeMouseHandler,
	type OnEdgesChange,
	type OnMoveEnd,
	type OnNodesChange,
	ReactFlow,
	type Node as RFNode,
	useNodesInitialized,
	useReactFlow,
	useUpdateNodeInternals,
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
	useDisconnectNodes,
	useSelectConnection,
	useSelectSingleNode,
	useSetCurrentShortcutScope,
	useWorkspaceActions,
} from "../../../app-designer";
import { Background } from "../../../ui/background";
import { edgeTypes } from "../../connector";
import { GradientDef } from "../../connector/component";
import { ContextMenu } from "../../context-menu";
import type { ContextMenuProps } from "../../context-menu/types";
import { useKeyboardShortcuts } from "../../hooks/use-keyboard-shortcuts";
import {
	CardXyFlowNode,
	CircleXyFlowNode,
	DiamondXyFlowNode,
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
		default:
			return "card"; // N8N default: 96x96 rounded square
	}
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
	const { setUiNodeState, setUiViewport, addStickyNote, updateStickyNote, removeStickyNote } = useWorkspaceActions((a) => ({
		setUiNodeState: a.setUiNodeState,
		setUiViewport: a.setUiViewport,
		addStickyNote: a.addStickyNote,
		updateStickyNote: a.updateStickyNote,
		removeStickyNote: a.removeStickyNote,
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
	const disconnectNodes = useDisconnectNodes();
	const toast = useToasts();
	const [menu, setMenu] = useState<Omit<ContextMenuProps, "onClose"> | null>(
		null,
	);
	const reactFlowRef = useRef<HTMLDivElement>(null);
	const didInitialAutoFitViewRef = useRef(false);

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
			data: {
				text: note.text,
				color: note.color,
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

	const cacheEdgesRef = useRef<Map<string, Edge>>(new Map());
	const edges = useMemo(() => {
		const next = new Map<string, Edge>();
		const arr = connections.map((connection) => {
			const prev = cacheEdgesRef.current.get(connection.id);
			const selected = selectedConnectionIds.includes(connection.id);
			if (prev !== undefined && selected === prev.selected) {
				return prev;
			}
			const nextEdge: Edge = {
				id: connection.id,
				source: connection.outputNode.id,
				target: connection.inputNode.id,
				type: "giselleConnector",
				selected,
				data: { connection },
				sourceHandle: connection.outputId,
				targetHandle: connection.inputId,
			};
			next.set(connection.id, nextEdge);
			return nextEdge;
		});
		cacheEdgesRef.current = next;
		return arr;
	}, [connections, selectedConnectionIds]);

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

				connectNodes(outputNode.id, inputNode.id);
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
			return !connections.some(
				(conn) =>
					conn.inputNode.id === connection.target &&
					conn.outputNode.id === connection.source,
			);
		},
		[connections],
	);

	const handleMoveEnd: OnMoveEnd = useCallback(
		(_event, viewport) => {
			setUiViewport(viewport, { save: true });
		},
		[setUiViewport],
	);

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
							return;
						}
						disconnectNodes(
							removeConnection.outputNode.id,
							removeConnection.inputNode.id,
						);
						break;
					}
				}
			}
		},
		[deselectConnection, disconnectNodes, selectConnection, connections],
	);

	const handleNodeClick: NodeMouseHandler = useCallback(
		(_event, nodeClicked) => {
			selectSingleNode(nodeClicked.id);
			// Always maintain canvas focus when clicking nodes
			setCurrentShortcutScope("canvas");
		},
		[selectSingleNode, setCurrentShortcutScope],
	);

	const handlePanelClick = useCallback(
		(e: React.MouseEvent) => {
			setMenu(null);
			clearSelection();
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
			tabIndex={0}
			onMoveEnd={handleMoveEnd}
			onNodesChange={handleNodesChange}
			onNodeClick={handleNodeClick}
			onPaneClick={handlePanelClick}
			onKeyDown={handleKeyDown}
			onNodeContextMenu={handleNodeContextMenu}
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
			</XYFlowPanel>
			<XYFlowPanel position="bottom-center">
				<Toolbar />
			</XYFlowPanel>
			{menu && <ContextMenu {...menu} onClose={() => setMenu(null)} />}
		</ReactFlow>
	);
}

export function V2Container({ leftPanel, onLeftPanelClose }: V2ContainerProps) {
	const [whatHappensNextSource, setWhatHappensNextSource] =
		useState<NodeId | null>(null);
	const clearSelection = useClearSelection();

	// Listen for "what-happens-next" custom events from node plus buttons
	useEffect(() => {
		const handler = (e: Event) => {
			const detail = (e as CustomEvent).detail as {
				sourceNodeId: NodeId;
			};
			// Close properties panel by deselecting nodes
			clearSelection();
			setWhatHappensNextSource(detail.sourceNodeId);
		};
		window.addEventListener("what-happens-next", handler);
		return () => window.removeEventListener("what-happens-next", handler);
	}, [clearSelection]);

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

	const selectedNodes = useAppDesignerStore(
		useShallow((s) =>
			s.nodes.filter((node) => s.ui.nodeState[node.id]?.selected),
		),
	);

	const isPropertiesPanelOpen = selectedNodes.length === 1;

	// Close "What happens next?" panel when a node is selected (properties panel opens)
	useEffect(() => {
		if (isPropertiesPanelOpen && whatHappensNextSource) {
			setWhatHappensNextSource(null);
		}
	}, [isPropertiesPanelOpen, whatHappensNextSource]);
	const isTextGenerationPanel =
		isPropertiesPanelOpen &&
		`${selectedNodes[0]?.content.type}` === "textGeneration";
	const isFilePanel =
		isPropertiesPanelOpen && `${selectedNodes[0]?.content.type}` === "file";
	const isTextPanel =
		isPropertiesPanelOpen && `${selectedNodes[0]?.content.type}` === "text";
	const isVectorStorePanel =
		isPropertiesPanelOpen &&
		`${selectedNodes[0]?.content.type}` === "vectorStore";
	const isWebPagePanel =
		isPropertiesPanelOpen && `${selectedNodes[0]?.content.type}` === "webPage";
	const isManualTriggerPanel =
		isPropertiesPanelOpen &&
		`${selectedNodes[0]?.content.type}` === "trigger" &&
		`${(selectedNodes[0] as unknown as { content?: { provider?: string } })?.content?.provider}` ===
			"manual";
	const isStartOrEndPanel =
		isPropertiesPanelOpen &&
		(["appEntry", "end"] as const).includes(
			`${selectedNodes[0]?.content.type}` as "appEntry" | "end",
		);

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
		].includes(`${selectedNodes[0]?.content.type}`);

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
						{/* Main Content Area */}
						<V2NodeCanvas />
						{/* Floating Properties Panel */}
						<FloatingPropertiesPanel
							isOpen={isPropertiesPanelOpen}
							container={mainRef.current}
							title="Properties Panel"
							defaultWidth={
								isThreePanelNode ? 900 : isTextGenerationPanel ? 400 : undefined
							}
							minWidth={
								isThreePanelNode ? 700 : isTextGenerationPanel ? 400 : undefined
							}
							maxWidth={isThreePanelNode ? 1400 : undefined}
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
						onClose={() => setWhatHappensNextSource(null)}
					/>
				)}
				<GradientDef />
			</main>
		</ConfirmProvider>
	);
}
