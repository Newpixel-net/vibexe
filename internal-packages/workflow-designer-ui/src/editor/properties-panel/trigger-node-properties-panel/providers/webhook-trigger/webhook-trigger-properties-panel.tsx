"use client";

import type { TriggerNode } from "@giselles-ai/protocol";
import { useTrigger } from "@giselles-ai/react";
import {
	CheckCircle2Icon,
	CheckIcon,
	CopyIcon,
	GlobeIcon,
	PowerIcon,
} from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import {
	useAppDesignerStore,
	useUpdateNodeData,
	useUpdateNodeDataContent,
} from "../../../../../app-designer";
import { useGiselle } from "../../../../../app-designer/store/giselle-client-provider";
import { SpinnerIcon } from "../../../../../icons";
import { WebhookLogs } from "./webhook-logs";

export function WebhookTriggerPropertiesPanel({
	node,
}: {
	node: TriggerNode;
}) {
	const updateNodeDataContent = useUpdateNodeDataContent();
	const updateNodeData = useUpdateNodeData();
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);
	const client = useGiselle();
	const { callbacks } = useTrigger();
	const [copied, setCopied] = useState(false);
	const [isPending, startTransition] = useTransition();

	const content = node.content as Record<string, unknown>;
	const webhookPath =
		(content.webhookPath as string) ??
		node.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);

	const method = (content.webhookMethod as string) ?? "POST";
	const isConfigured = content.state
		? (content.state as Record<string, unknown>).status === "configured"
		: false;
	const isEnabled = (content.webhookEnabled as boolean) ?? false;

	const siteUrl =
		typeof window !== "undefined"
			? window.location.origin
			: "https://vibexe.online";

	const webhookUrl = `${siteUrl}/api/webhooks/${webhookPath}`;

	const handleCopyUrl = useCallback(() => {
		navigator.clipboard.writeText(webhookUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, [webhookUrl]);

	const handleMethodChange = useCallback(
		(m: string) => {
			updateNodeDataContent(node, {
				webhookMethod: m,
			} as Record<string, unknown>);
		},
		[node, updateNodeDataContent],
	);

	const handleSave = useCallback(
		(enabled: boolean) => {
			startTransition(async () => {
				const { triggerId } = await client.configureTrigger({
					trigger: {
						nodeId: node.id,
						workspaceId,
						enable: true,
						configuration: {
							provider: "webhook",
							event: {
								id: "webhook.http.received",
								webhookPath,
								method: method as "GET" | "POST",
							},
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
						provider: "webhook",
						event: {
							id: "webhook.http.received",
							webhookPath,
							method: method as "GET" | "POST",
						},
						enabled,
					},
				});

				updateNodeData(node, {
					content: {
						...node.content,
						webhookPath,
						webhookMethod: method,
						webhookEnabled: enabled,
						state: {
							status: "configured",
							flowTriggerId: triggerId,
						},
					},
					name: node.name,
				});
			});
		},
		[
			client,
			node,
			workspaceId,
			webhookPath,
			method,
			updateNodeData,
			callbacks?.triggerUpdate,
		],
	);

	return (
		<div className="flex flex-col gap-[16px] p-[16px]">
			{/* Header */}
			<div className="flex items-center gap-[8px]">
				<GlobeIcon className="size-[16px] text-trigger-node-1" />
				<span className="text-[13px] font-semibold text-inverse">
					Webhook Configuration
				</span>
			</div>

			{/* Status */}
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

			{/* Webhook URL */}
			<div className="flex flex-col gap-[8px]">
				<span className="text-[11px] text-inverse/50 font-medium uppercase tracking-wider">
					Webhook URL
				</span>
				<div className="flex items-center gap-[8px]">
					<div className="flex-1 bg-inverse/5 rounded-[8px] p-[10px] font-mono text-[11px] text-inverse/80 break-all select-all">
						{webhookUrl}
					</div>
					<button
						type="button"
						onClick={handleCopyUrl}
						className="p-[8px] rounded-[6px] bg-inverse/5 hover:bg-inverse/10 transition-colors shrink-0"
					>
						{copied ? (
							<CheckIcon className="size-[14px] text-green-400" />
						) : (
							<CopyIcon className="size-[14px] text-inverse/60" />
						)}
					</button>
				</div>
			</div>

			{/* HTTP Method */}
			<div className="flex flex-col gap-[8px]">
				<span className="text-[11px] text-inverse/50 font-medium uppercase tracking-wider">
					HTTP Method
				</span>
				<div className="flex gap-[8px]">
					{["GET", "POST"].map((m) => (
						<button
							key={m}
							type="button"
							onClick={() => handleMethodChange(m)}
							className={`px-[16px] py-[6px] rounded-md text-[12px] border transition-colors ${
								method === m
									? "bg-trigger-node-1/20 border-trigger-node-1 text-inverse"
									: "border-inverse/20 text-inverse/60 hover:text-inverse/80"
							}`}
						>
							{m}
						</button>
					))}
				</div>
			</div>

			{/* Test Section */}
			<div className="flex flex-col gap-[8px]">
				<span className="text-[11px] text-inverse/50 font-medium uppercase tracking-wider">
					Test
				</span>
				<div className="bg-inverse/5 rounded-[8px] p-[10px]">
					<code className="text-[10px] text-inverse/60 font-mono block whitespace-pre-wrap">
						{method === "POST"
							? `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello from webhook"}'`
							: `curl "${webhookUrl}"`}
					</code>
				</div>
			</div>

			{/* Enable / Disable + Save */}
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
						{isPending ? "Saving..." : "Disable Webhook"}
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
						{isPending ? "Saving..." : "Enable Webhook"}
					</button>
				)}
				{!isEnabled && (
					<button
						type="button"
						onClick={() => handleSave(false)}
						disabled={isPending}
						className="px-[12px] py-[8px] rounded-[8px] bg-inverse/5 border border-inverse/20 text-inverse/60 text-[12px] font-medium hover:bg-inverse/10 transition-colors disabled:opacity-50"
					>
						Save Only
					</button>
				)}
			</div>

			{/* Help text */}
			<p className="text-[10px] text-inverse/30">
				Send HTTP requests to the webhook URL to trigger this workflow. The
				request body will be available as input data for downstream nodes.
			</p>

			{/* Webhook Request Logs */}
			{isConfigured && (
				<div className="flex flex-col gap-[8px]">
					<span className="text-[11px] text-inverse/50 font-medium uppercase tracking-wider">
						Request Logs
					</span>
					<div className="rounded-[8px] border border-inverse/10 overflow-hidden">
						<WebhookLogs webhookPath={webhookPath} />
					</div>
				</div>
			)}
		</div>
	);
}
