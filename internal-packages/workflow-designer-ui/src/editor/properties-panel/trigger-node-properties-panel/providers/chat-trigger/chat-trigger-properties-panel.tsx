"use client";

import type { TriggerNode } from "@giselles-ai/protocol";
import { useTrigger } from "@giselles-ai/react";
import {
	CheckIcon,
	CopyIcon,
	ExternalLinkIcon,
	MessageSquareIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
	useAppDesignerStore,
	useUpdateNodeData,
	useUpdateNodeDataContent,
} from "../../../../../app-designer";
import { useGiselle } from "../../../../../app-designer/store/giselle-client-provider";
import { SpinnerIcon } from "../../../../../icons";

export function ChatTriggerPropertiesPanel({
	node,
}: {
	node: TriggerNode;
}) {
	const updateNodeDataContent = useUpdateNodeDataContent();
	const updateNodeData = useUpdateNodeData();
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);
	const client = useGiselle();
	const { callbacks } = useTrigger();
	const [isPending, startTransition] = useTransition();
	const [copiedField, setCopiedField] = useState<string | null>(null);
	const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Clean up copy timer on unmount
	useEffect(() => {
		return () => {
			if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
		};
	}, []);

	const content = node.content as Record<string, unknown>;
	const widgetTitle = (content.widgetTitle as string) ?? "Chat with AI";
	const widgetPlaceholder =
		(content.widgetPlaceholder as string) ?? "Type your message...";
	const widgetColor = (content.widgetColor as string) ?? "#6366f1";
	const welcomeMessage = (content.welcomeMessage as string) ?? "";
	const isConfigured = content.state
		? (content.state as Record<string, unknown>).status === "configured"
		: false;

	const siteUrl =
		typeof window !== "undefined"
			? window.location.origin
			: "https://vibexe.online";

	const chatUrl = `${siteUrl}/chat/${workspaceId}`;
	const iframeSnippet = `<iframe src="${chatUrl}" width="400" height="600" style="border:none;border-radius:16px" title="Chat Widget"></iframe>`;
	const scriptSnippet = `<script src="${siteUrl}/chat-widget.js" data-workspace-id="${workspaceId}" data-primary-color="${widgetColor}"></script>`;

	const handleCopy = useCallback((text: string, field: string) => {
		navigator.clipboard.writeText(text);
		setCopiedField(field);
		if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
		copyTimerRef.current = setTimeout(() => setCopiedField(null), 2000);
	}, []);

	const handleFieldChange = useCallback(
		(field: string, value: string) => {
			updateNodeDataContent(node, {
				[field]: value,
			} as Record<string, unknown>);
		},
		[node, updateNodeDataContent],
	);

	const handleSave = useCallback(() => {
		startTransition(async () => {
			const { triggerId } = await client.configureTrigger({
				trigger: {
					nodeId: node.id,
					workspaceId,
					enable: true,
					configuration: {
						provider: "chat" as any,
						event: {
							id: "chat.message" as any,
							widgetConfig: {
								title: widgetTitle,
								placeholder: widgetPlaceholder,
								primaryColor: widgetColor,
								welcomeMessage: welcomeMessage || undefined,
							},
						} as any,
						enabled: true,
					},
				},
			});

			await callbacks?.triggerUpdate?.({
				id: triggerId,
				nodeId: node.id,
				workspaceId,
				enable: true,
				configuration: {
					provider: "chat",
					event: {
						id: "chat.message",
						widgetConfig: {
							title: widgetTitle,
							placeholder: widgetPlaceholder,
							primaryColor: widgetColor,
							welcomeMessage: welcomeMessage || undefined,
						},
					},
					enabled: true,
				},
			});

			updateNodeData(node, {
				content: {
					...node.content,
					widgetTitle,
					widgetPlaceholder,
					widgetColor,
					welcomeMessage,
					widgetConfig: {
						title: widgetTitle,
						placeholder: widgetPlaceholder,
						primaryColor: widgetColor,
						welcomeMessage: welcomeMessage || undefined,
					},
					state: {
						status: "configured",
						flowTriggerId: triggerId,
					},
				} as any,
				name: node.name,
			});
		});
	}, [
		client,
		node,
		workspaceId,
		widgetTitle,
		widgetPlaceholder,
		widgetColor,
		welcomeMessage,
		updateNodeData,
		callbacks?.triggerUpdate,
	]);

	return (
		<div className="flex flex-col gap-[16px] p-[16px]">
			{/* Header */}
			<div className="flex items-center gap-[8px]">
				<MessageSquareIcon className="size-[16px] text-trigger-node-1" />
				<span className="text-[13px] font-semibold text-inverse">
					Chat Widget Configuration
				</span>
			</div>

			{/* Chat URL */}
			<div className="flex flex-col gap-[8px]">
				<span className="text-[11px] text-inverse/50 font-medium uppercase tracking-wider">
					Chat URL
				</span>
				<div className="flex items-center gap-[8px]">
					<div className="flex-1 bg-inverse/5 rounded-[8px] p-[10px] font-mono text-[11px] text-inverse/80 break-all select-all">
						{chatUrl}
					</div>
					<button
						type="button"
						onClick={() => handleCopy(chatUrl, "url")}
						className="p-[8px] rounded-[6px] bg-inverse/5 hover:bg-inverse/10 transition-colors shrink-0"
					>
						{copiedField === "url" ? (
							<CheckIcon className="size-[14px] text-green-400" />
						) : (
							<CopyIcon className="size-[14px] text-inverse/60" />
						)}
					</button>
					<a
						href={chatUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="p-[8px] rounded-[6px] bg-inverse/5 hover:bg-inverse/10 transition-colors shrink-0"
					>
						<ExternalLinkIcon className="size-[14px] text-inverse/60" />
					</a>
				</div>
			</div>

			{/* Widget Title */}
			<div className="flex flex-col gap-[4px]">
				<span className="text-[11px] text-inverse/50 font-medium uppercase tracking-wider">
					Widget Title
				</span>
				<input
					type="text"
					value={widgetTitle}
					onChange={(e) => handleFieldChange("widgetTitle", e.target.value)}
					className="bg-transparent border border-inverse/20 rounded-md px-[8px] py-[6px] text-[12px] text-inverse"
				/>
			</div>

			{/* Placeholder */}
			<div className="flex flex-col gap-[4px]">
				<span className="text-[11px] text-inverse/50 font-medium uppercase tracking-wider">
					Input Placeholder
				</span>
				<input
					type="text"
					value={widgetPlaceholder}
					onChange={(e) =>
						handleFieldChange("widgetPlaceholder", e.target.value)
					}
					className="bg-transparent border border-inverse/20 rounded-md px-[8px] py-[6px] text-[12px] text-inverse"
				/>
			</div>

			{/* Primary Color */}
			<div className="flex flex-col gap-[4px]">
				<span className="text-[11px] text-inverse/50 font-medium uppercase tracking-wider">
					Primary Color
				</span>
				<div className="flex items-center gap-[8px]">
					<input
						type="color"
						value={widgetColor}
						onChange={(e) =>
							handleFieldChange("widgetColor", e.target.value)
						}
						className="w-[32px] h-[32px] rounded-md border border-inverse/20 bg-transparent cursor-pointer"
					/>
					<input
						type="text"
						value={widgetColor}
						onChange={(e) =>
							handleFieldChange("widgetColor", e.target.value)
						}
						className="flex-1 bg-transparent border border-inverse/20 rounded-md px-[8px] py-[6px] text-[12px] text-inverse font-mono"
					/>
				</div>
			</div>

			{/* Welcome Message */}
			<div className="flex flex-col gap-[4px]">
				<span className="text-[11px] text-inverse/50 font-medium uppercase tracking-wider">
					Welcome Message (optional)
				</span>
				<textarea
					value={welcomeMessage}
					onChange={(e) =>
						handleFieldChange("welcomeMessage", e.target.value)
					}
					placeholder="Hi! How can I help you today?"
					rows={2}
					className="bg-transparent border border-inverse/20 rounded-md px-[8px] py-[6px] text-[12px] text-inverse resize-none"
				/>
			</div>

			{/* Save Button */}
			<button
				type="button"
				onClick={handleSave}
				disabled={isPending}
				className="flex items-center justify-center gap-[6px] px-[12px] py-[8px] rounded-[8px] bg-trigger-node-1/20 border border-trigger-node-1 text-inverse text-[12px] font-medium hover:bg-trigger-node-1/30 transition-colors disabled:opacity-50"
			>
				{isPending ? (
					<SpinnerIcon className="animate-follow-through-overlap-spin size-[14px]" />
				) : null}
				{isPending ? "Saving..." : "Save Configuration"}
			</button>

			{/* Embed Snippets */}
			<div className="flex flex-col gap-[8px] pt-[8px] border-t border-inverse/10">
				<span className="text-[11px] text-inverse/50 font-medium uppercase tracking-wider">
					Embed Code
				</span>

				{/* Script Tag */}
				<div className="flex flex-col gap-[4px]">
					<div className="flex items-center justify-between">
						<span className="text-[10px] text-inverse/40">
							Script Tag (floating widget)
						</span>
						<button
							type="button"
							onClick={() => handleCopy(scriptSnippet, "script")}
							className="text-[10px] text-inverse/40 hover:text-inverse/60 flex items-center gap-[4px]"
						>
							{copiedField === "script" ? (
								<>
									<CheckIcon className="size-[10px] text-green-400" />
									Copied
								</>
							) : (
								<>
									<CopyIcon className="size-[10px]" />
									Copy
								</>
							)}
						</button>
					</div>
					<div className="bg-inverse/5 rounded-[6px] p-[8px]">
						<code className="text-[9px] text-inverse/60 font-mono block whitespace-pre-wrap break-all">
							{scriptSnippet}
						</code>
					</div>
				</div>

				{/* iframe */}
				<div className="flex flex-col gap-[4px]">
					<div className="flex items-center justify-between">
						<span className="text-[10px] text-inverse/40">
							iframe (inline embed)
						</span>
						<button
							type="button"
							onClick={() => handleCopy(iframeSnippet, "iframe")}
							className="text-[10px] text-inverse/40 hover:text-inverse/60 flex items-center gap-[4px]"
						>
							{copiedField === "iframe" ? (
								<>
									<CheckIcon className="size-[10px] text-green-400" />
									Copied
								</>
							) : (
								<>
									<CopyIcon className="size-[10px]" />
									Copy
								</>
							)}
						</button>
					</div>
					<div className="bg-inverse/5 rounded-[6px] p-[8px]">
						<code className="text-[9px] text-inverse/60 font-mono block whitespace-pre-wrap break-all">
							{iframeSnippet}
						</code>
					</div>
				</div>
			</div>

			{/* Help text */}
			<p className="text-[10px] text-inverse/30">
				The chat widget provides a conversational interface for your AI
				workflow. Users can send messages and receive streaming responses.
				Embed using the script tag for a floating widget, or use the iframe
				for inline placement.
			</p>
		</div>
	);
}
