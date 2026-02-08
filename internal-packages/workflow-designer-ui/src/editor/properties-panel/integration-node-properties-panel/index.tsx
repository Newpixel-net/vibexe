import type { IntegrationNode, Node } from "@giselles-ai/protocol";
import { useNodeGenerations } from "@giselles-ai/react";
import { CableIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useCallback, useState } from "react";
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

// Known field definitions per piece/action for a better UX
interface FieldDef {
	key: string;
	label: string;
	placeholder: string;
	type: "text" | "password" | "textarea";
	required?: boolean;
}

const KNOWN_FIELDS: Record<string, Record<string, FieldDef[]>> = {
	youtube: {
		"fetch-video-info": [
			{
				key: "videoUrl",
				label: "Video URL",
				placeholder: "https://youtube.com/watch?v=...",
				type: "text",
				required: true,
			},
			{
				key: "apiKey",
				label: "YouTube API Key",
				placeholder: "AIzaSy...",
				type: "password",
				required: true,
			},
		],
	},
	http: {
		"send-request": [
			{
				key: "url",
				label: "URL",
				placeholder: "https://api.example.com/endpoint",
				type: "text",
				required: true,
			},
			{
				key: "method",
				label: "Method",
				placeholder: "GET",
				type: "text",
			},
			{
				key: "body",
				label: "Body",
				placeholder: '{"key": "value"}',
				type: "textarea",
			},
		],
	},
	slack: {
		"send-message": [
			{
				key: "channel",
				label: "Channel",
				placeholder: "#general or channel ID",
				type: "text",
				required: true,
			},
			{
				key: "text",
				label: "Message",
				placeholder: "Hello from Vibexe!",
				type: "textarea",
				required: true,
			},
		],
	},
};

function getFieldDefs(pieceName: string, actionName: string): FieldDef[] {
	return KNOWN_FIELDS[pieceName]?.[actionName] ?? [];
}

export function IntegrationNodePropertiesPanel({
	node,
}: { node: IntegrationNode }) {
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);
	const connections = useAppDesignerStore((s) => s.connections);
	const updateNodeData = useUpdateNodeData();
	const updateNodeDataContent = useUpdateNodeDataContent();
	const deleteNode = useDeleteNode();
	const setUiNodeState = useWorkspaceActions((a) => a.setUiNodeState);
	const { createAndStartGenerationRunner, isGenerating, stopGenerationRunner } =
		useNodeGenerations({
			nodeId: node.id,
			origin: { type: "studio", workspaceId },
		});

	const [newKey, setNewKey] = useState("");
	const [newValue, setNewValue] = useState("");

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

	const knownFields = getFieldDefs(
		node.content.pieceName,
		node.content.actionName,
	);
	const knownKeys = new Set(knownFields.map((f) => f.key));
	const customEntries = Object.entries(configuration).filter(
		([k]) => !knownKeys.has(k),
	);

	return (
		<PropertiesPanelRoot>
			<NodePanelHeader
				node={node}
				onChangeName={(name) => updateNodeData(node, { name })}
				onDelete={() => deleteNode(node.id)}
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

						{/* Known fields for this piece/action */}
						{knownFields.length > 0 && (
							<div className="flex flex-col gap-3 mt-2">
								<div className="text-xs font-medium text-text-muted uppercase tracking-wider">
									Configuration
								</div>
								{knownFields.map((field) => (
									<div key={field.key} className="flex flex-col gap-1">
										<label
											htmlFor={`field-${field.key}`}
											className="text-xs text-text-muted"
										>
											{field.label}
											{field.required && (
												<span className="text-red-400 ml-0.5">*</span>
											)}
										</label>
										{field.type === "textarea" ? (
											<textarea
												id={`field-${field.key}`}
												className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-inverse placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-action-node-1 resize-y min-h-[60px]"
												placeholder={field.placeholder}
												value={(configuration[field.key] as string) ?? ""}
												onChange={(e) =>
													updateConfig(field.key, e.target.value)
												}
											/>
										) : (
											<input
												id={`field-${field.key}`}
												type={field.type}
												className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-inverse placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-action-node-1"
												placeholder={field.placeholder}
												value={(configuration[field.key] as string) ?? ""}
												onChange={(e) =>
													updateConfig(field.key, e.target.value)
												}
											/>
										)}
									</div>
								))}
							</div>
						)}

						{/* Custom/extra configuration entries */}
						{customEntries.length > 0 && (
							<div className="flex flex-col gap-3 mt-2">
								{knownFields.length === 0 && (
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
											className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-inverse placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-action-node-1"
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
									className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-inverse placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-action-node-1"
									placeholder="Key"
									value={newKey}
									onChange={(e) => setNewKey(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") addCustomField();
									}}
								/>
								<input
									type="text"
									className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-inverse placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-action-node-1"
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
