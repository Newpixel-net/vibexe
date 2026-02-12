import { getPieceCategoryColor } from "@giselles-ai/activepieces-adapter";
import {
	type CompletedGeneration,
	type FailedGeneration,
	type IntegrationNode,
	Node,
	type OperationNode,
	isCompletedGeneration,
	isFailedGeneration,
} from "@giselles-ai/protocol";
import { useNodeGenerations } from "@giselles-ai/react";
import {
	CableIcon,
	CheckCircle,
	CopyIcon,
	LoaderIcon,
	PlusIcon,
	TrashIcon,
	XCircleIcon,
} from "lucide-react";
import { type CSSProperties, useCallback, useMemo, useState } from "react";
import {
	useAppDesignerStore,
	useDeleteNode,
	useUpdateNodeData,
	useUpdateNodeDataContent,
	useWorkspaceActions,
} from "../../../app-designer";
import {
	PropertiesPanelContent,
	PropertiesPanelRoot,
} from "../ui";
import { NodePanelHeader } from "../ui/node-panel-header";
import { NodeSettingsTab } from "../ui/node-settings-tab";
import { PanelTabs } from "../ui/panel-tabs";
import { CredentialSelector } from "./credential-selector";
import { DynamicPropertyField } from "./dynamic-property-field";
import { usePieceActionProps } from "./use-piece-action-props";

export function IntegrationNodePropertiesPanel({
	node,
}: { node: IntegrationNode }) {
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);
	const connections = useAppDesignerStore((s) => s.connections);
	const nodes = useAppDesignerStore((s) => s.nodes);
	const updateNodeData = useUpdateNodeData();
	const updateNodeDataContent = useUpdateNodeDataContent();
	const deleteNode = useDeleteNode();
	const setUiNodeState = useWorkspaceActions((a) => a.setUiNodeState);
	const {
		createAndStartGenerationRunner,
		isGenerating,
		stopGenerationRunner,
		currentGeneration,
	} = useNodeGenerations({
		nodeId: node.id,
		origin: { type: "studio", workspaceId },
	});

	const [newKey, setNewKey] = useState("");
	const [newValue, setNewValue] = useState("");
	const [copied, setCopied] = useState(false);

	// Fetch dynamic props from the piece inspector API
	const {
		props: dynamicProps,
		auth: authInfo,
		loading: propsLoading,
		error: propsError,
	} = usePieceActionProps(node.content.pieceName, node.content.actionName);

	const resultText = useMemo(() => {
		if (!currentGeneration) return null;
		if (isCompletedGeneration(currentGeneration)) {
			const gen = currentGeneration as CompletedGeneration;
			const textOutputs = gen.outputs
				?.filter((output) => output.type === "generated-text")
				.map((output) =>
					output.type === "generated-text" ? output.content : "",
				)
				.join("\n\n");
			return textOutputs || null;
		}
		if (isFailedGeneration(currentGeneration)) {
			const gen = currentGeneration as FailedGeneration;
			return gen.error
				? `${gen.error.name}: ${gen.error.message}`
				: "Integration failed";
		}
		return null;
	}, [currentGeneration]);

	const handleCopy = useCallback(() => {
		if (resultText) {
			navigator.clipboard.writeText(resultText);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	}, [resultText]);

	const configuration = (node.content.configuration ?? {}) as Record<
		string,
		unknown
	>;

	const updateConfig = useCallback(
		(key: string, value: unknown) => {
			const updated = { ...configuration, [key]: value };
			updateNodeDataContent(node, { configuration: updated });
		},
		[configuration, node, updateNodeDataContent],
	);

	const removeConfig = useCallback(
		(key: string) => {
			const updated = { ...configuration };
			delete updated[key];
			updateNodeDataContent(node, { configuration: updated });
		},
		[configuration, node, updateNodeDataContent],
	);

	const addCustomField = useCallback(() => {
		if (!newKey.trim()) return;
		updateConfig(newKey.trim(), newValue);
		setNewKey("");
		setNewValue("");
	}, [newKey, newValue, updateConfig]);

	const handleClick = useCallback(() => {
		if (isGenerating) {
			stopGenerationRunner();
			return;
		}

		setUiNodeState(node.id, {
			showError: false,
		});
		const incomingConnections = connections.filter(
			(c) => c.inputNode.id === node.id,
		);
		const sourceNodes = incomingConnections
			.map((c) => nodes.find((n) => n.id === c.outputNode.id))
			.filter((n): n is Node => Node.safeParse(n).success);

		const ctx = {
			origin: {
				type: "studio" as const,
				workspaceId,
			},
			operationNode: node,
			sourceNodes,
			connections: incomingConnections,
		};
		createAndStartGenerationRunner(ctx);
	}, [
		isGenerating,
		stopGenerationRunner,
		setUiNodeState,
		node,
		nodes,
		connections,
		createAndStartGenerationRunner,
		workspaceId,
	]);

	const hasDynamicProps = dynamicProps && Object.keys(dynamicProps).length > 0;
	const dynamicPropKeys = hasDynamicProps
		? new Set(Object.keys(dynamicProps))
		: new Set<string>();
	const customEntries = Object.entries(configuration).filter(
		([k]) => !dynamicPropKeys.has(k),
	);

	const integrationColorStyle = useMemo(() => {
		const color = getPieceCategoryColor(node.content.pieceName);
		if (!color) return undefined;
		return {
			"--color-integration-node-1": color,
		} as CSSProperties;
	}, [node.content.pieceName]);

	const parametersContent = (
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

					{/* Credential selector - shown when piece requires auth */}
					{authInfo && (
						<CredentialSelector
							node={node}
							pieceName={node.content.pieceName}
							authInfo={authInfo}
						/>
					)}

					{/* Dynamic properties from piece inspector API */}
					{propsLoading && (
						<div className="flex items-center gap-2 text-xs text-text-muted py-2">
							<LoaderIcon className="size-3 animate-spin" />
							Loading properties...
						</div>
					)}

					{propsError && !hasDynamicProps && (
						<div className="text-xs text-text-muted/60 py-1">
							{/* Fallback: show generic editor when piece is not installed */}
						</div>
					)}

					{hasDynamicProps && (
						<div className="flex flex-col gap-3 mt-2">
							<div className="text-xs font-medium text-text-muted uppercase tracking-wider">
								Configuration
							</div>
							{Object.entries(dynamicProps).map(([key, prop]) => (
								<DynamicPropertyField
									key={key}
									prop={prop}
									value={configuration[key]}
									onChange={(val) => updateConfig(key, val)}
								/>
							))}
						</div>
					)}

					{/* Custom/extra configuration entries */}
					{customEntries.length > 0 && (
						<div className="flex flex-col gap-3 mt-2">
							{!hasDynamicProps && (
								<div className="text-xs font-medium text-text-muted uppercase tracking-wider">
									Configuration
								</div>
							)}
							{customEntries.map(([key, value]) => (
								<div key={key} className="flex flex-col gap-1">
									<div className="flex items-center justify-between">
										<label className="text-xs text-text-muted">
											{key}
										</label>
										<button
											type="button"
											className="text-text-muted hover:text-red-400 transition-colors"
											onClick={() => removeConfig(key)}
										>
											<TrashIcon className="size-3" />
										</button>
									</div>
									<input
										type="text"
										className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-inverse placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-integration-node-1"
										value={String(value ?? "")}
										onChange={(e) => updateConfig(key, e.target.value)}
									/>
								</div>
							))}
						</div>
					)}

					{/* Add custom field */}
					<div className="flex flex-col gap-2 mt-1">
						<div className="text-xs text-text-muted">Add Property</div>
						<div className="flex gap-2">
							<input
								type="text"
								className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-inverse placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-integration-node-1"
								placeholder="Key"
								value={newKey}
								onChange={(e) => setNewKey(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") addCustomField();
								}}
							/>
							<input
								type="text"
								className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-inverse placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-integration-node-1"
								placeholder="Value"
								value={newValue}
								onChange={(e) => setNewValue(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") addCustomField();
								}}
							/>
							<button
								type="button"
								className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-text-muted hover:text-inverse hover:bg-white/10 transition-colors"
								onClick={addCustomField}
							>
								<PlusIcon className="size-3.5" />
							</button>
						</div>
					</div>

					<button
						type="button"
						className="mt-4 w-full py-2 px-4 rounded-lg bg-integration-node-1 text-inverse text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
						onClick={handleClick}
						disabled={isGenerating}
					>
						{isGenerating && (
							<LoaderIcon className="size-4 animate-spin" />
						)}
						{isGenerating ? "Running..." : "Run Integration"}
					</button>

					{/* Result display */}
					{currentGeneration &&
						!isGenerating &&
						isCompletedGeneration(currentGeneration) && (
							<div className="mt-3 rounded-lg border border-green-500/20 bg-green-500/5 p-3">
								<div className="flex items-center justify-between mb-2">
									<div className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
										<CheckCircle className="size-3.5" />
										Completed
									</div>
									<button
										type="button"
										className="text-text-muted hover:text-inverse transition-colors"
										onClick={handleCopy}
										title="Copy result"
									>
										{copied ? (
											<CheckCircle className="size-3.5 text-green-400" />
										) : (
											<CopyIcon className="size-3.5" />
										)}
									</button>
								</div>
								{resultText && (
									<pre className="text-xs text-text-muted whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto custom-scrollbar font-mono">
										{resultText.length > 500
											? `${resultText.slice(0, 500)}...`
											: resultText}
									</pre>
								)}
							</div>
						)}

					{currentGeneration &&
						!isGenerating &&
						isFailedGeneration(currentGeneration) && (
							<div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
								<div className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
									<XCircleIcon className="size-3.5" />
									Failed
								</div>
								{resultText && (
									<p className="text-xs text-red-300/70 mt-1.5">
										{resultText}
									</p>
								)}
							</div>
						)}
				</div>
			</div>
		</PropertiesPanelContent>
	);

	return (
		<div style={integrationColorStyle} className="h-full w-full flex flex-col">
		<PropertiesPanelRoot>
			<NodePanelHeader
				node={node}
				onChangeName={(name) => updateNodeData(node, { name })}
				onDelete={() => deleteNode(node.id)}
			/>
			<PanelTabs
				tabs={[
					{
						id: "parameters",
						label: "Parameters",
						content: parametersContent,
					},
					{
						id: "settings",
						label: "Settings",
						content: (
							<NodeSettingsTab
								node={node as unknown as OperationNode}
							/>
						),
					},
				]}
			/>
		</PropertiesPanelRoot>
		</div>
	);
}
