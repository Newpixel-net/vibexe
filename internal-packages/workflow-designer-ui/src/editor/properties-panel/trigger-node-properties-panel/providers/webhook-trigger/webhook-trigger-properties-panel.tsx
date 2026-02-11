"use client";

import type { TriggerNode } from "@giselles-ai/protocol";
import { CheckIcon, CopyIcon, GlobeIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { useUpdateNodeDataContent } from "../../../../../app-designer";

export function WebhookTriggerPropertiesPanel({
	node,
}: {
	node: TriggerNode;
}) {
	const updateNodeDataContent = useUpdateNodeDataContent();
	const [copied, setCopied] = useState(false);

	const webhookPath =
		(node.content as Record<string, unknown>).webhookPath as string ??
		node.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);

	const method =
		(node.content as Record<string, unknown>).webhookMethod as string ?? "POST";

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

	return (
		<div className="flex flex-col gap-[16px] p-[16px]">
			{/* Header */}
			<div className="flex items-center gap-[8px]">
				<GlobeIcon className="size-[16px] text-trigger-node-1" />
				<span className="text-[13px] font-semibold text-inverse">
					Webhook Configuration
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

			{/* Help text */}
			<p className="text-[10px] text-inverse/30">
				Send HTTP requests to the webhook URL to trigger this workflow. The
				request body will be available as input data for downstream nodes.
			</p>
		</div>
	);
}
