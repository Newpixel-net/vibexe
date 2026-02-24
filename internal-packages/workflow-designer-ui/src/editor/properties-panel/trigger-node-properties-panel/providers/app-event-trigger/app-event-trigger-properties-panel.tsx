"use client";

import type { TriggerNode } from "@vibexe-ai/protocol";
import { useTrigger } from "@vibexe-ai/react";
import {
	CheckCircle2Icon,
	GlobeIcon,
	PowerIcon,
	ZapIcon,
} from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
	useAppDesignerStore,
	useUpdateNodeData,
	useUpdateNodeDataContent,
} from "../../../../../app-designer";
import { useVibexe } from "../../../../../app-designer/store/vibexe-client-provider";
import { SpinnerIcon } from "../../../../../icons";

interface PieceTrigger {
	name: string;
	displayName: string;
	description: string;
}

interface PieceWithTriggers {
	piece: string;
	displayName: string;
	triggerCount: number;
	triggers: PieceTrigger[];
}

export function AppEventTriggerPropertiesPanel({
	node,
}: {
	node: TriggerNode;
}) {
	const updateNodeDataContent = useUpdateNodeDataContent();
	const updateNodeData = useUpdateNodeData();
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);
	const client = useVibexe();
	const { callbacks } = useTrigger();
	const [isPending, startTransition] = useTransition();

	const [pieces, setPieces] = useState<PieceWithTriggers[]>([]);
	const [loadingPieces, setLoadingPieces] = useState(true);

	const content = node.content as Record<string, unknown>;
	const selectedPiece = (content.appEventPiece as string) ?? "";
	const selectedTrigger = (content.appEventTrigger as string) ?? "";
	const isConfigured =
		content.state &&
		(content.state as Record<string, unknown>).status === "configured";
	const isEnabled = (content.appEventEnabled as boolean) ?? false;

	// Load pieces with triggers
	useEffect(() => {
		fetch("/api/integrations/triggers")
			.then((res) => res.json())
			.then((data: { pieces: PieceWithTriggers[] }) => {
				setPieces(data.pieces || []);
			})
			.catch(() => setPieces([]))
			.finally(() => setLoadingPieces(false));
	}, []);

	const selectedPieceData = pieces.find((p) => p.piece === selectedPiece);

	const handlePieceChange = useCallback(
		(pieceName: string) => {
			updateNodeDataContent(node, {
				appEventPiece: pieceName,
				appEventTrigger: "",
			} as Record<string, unknown>);
		},
		[node, updateNodeDataContent],
	);

	const handleTriggerChange = useCallback(
		(triggerName: string) => {
			updateNodeDataContent(node, {
				appEventTrigger: triggerName,
			} as Record<string, unknown>);
		},
		[node, updateNodeDataContent],
	);

	const handleSave = useCallback(
		(enabled: boolean) => {
			if (!selectedPiece || !selectedTrigger) return;

			startTransition(async () => {
				// Generate a unique webhook path for this app event trigger
				const webhookPath = `app-event-${node.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}-${Date.now().toString(36)}`;

				const { triggerId } = await client.configureTrigger({
					trigger: {
						nodeId: node.id,
						workspaceId,
						enable: true,
						configuration: {
							provider: "appEvent" as any,
							event: {
								id: `${selectedPiece}.${selectedTrigger}` as any,
								webhookPath,
								pieceName: selectedPiece,
								triggerName: selectedTrigger,
							} as any,
							enabled,
						},
					},
				});

				await callbacks?.triggerUpdate?.({
					id: triggerId,
					nodeId: node.id,
					workspaceId,
					enable: true,
					configuration: {
						provider: "appEvent",
						event: {
							id: `${selectedPiece}.${selectedTrigger}`,
							webhookPath,
							pieceName: selectedPiece,
							triggerName: selectedTrigger,
						},
						enabled,
					},
				});

				updateNodeData(node, {
					content: {
						...node.content,
						appEventPiece: selectedPiece,
						appEventTrigger: selectedTrigger,
						appEventWebhookPath: webhookPath,
						appEventEnabled: enabled,
						state: {
							status: "configured",
							flowTriggerId: triggerId,
						},
					} as any,
					name: node.name || `${selectedPieceData?.displayName ?? selectedPiece} Event`,
				});
			});
		},
		[
			client,
			node,
			workspaceId,
			selectedPiece,
			selectedTrigger,
			selectedPieceData,
			updateNodeData,
			callbacks?.triggerUpdate,
		],
	);

	return (
		<div className="flex flex-col gap-[16px] p-[16px]">
			{/* Header */}
			<div className="flex items-center gap-[8px]">
				<ZapIcon className="size-[16px] text-trigger-node-1" />
				<span className="text-[13px] font-semibold text-inverse">
					App Event Trigger
				</span>
			</div>

			{(<p className="text-[11px] text-inverse/50">
				Trigger this workflow when an event occurs in a connected app (e.g., new Slack message, Google Drive file change, Notion page update).
			</p>) as any}

			{/* Status */}
			{isConfigured && (
				<div
					className={`flex items-center gap-[8px] rounded-[8px] p-[10px] ${
						isEnabled
							? "bg-green-500/10 border border-green-500/30"
							: "bg-inverse/5"
					}`}
				>
					{isEnabled ? (
						<CheckCircle2Icon className="size-[14px] text-green-400" />
					) : (
						<PowerIcon className="size-[14px] text-inverse/40" />
					)}
					<span
						className={`text-[12px] font-medium ${isEnabled ? "text-green-400" : "text-inverse/50"}`}
					>
						{isEnabled ? "Active" : "Inactive"}
					</span>
				</div>
			)}

			{/* Piece Selection */}
			<div className="flex flex-col gap-[8px]">
				{(<span className="text-[11px] text-inverse/50 font-medium uppercase tracking-wider">
					App / Service
				</span>) as any}
				{loadingPieces ? (
					<div className="flex items-center gap-[8px] p-[10px] bg-inverse/5 rounded-[8px]">
						<SpinnerIcon className="animate-follow-through-overlap-spin size-[14px] text-inverse/40" />
						<span className="text-[12px] text-inverse/50">
							Loading available triggers...
						</span>
					</div>
				) : pieces.length === 0 ? (
					<p className="text-[12px] text-inverse/40 p-[10px] bg-inverse/5 rounded-[8px]">
						No pieces with trigger support found.
					</p>
				) : (
					<select
						className="w-full rounded-[8px] border border-inverse/20 bg-transparent px-[12px] py-[8px] text-[13px] text-inverse focus:outline-none focus:border-trigger-node-1"
						value={selectedPiece}
						onChange={(e) => handlePieceChange(e.target.value)}
					>
						<option value="">Select an app...</option>
						{pieces.map((p) => (
							<option key={p.piece} value={p.piece}>
								{p.displayName} ({p.triggerCount} triggers)
							</option>
						))}
					</select>
				)}
			</div>

			{/* Trigger Event Selection */}
			{selectedPiece && selectedPieceData && (
				<div className="flex flex-col gap-[8px]">
					<span className="text-[11px] text-inverse/50 font-medium uppercase tracking-wider">
						Event
					</span>
					<select
						className="w-full rounded-[8px] border border-inverse/20 bg-transparent px-[12px] py-[8px] text-[13px] text-inverse focus:outline-none focus:border-trigger-node-1"
						value={selectedTrigger}
						onChange={(e) => handleTriggerChange(e.target.value)}
					>
						<option value="">Select an event...</option>
						{selectedPieceData.triggers.map((t) => (
							<option key={t.name} value={t.name}>
								{t.displayName}
							</option>
						))}
					</select>
					{selectedTrigger && (
						<p className="text-[10px] text-inverse/40">
							{
								selectedPieceData.triggers.find(
									(t) => t.name === selectedTrigger,
								)?.description
							}
						</p>
					)}
				</div>
			)}

			{/* Webhook URL info */}
			{isConfigured && (content.appEventWebhookPath as string) && (
				<div className="flex flex-col gap-[8px]">
					<span className="text-[11px] text-inverse/50 font-medium uppercase tracking-wider">
						Webhook URL
					</span>
					<div className="bg-inverse/5 rounded-[8px] p-[10px] font-mono text-[10px] text-inverse/60 break-all">
						{typeof window !== "undefined"
							? `${window.location.origin}/api/webhooks/${content.appEventWebhookPath}`
							: `/api/webhooks/${content.appEventWebhookPath}`}
					</div>
					<p className="text-[10px] text-inverse/30">
						Configure this URL in {selectedPieceData?.displayName ?? selectedPiece}
						&apos;s webhook settings to receive events.
					</p>
				</div>
			)}

			{/* Save / Enable Button */}
			{selectedPiece && selectedTrigger && (
				<div className="flex gap-[8px] pt-[8px]">
					{isEnabled ? (
						<button
							type="button"
							onClick={() => handleSave(false)}
							disabled={isPending}
							className="flex-1 flex items-center justify-center gap-[6px] px-[12px] py-[8px] rounded-[8px] bg-red-500/10 border border-red-500/30 text-red-400 text-[12px] font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
						>
							{isPending ? (
								<SpinnerIcon className="animate-follow-through-overlap-spin size-[14px]" />
							) : (
								<PowerIcon className="size-[14px]" />
							)}
							{isPending ? "Saving..." : "Disable"}
						</button>
					) : (
						<button
							type="button"
							onClick={() => handleSave(true)}
							disabled={isPending}
							className="flex-1 flex items-center justify-center gap-[6px] px-[12px] py-[8px] rounded-[8px] bg-green-500/10 border border-green-500/30 text-green-400 text-[12px] font-medium hover:bg-green-500/20 transition-colors disabled:opacity-50"
						>
							{isPending ? (
								<SpinnerIcon className="animate-follow-through-overlap-spin size-[14px]" />
							) : (
								<PowerIcon className="size-[14px]" />
							)}
							{isPending ? "Saving..." : "Enable Trigger"}
						</button>
					)}
				</div>
			)}
		</div>
	);
}
