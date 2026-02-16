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
	CheckCircle,
	ChevronRightIcon,
	CopyIcon,
	LoaderIcon,
	PlayIcon,
	PlusIcon,
	TerminalIcon,
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
import { CommentsTab } from "../ui/comments-tab";
import { InlineCodeEditor } from "../ui/inline-code-editor";
import { PanelTabs } from "../ui/panel-tabs";
import { SearchableSelect, type SelectOption } from "../ui/searchable-select";
import { CredentialSelector } from "./credential-selector";
import { DynamicPropertyField } from "./dynamic-property-field";
import { HttpPieceFields } from "./http-piece-fields";
import { ImportedCredentialSelector } from "./imported-credential-selector";
import { usePieceActionProps, usePieceInspect } from "./use-piece-action-props";

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
	const [showCurlImport, setShowCurlImport] = useState(false);
	const [curlInput, setCurlInput] = useState("");

	// Fetch piece info (all actions) and dynamic props for current action
	const { data: pieceData } = usePieceInspect(node.content.pieceName);
	const {
		props: dynamicProps,
		auth: authInfo,
		loading: propsLoading,
		error: propsError,
	} = usePieceActionProps(node.content.pieceName, node.content.actionName);

	// Action selector options
	const actionOptions: SelectOption[] = useMemo(() => {
		if (!pieceData?.actions) return [];
		return pieceData.actions.map((a) => ({
			label: a.displayName,
			value: a.name,
		}));
	}, [pieceData]);

	const handleActionChange = useCallback(
		(newActionName: string) => {
			if (newActionName === node.content.actionName) return;
			// Clear configuration when switching actions (old fields don't apply)
			updateNodeDataContent(node, {
				actionName: newActionName,
				configuration: {},
			});
		},
		[node, updateNodeDataContent],
	);

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
			const updated = { ...configuration };
			if (value === undefined) {
				delete updated[key];
			} else {
				updated[key] = value;
			}
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

	const isHttpPiece = node.content.pieceName === "http" || node.content.pieceName === "http-oauth2";

	const handleCurlImport = useCallback(() => {
		const cmd = curlInput.trim();
		if (!cmd) return;

		// Simple cURL parser
		const config: Record<string, unknown> = {};

		// Extract URL: first non-flag argument, or after -X/--url
		const urlMatch = cmd.match(/curl\s+(?:['"]([^'"]+)['"]|(\S+))/i)
			?? cmd.match(/(?:--url\s+)(?:['"]([^'"]+)['"]|(\S+))/i);
		if (urlMatch) {
			config.url = urlMatch[1] ?? urlMatch[2] ?? "";
		}

		// Also try to find URL as any https?:// token
		if (!config.url) {
			const httpMatch = cmd.match(/(https?:\/\/\S+)/);
			if (httpMatch) config.url = httpMatch[1].replace(/['"]$/, "");
		}

		// Extract method: -X METHOD or --request METHOD
		const methodMatch = cmd.match(/(?:-X|--request)\s+['"]?(\w+)['"]?/i);
		config.method = methodMatch ? methodMatch[1].toUpperCase() : "GET";

		// Extract headers: -H 'Key: Value' or --header 'Key: Value'
		const headerRegex = /(?:-H|--header)\s+['"]([^'"]+)['"]/gi;
		const headers: Record<string, string> = {};
		let headerMatch: RegExpExecArray | null;
		while ((headerMatch = headerRegex.exec(cmd)) !== null) {
			const colonIdx = headerMatch[1].indexOf(":");
			if (colonIdx > 0) {
				const key = headerMatch[1].slice(0, colonIdx).trim();
				const val = headerMatch[1].slice(colonIdx + 1).trim();
				headers[key] = val;
			}
		}
		if (Object.keys(headers).length > 0) {
			config.headers = headers;
		}

		// Extract body: -d 'data' or --data 'data' or --data-raw 'data'
		const bodyMatch = cmd.match(/(?:-d|--data|--data-raw|--data-binary)\s+['"]([^'"]*)['"]/i)
			?? cmd.match(/(?:-d|--data|--data-raw|--data-binary)\s+(\S+)/i);
		if (bodyMatch) {
			const bodyStr = bodyMatch[1];
			try {
				config.body = JSON.parse(bodyStr);
			} catch {
				config.body = bodyStr;
			}
			if (config.method === "GET") config.method = "POST";
		}

		// Apply parsed config to the node
		const merged = { ...configuration, ...config };
		updateNodeDataContent(node, { configuration: merged });
		setShowCurlImport(false);
		setCurlInput("");
	}, [curlInput, configuration, node, updateNodeDataContent]);

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
					{/* Import cURL — HTTP piece only */}
					{isHttpPiece && (
						<div className="flex flex-col gap-2">
							<button
								type="button"
								className="flex items-center gap-[6px] px-[8px] py-[5px] text-[11px] rounded-[6px] border border-white/10 bg-white/5 text-text-muted hover:text-inverse hover:bg-white/10 transition-colors w-fit"
								onClick={() => setShowCurlImport(!showCurlImport)}
							>
								<TerminalIcon className="size-[12px]" />
								{showCurlImport ? "Cancel" : "Import cURL"}
							</button>
							{showCurlImport && (
								<div className="flex flex-col gap-[6px]">
									<textarea
										className="w-full h-[100px] p-[8px] rounded-[6px] bg-black/30 border border-white/10 text-[11px] text-inverse/80 font-mono resize-y outline-none focus:border-blue-500/30 placeholder:text-text-muted/40"
										value={curlInput}
										onChange={(e) => setCurlInput(e.target.value)}
										placeholder={"curl -X POST 'https://api.example.com/data' \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"key\": \"value\"}'"}
									/>
									<button
										type="button"
										className="self-end px-[10px] py-[4px] text-[11px] rounded-[4px] bg-blue-600/60 text-white hover:bg-blue-500/70 transition-colors"
										onClick={handleCurlImport}
									>
										Import
									</button>
								</div>
							)}
						</div>
					)}

					<div className="flex flex-col gap-2">
						<div className="text-xs text-text-muted">Action</div>
						{actionOptions.length > 1 ? (
							<SearchableSelect
								options={actionOptions}
								value={node.content.actionName}
								onChange={handleActionChange}
								placeholder="Select action..."
								className="w-full"
							/>
						) : (
							<div className="text-sm text-inverse font-medium">
								{pieceData?.actions.find((a) => a.name === node.content.actionName)?.displayName ?? node.content.actionName}
							</div>
						)}
					</div>

					{/* Credential selector - shown when piece requires auth */}
					{authInfo && (
						<CredentialSelector
							node={node}
							pieceName={node.content.pieceName}
							pieceDisplayName={pieceData?.displayName}
							pieceDescription={pieceData?.description}
							authInfo={authInfo}
						/>
					)}

					{/* Credential selector for N8N-imported nodes with credential hints */}
					{!authInfo && node.credentialHint?.suggestedPiece && (
						<ImportedCredentialSelector
							node={node}
							credentialHint={node.credentialHint}
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

					{/* HTTP piece: structured smart layout with toggles */}
					{isHttpPiece ? (
						<HttpPieceFields
							configuration={configuration}
							updateConfig={updateConfig}
							nodeId={node.id}
						/>
					) : hasDynamicProps ? (
						<div className="flex flex-col gap-3 mt-2">
							{Object.entries(dynamicProps).map(([key, prop]) => (
								<DynamicPropertyField
									key={key}
									prop={prop}
									value={configuration[key]}
									onChange={(val) => updateConfig(key, val)}
									nodeId={node.id}
									pieceName={node.content.pieceName}
									actionName={node.content.actionName}
									allValues={configuration}
								/>
							))}
						</div>
					) : null}

					{/* Custom properties (collapsible for non-HTTP pieces) */}
					{!isHttpPiece && (customEntries.length > 0 || true) && (
						<details className="mt-1 group">
							<summary className="flex items-center gap-[4px] text-[12px] text-text-muted hover:text-inverse/70 cursor-pointer transition-colors list-none [&::-webkit-details-marker]:hidden">
								<ChevronRightIcon className="size-[12px] transition-transform group-open:rotate-90" />
								Custom Properties
								{customEntries.length > 0 && (
									<span className="text-[10px] text-inverse/30 ml-[4px]">
										({customEntries.length})
									</span>
								)}
							</summary>
							<div className="flex flex-col gap-3 mt-2 pl-[4px]">
								{customEntries.map(([key, value]) => (
									<div key={key} className="flex flex-col gap-1">
										<div className="flex items-center justify-between">
											<label className="text-[11px] text-text-muted">
												{key}
											</label>
											<button
												type="button"
												className="text-text-muted/50 hover:text-red-400 transition-colors p-[2px] rounded-[3px] hover:bg-red-500/10"
												onClick={() => removeConfig(key)}
											>
												<TrashIcon className="size-[11px]" />
											</button>
										</div>
										<input
											type="text"
											className="w-full rounded-[6px] border border-border-muted bg-transparent px-[8px] py-[6px] text-[12px] text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
											value={String(value ?? "")}
											onChange={(e) => updateConfig(key, e.target.value)}
										/>
									</div>
								))}
								<div className="flex gap-[4px]">
									<input
										type="text"
										className="flex-1 rounded-[6px] border border-border-muted bg-transparent px-[8px] py-[5px] text-[11px] text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
										placeholder="Key"
										value={newKey}
										onChange={(e) => setNewKey(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") addCustomField();
										}}
									/>
									<input
										type="text"
										className="flex-1 rounded-[6px] border border-border-muted bg-transparent px-[8px] py-[5px] text-[11px] text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
										placeholder="Value"
										value={newValue}
										onChange={(e) => setNewValue(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") addCustomField();
										}}
									/>
									<button
										type="button"
										className="shrink-0 rounded-[6px] border border-border-muted px-[6px] py-[5px] text-text-muted/50 hover:text-inverse hover:border-inverse/20 transition-colors"
										onClick={addCustomField}
									>
										<PlusIcon className="size-[12px]" />
									</button>
								</div>
							</div>
						</details>
					)}

					{/* Result display */}
					{currentGeneration &&
						!isGenerating &&
						isCompletedGeneration(currentGeneration) && (
							<ResultDisplay
								resultText={resultText}
								copied={copied}
								onCopy={handleCopy}
							/>
						)}

					{currentGeneration &&
						!isGenerating &&
						isFailedGeneration(currentGeneration) && (
							<div className="mt-3 rounded-[8px] border border-red-500/20 bg-red-500/5 p-3">
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
				docsUrl={`https://www.activepieces.com/pieces/${encodeURIComponent(node.content.pieceName)}`}
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
					{
						id: "comments",
						label: "Comments",
						content: <CommentsTab nodeId={node.id} />,
					},
				]}
				action={
					<button
						type="button"
						className="flex items-center gap-[5px] px-[10px] py-[4px] text-[12px] font-medium rounded-[5px] bg-integration-node-1 text-inverse hover:opacity-90 transition-opacity disabled:opacity-50"
						onClick={handleClick}
						disabled={isGenerating}
					>
						{isGenerating ? (
							<LoaderIcon className="size-[12px] animate-spin" />
						) : (
							<PlayIcon className="size-[12px]" />
						)}
						{isGenerating ? "Running..." : "Execute step"}
					</button>
				}
			/>
		</PropertiesPanelRoot>
		</div>
	);
}

/** Improved result display with JSON code editor for structured output */
function ResultDisplay({
	resultText,
	copied,
	onCopy,
}: {
	resultText: string | null;
	copied: boolean;
	onCopy: () => void;
}) {
	const [expanded, setExpanded] = useState(false);

	if (!resultText) return null;

	// Try to detect if the result is valid JSON
	let isJson = false;
	try {
		const trimmed = resultText.trim();
		if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
			JSON.parse(trimmed);
			isJson = true;
		}
	} catch {
		// Not JSON
	}

	const displayText = expanded ? resultText : resultText.slice(0, 2000);
	const isTruncated = !expanded && resultText.length > 2000;

	return (
		<div className="mt-3 rounded-[8px] border border-green-500/20 bg-green-500/5 p-3">
			<div className="flex items-center justify-between mb-2">
				<div className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
					<CheckCircle className="size-3.5" />
					Completed
				</div>
				<button
					type="button"
					className="text-text-muted hover:text-inverse transition-colors"
					onClick={onCopy}
					title="Copy result"
				>
					{copied ? (
						<CheckCircle className="size-3.5 text-green-400" />
					) : (
						<CopyIcon className="size-3.5" />
					)}
				</button>
			</div>
			{isJson ? (
				<InlineCodeEditor
					value={
						(() => {
							try {
								return JSON.stringify(JSON.parse(resultText.trim()), null, 2);
							} catch {
								return resultText;
							}
						})()
					}
					onChange={() => {}}
					language="json"
					readOnly
					minHeight={60}
					maxHeight={300}
				/>
			) : (
				<pre className="text-xs text-text-muted whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto custom-scrollbar font-mono">
					{displayText}
					{isTruncated && "..."}
				</pre>
			)}
			{isTruncated && !isJson && (
				<button
					type="button"
					className="mt-[4px] text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
					onClick={() => setExpanded(true)}
				>
					Show full result ({resultText.length.toLocaleString()} chars)
				</button>
			)}
		</div>
	);
}
