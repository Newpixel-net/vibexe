"use client";

import type { Generation } from "@giselles-ai/protocol";
import type { UIMessage } from "ai";
import { ChevronRightIcon } from "lucide-react";
import { Accordion } from "radix-ui";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Streamdown } from "streamdown";
import { WilliIcon } from "../icons";
import { THUMB_HEIGHT } from "./constants";
import { ImageCard } from "./image-card";
import { Lightbox } from "./lightbox";

type ToolPart = Extract<UIMessage["parts"][number], { type: string }> & {
	type: string;
	toolCallId?: string;
	state?: string;
	input?: unknown;
	output?: unknown;
};

function isToolPart(part: ToolPart): boolean {
	// Recognize ALL tool parts (integration, code, built-in)
	return part.type.startsWith("tool-");
}

function formatToolOutput(part: ToolPart): string {
	if (!part.output || typeof part.output !== "object") {
		return JSON.stringify(part.output, null, 2);
	}

	const output = part.output as Record<string, unknown>;
	const toolType = part.type.replace("tool-", "").replace("github.", "");

	// Format based on tool type
	switch (toolType) {
		case "getMe": {
			const login = output.login;
			const name = output.name;
			const htmlUrl = output.html_url;
			const bio = output.bio;
			const company = output.company;
			const location = output.location;
			const publicRepos = output.public_repos;
			const followers = output.followers;
			const following = output.following;

			const parts: string[] = [];
			if (login) parts.push(`**@${String(login)}**`);
			if (name) parts.push(String(name));
			if (company) parts.push(`at ${String(company)}`);
			if (location) parts.push(`📍 ${String(location)}`);
			if (bio) parts.push(`\n${String(bio)}`);
			if (
				publicRepos !== undefined ||
				followers !== undefined ||
				following !== undefined
			) {
				const stats: string[] = [];
				if (publicRepos !== undefined) stats.push(`${publicRepos} repos`);
				if (followers !== undefined) stats.push(`${followers} followers`);
				if (following !== undefined) stats.push(`${following} following`);
				if (stats.length > 0) parts.push(`\n${stats.join(" • ")}`);
			}
			if (htmlUrl) parts.push(`\n🔗 [${String(htmlUrl)}](${String(htmlUrl)})`);

			return parts.join(" ");
		}
		case "getIssue":
		case "createIssue":
		case "updateIssue": {
			const title = output.title;
			const number = output.number;
			const state = output.state;
			const htmlUrl = output.html_url;
			const body = output.body;

			const parts: string[] = [];
			if (number !== undefined && state) {
				parts.push(`**#${String(number)}** [${String(state).toUpperCase()}]`);
			}
			if (title) parts.push(String(title));
			if (body && String(body).length > 0) {
				const bodyPreview = String(body).slice(0, 100);
				parts.push(`\n${bodyPreview}${String(body).length > 100 ? "..." : ""}`);
			}
			if (htmlUrl) parts.push(`\n🔗 [View Issue](${String(htmlUrl)})`);

			return parts.join(" ");
		}
		case "getPullRequest":
		case "createPullRequest":
		case "updatePullRequest": {
			const title = output.title;
			const number = output.number;
			const state = output.state;
			const htmlUrl = output.html_url;
			const body = output.body;
			const head = output.head as { ref?: string } | undefined;
			const base = output.base as { ref?: string } | undefined;

			const parts: string[] = [];
			if (number !== undefined && state) {
				parts.push(`**#${String(number)}** [${String(state).toUpperCase()}]`);
			}
			if (title) parts.push(String(title));
			if (head?.ref && base?.ref) {
				parts.push(`\n${String(head.ref)} → ${String(base.ref)}`);
			}
			if (body && String(body).length > 0) {
				const bodyPreview = String(body).slice(0, 100);
				parts.push(`\n${bodyPreview}${String(body).length > 100 ? "..." : ""}`);
			}
			if (htmlUrl) parts.push(`\n🔗 [View PR](${String(htmlUrl)})`);

			return parts.join(" ");
		}
		case "getFileContents":
		case "createOrUpdateFile": {
			const name = output.name;
			const path = output.path;
			const htmlUrl = output.html_url;
			const size = output.size;
			const content = output.content;

			const parts: string[] = [];
			if (name) parts.push(`**${String(name)}**`);
			if (path) parts.push(`\`${String(path)}\``);
			if (size !== undefined) {
				const sizeKB = Number(size) / 1024;
				parts.push(`(${sizeKB.toFixed(1)} KB)`);
			}
			if (content && typeof content === "string") {
				const contentPreview = content.slice(0, 150);
				parts.push(
					`\n\`\`\`\n${contentPreview}${content.length > 150 ? "..." : ""}\n\`\`\``,
				);
			}
			if (htmlUrl) parts.push(`\n🔗 [View File](${String(htmlUrl)})`);

			return parts.join(" ");
		}
		case "listIssues":
		case "listPullRequests":
		case "searchIssues":
		case "searchPullRequests": {
			const items = Array.isArray(output) ? output : [];
			if (items.length === 0) {
				return "No results found";
			}
			return `Found ${items.length} result${items.length === 1 ? "" : "s"}`;
		}
		case "addIssueComment":
		case "addPullRequestReviewComment": {
			const body = output.body;
			const htmlUrl = output.html_url;
			const id = output.id;

			const parts: string[] = [];
			if (id !== undefined) parts.push(`**Comment #${String(id)}**`);
			if (body) {
				const bodyPreview = String(body).slice(0, 100);
				parts.push(`\n${bodyPreview}${String(body).length > 100 ? "..." : ""}`);
			}
			if (htmlUrl) parts.push(`\n🔗 [View Comment](${String(htmlUrl)})`);

			return parts.join(" ");
		}
		case "web_search": {
			const action = output.action as
				| { type?: string; query?: string }
				| undefined;
			const sources = output.sources as
				| Array<{ type?: string; url?: string }>
				| undefined;

			const parts: string[] = [];
			if (action?.query) {
				parts.push(`🔍 **Search:** "${String(action.query)}"`);
			}
			if (sources && Array.isArray(sources) && sources.length > 0) {
				parts.push(
					`\n📄 **Found ${sources.length} source${sources.length === 1 ? "" : "s"}:**`,
				);
				sources.slice(0, 5).forEach((source, index) => {
					if (source.url) {
						try {
							const url = new URL(source.url);
							const domain = url.hostname.replace("www.", "");
							parts.push(`\n${index + 1}. [${domain}](${String(source.url)})`);
						} catch {
							parts.push(
								`\n${index + 1}. [${String(source.url)}](${String(source.url)})`,
							);
						}
					}
				});
				if (sources.length > 5) {
					parts.push(`\n... and ${sources.length - 5} more`);
				}
			} else {
				parts.push("\nNo sources found");
			}

			return parts.join("");
		}
		default: {
			// Generic formatting for unknown tools
			const keys = Object.keys(output);
			if (keys.length === 0) {
				return "Empty response";
			}
			// Show first few key-value pairs
			const preview = keys
				.slice(0, 5)
				.map((key) => {
					const value = output[key];
					if (value === null || value === undefined) return null;
					if (typeof value === "string" && value.length > 50) {
						return `${key}: ${value.slice(0, 50)}...`;
					}
					if (typeof value === "object") {
						return `${key}: {...}`;
					}
					return `${key}: ${String(value)}`;
				})
				.filter(Boolean)
				.join("\n");

			return preview || JSON.stringify(output, null, 2);
		}
	}
}

function formatToolName(rawType: string): string {
	const name = rawType.replace("tool-", "");
	// Format "slack_sendMessage" -> "Slack: Send Message"
	if (name.includes("_")) {
		const [piece, ...actionParts] = name.split("_");
		const action = actionParts.join("_");
		// Convert camelCase to Title Case
		const formatted = action.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
		return `${piece.charAt(0).toUpperCase() + piece.slice(1)}: ${formatted}`;
	}
	return name.replace("github.", "");
}

function ToolResult({ part }: { part: ToolPart }) {
	const [isExpanded, setIsExpanded] = useState(false);
	const toolName = formatToolName(part.type);
	const hasOutput =
		part.state === "output-available" && part.output !== undefined;
	const isInputAvailable = part.state === "input-available";
	const compactOutput = hasOutput
		? formatToolOutput(part)
		: isInputAvailable
			? "Executing..."
			: "Running...";
	const accordionValue = `tool-${part.toolCallId ?? part.type}`;

	return (
		<Accordion.Root
			type="single"
			collapsible
			className="my-[8px]"
			value={isExpanded ? accordionValue : ""}
			onValueChange={(value) => setIsExpanded(value === accordionValue)}
		>
			<Accordion.Item value={accordionValue}>
				<Accordion.Trigger className="group text-inverse text-[12px] flex items-center gap-[4px] cursor-pointer hover:text-inverse transition-colors data-[state=open]:text-inverse outline-none font-sans">
					<ChevronRightIcon
						className="size-[16px] transition-transform duration-300 ease-[cubic-bezier(0.87,_0,_0.13,_1)] group-data-[state=open]:rotate-90"
						aria-hidden
					/>
					<span className="text-inverse">
						{part.type.startsWith("tool-web_search") ? "🔍" : "🔧"} {toolName}
						{hasOutput && " ✓"}
					</span>
				</Accordion.Trigger>
				<Accordion.Content className="overflow-hidden text-[14px] text-inverse ml-[8px] pl-[12px] mb-[8px] data-[state=closed]:animate-slideUp data-[state=open]:animate-slideDown border-l border-l-[color-mix(in_srgb,var(--color-text-inverse,#fff)_20%,transparent)]">
					<div className="py-[4px]">
						<Streamdown className="markdown-renderer">
							{compactOutput}
						</Streamdown>
					</div>
					{isExpanded && (
						<div className="mt-[8px] pt-[8px] border-t border-t-[color-mix(in_srgb,var(--color-text-inverse,#fff)_20%,transparent)]">
							<details className="text-[12px] text-text-muted">
								<summary className="cursor-pointer mb-[4px]">Raw JSON</summary>
								<pre className="text-[11px] overflow-x-auto bg-[color-mix(in_srgb,var(--color-text-inverse,#fff)_10%,transparent)] p-[8px] rounded-[4px]">
									{JSON.stringify(
										{ input: part.input, output: part.output },
										null,
										2,
									)}
								</pre>
							</details>
						</div>
					)}
				</Accordion.Content>
			</Accordion.Item>
		</Accordion.Root>
	);
}

function mergeAdjacentTextParts<T extends UIMessage>({ parts, ...message }: T) {
	const merged: T["parts"] = [];
	let buffer = "";

	for (const part of parts) {
		if (part.type === "text") {
			buffer += part.text;
			continue;
		}
		// Flush any buffered text before pushing a non-text part
		if (buffer.length > 0) {
			merged.push({ type: "text", text: buffer });
			buffer = "";
		}
		merged.push(part);
	}

	// Flush tail buffer
	if (buffer.length > 0) {
		merged.push({ type: "text", text: buffer });
	}

	return {
		...message,
		parts: merged,
	};
}

function Spinner() {
	return (
		<div className="flex gap-[12px] text-text-muted">
			<WilliIcon className="w-[20px] h-[20px] animate-pop-pop-1" />
			<WilliIcon className="w-[20px] h-[20px] animate-pop-pop-2" />
			<WilliIcon className="w-[20px] h-[20px] animate-pop-pop-3" />
		</div>
	);
}

export function GenerationView({ generation }: { generation: Generation }) {
	const [lightboxImage, setLightboxImage] = useState<string | null>(null);

	// Handle ESC key to close lightbox
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && lightboxImage) {
				setLightboxImage(null);
			}
		};

		if (lightboxImage) {
			document.addEventListener("keydown", handleKeyDown);
		}

		return () => {
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [lightboxImage]);

	const generatedMessages = useMemo(() => {
		if ("messages" in generation && generation.messages !== undefined) {
			return generation.messages
				.filter((m) => m.role === "assistant")
				.map((message) => mergeAdjacentTextParts(message));
		}
		return [];
	}, [generation]);

	// Check if messages contain actual text content (not just step-start markers)
	const hasTextInMessages = useMemo(() => {
		return generatedMessages.some((m) =>
			m.parts.some(
				(p) => p.type === "text" || p.type === "reasoning" || p.type.startsWith("tool-"),
			),
		);
	}, [generatedMessages]);

	// Fallback: extract generated-text from outputs when messages lack text content
	const outputText = useMemo(() => {
		if (hasTextInMessages) return null;
		if (generation.status !== "completed" || !("outputs" in generation)) return null;
		const textOutputs = (generation as { outputs: Array<{ type: string; content?: string }> }).outputs
			.filter((o) => o.type === "generated-text" && o.content)
			.map((o) => o.content as string);
		return textOutputs.length > 0 ? textOutputs.join("\n\n") : null;
	}, [generation, hasTextInMessages]);

	if (generation.status === "failed") {
		return (
			<div>
				<p>{generation.error.message}</p>
				<p>id: {generation.id}</p>
			</div>
		);
	}

	if (
		generation.status !== "running" &&
		generation.status !== "completed" &&
		generation.status !== "cancelled" &&
		generation.status !== "awaiting_review"
	) {
		return (
			<div className="pt-[8px]">
				<Spinner />
			</div>
		);
	}

	return (
		<>
			{generation.status === "completed" &&
				generation.outputs.map((output) => {
					if (output.type === "structured-data" && "data" in output) {
						const data = (output as { data: unknown }).data;
						const displayText = typeof data === "string" ? data : JSON.stringify(data, null, 2);
						return (
							<div key={output.outputId} className="pt-[6px]">
								<pre className="text-[11px] text-inverse/70 bg-inverse/5 rounded-md px-3 py-2 overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap break-words border border-inverse/10">
									{displayText}
								</pre>
							</div>
						);
					}
					if (output.type !== "generated-image") {
						return null;
					}
					return (
						<div
							key={output.outputId}
							className="flex gap-[12px] pt-[8px] overflow-x-auto max-w-full"
							style={{ height: `${THUMB_HEIGHT.sm}px` }}
						>
							{output.contents.map((content) => (
								// Generated images are served by the Giselle HTTP handler.
								// `content.pathname` is stored as `/generations/...`, so we prefix it here.
								// This avoids putting transport details (basePath) on `GiselleClient`.
								// If/when we move this endpoint, update the prefix accordingly.
								<ImageCard
									key={content.filename}
									src={`/api${content.pathname}`}
									onDownload={() => {
										const link = document.createElement("a");
										link.href = `/api${content.pathname}`;
										link.download = content.filename;
										link.click();
									}}
									onZoom={() => setLightboxImage(`/api${content.pathname}`)}
								/>
							))}
						</div>
					);
				})}
			{generatedMessages.map((message, messageIndex) => {
				// Count step-start parts to display step numbers
				let stepCounter = 0;
				const totalSteps = message.parts.filter((p) => p.type === "step-start").length;
				return (
				<div key={`${message.id ?? "message"}-${messageIndex}`}>
					{message.parts.map((part, partIndex) => {
						const lastPart = message.parts.length === partIndex + 1;
						const partKey = `${message.id}-${partIndex}-${part.type}`;
						const toolPart = part as ToolPart;
						if (part.type.startsWith("tool-") && isToolPart(toolPart)) {
							return <ToolResult key={partKey} part={toolPart} />;
						}
						switch (part.type) {
							case "step-start": {
								stepCounter++;
								// Only show step markers when there are multiple steps (agent used tools)
								if (totalSteps <= 1) return <Fragment key={partKey} />;
								return (
									<div key={partKey} className="flex items-center gap-[8px] my-[8px] text-[11px] text-text-muted font-sans">
										<div className="flex items-center justify-center w-[20px] h-[20px] rounded-full bg-[hsla(0,0%,100%,0.08)] text-[10px] font-semibold text-inverse/60">
											{stepCounter}
										</div>
										<div className="flex-1 h-[1px] bg-[hsla(0,0%,100%,0.08)]" />
										<span>Step {stepCounter}</span>
									</div>
								);
							}
							case "reasoning":
								if (lastPart) {
									return (
										<Accordion.Root
											key={partKey}
											type="single"
											collapsible
											className="my-[8px]"
											defaultValue={`messages.${message.id}.parts.[${partIndex}].reasoning`}
										>
											<Accordion.Item
												value={`messages.${message.id}.parts.[${partIndex}].reasoning`}
											>
												<Accordion.Trigger className="group text-inverse text-[12px] flex items-center gap-[4px] cursor-pointer hover:text-inverse transition-colors data-[state=open]:text-inverse outline-none font-sans">
													<ChevronRightIcon
														className="size-[16px] transition-transform duration-300 ease-[cubic-bezier(0.87,_0,_0.13,_1)] group-data-[state=open]:rotate-90"
														aria-hidden
													/>
													<span className="bg-[length:200%_100%] bg-clip-text bg-gradient-to-r from-[rgba(255,_255,_255,_1)] via-[rgba(255,_255,_255,_0.5)] to-[rgba(255,_255,_255,_1)] text-transparent animate-shimmer">
														Thinking...
													</span>
												</Accordion.Trigger>
												<Accordion.Content className="overflow-hidden italic text-[14px] text-inverse ml-[8px] pl-[12px] mb-[8px] data-[state=closed]:animate-slideUp data-[state=open]:animate-slideDown border-l border-l-[color-mix(in_srgb,var(--color-text-inverse,#fff)_20%,transparent)]">
													<Streamdown className="markdown-renderer">
														{part.text}
													</Streamdown>
												</Accordion.Content>
											</Accordion.Item>
										</Accordion.Root>
									);
								}
								return (
									<Accordion.Root
										key={partKey}
										type="single"
										collapsible
										className="my-[8px]"
										defaultValue=""
									>
										<Accordion.Item
											value={`messages.${message.id}.parts.[${partIndex}].reason`}
										>
											<Accordion.Trigger className="group text-inverse text-[12px] flex items-center gap-[4px] cursor-pointer hover:text-inverse transition-colors data-[state=open]:text-inverse outline-none font-sans">
												<ChevronRightIcon
													className="size-[16px] transition-transform duration-300 ease-[cubic-bezier(0.87,_0,_0.13,_1)] group-data-[state=open]:rotate-90"
													aria-hidden
												/>
												<span>Thinking Process</span>
											</Accordion.Trigger>
											<Accordion.Content className="overflow-hidden italic text-[14px] text-inverse ml-[8px] pl-[12px] mb-[8px] data-[state=closed]:animate-slideUp data-[state=open]:animate-slideDown border-l border-l-[color-mix(in_srgb,var(--color-text-inverse,#fff)_20%,transparent)]">
												<Streamdown className="markdown-renderer">
													{part.text}
												</Streamdown>
											</Accordion.Content>
										</Accordion.Item>
									</Accordion.Root>
								);

							case "text":
								return (
									<div key={partKey} id={partKey}>
										<Streamdown className="markdown-renderer">
											{part.text}
										</Streamdown>
									</div>
								);
							default: {
								console.warn("unsupport part type:", part);
								return null;
							}
						}
					})}
				</div>
				);
			})}
			{/* Fallback: render generated-text output when messages lack text content */}
			{outputText && (
				<div>
					<Streamdown className="markdown-renderer">
						{outputText}
					</Streamdown>
				</div>
			)}
			{/* Human Review Card */}
			{generation.status === "awaiting_review" && "reviewContext" in generation && (
				<div className="my-[12px] rounded-[8px] border border-amber-500/40 bg-amber-500/10 p-[12px]">
					<div className="flex items-center gap-[6px] mb-[8px]">
						<span className="text-amber-400 text-[14px] font-semibold">Human Review Required</span>
					</div>
					<div className="text-[13px] text-inverse/80 mb-[4px]">
						<span className="text-inverse/50">Action:</span> {(generation as any).reviewContext.proposedAction}
					</div>
					<div className="text-[13px] text-inverse/80 mb-[8px]">
						<span className="text-inverse/50">Reason:</span> {(generation as any).reviewContext.reviewPrompt || "No reason provided"}
					</div>
					{Object.keys((generation as any).reviewContext.proposedArgs || {}).length > 0 && (
						<details className="text-[12px] text-text-muted mb-[8px]">
							<summary className="cursor-pointer mb-[4px]">Details</summary>
							<pre className="text-[11px] overflow-x-auto bg-[color-mix(in_srgb,var(--color-text-inverse,#fff)_10%,transparent)] p-[8px] rounded-[4px]">
								{JSON.stringify((generation as any).reviewContext.proposedArgs, null, 2)}
							</pre>
						</details>
					)}
					<div className="flex gap-[8px]">
						<button
							type="button"
							onClick={async () => {
								try {
									const res = await fetch(`/api/giselle/generations/${generation.id}/review`, {
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({ action: "approve" }),
									});
									if (!res.ok) console.error("Failed to approve review");
								} catch (err) {
									console.error("Approve failed:", err);
								}
							}}
							className="px-[12px] py-[6px] text-[12px] font-medium rounded-[6px] bg-green-600 hover:bg-green-500 text-white transition-colors cursor-pointer"
						>
							Approve
						</button>
						<button
							type="button"
							onClick={async () => {
								try {
									const res = await fetch(`/api/giselle/generations/${generation.id}/review`, {
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({ action: "reject" }),
									});
									if (!res.ok) console.error("Failed to reject review");
								} catch (err) {
									console.error("Reject failed:", err);
								}
							}}
							className="px-[12px] py-[6px] text-[12px] font-medium rounded-[6px] bg-red-600/80 hover:bg-red-500 text-white transition-colors cursor-pointer"
						>
							Reject
						</button>
					</div>
				</div>
			)}

			{generation.status !== "completed" &&
				generation.status !== "cancelled" &&
				generation.status !== "awaiting_review" &&
				// Show the spinner only when there is no reasoning part
				!generatedMessages.some((message) =>
					message.parts.some((part) => part.type === "reasoning"),
				) && (
					<div className="pt-[8px]">
						<Spinner />
					</div>
				)}

			{/* Image Viewer Overlay */}
			{lightboxImage && (
				<Lightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />
			)}
		</>
	);
}

// function ToolBlock({
// 	generation,
// 	contextNodeId,
// }: {
// 	contextNodeId: NodeId;
// 	generation: RunningGeneration | CompletedGeneration | CancelledGeneration;
// }) {
// 	const contextNode = useMemo(
// 		() =>
// 			generation.context.sourceNodes.find(
// 				(sourceNode) => sourceNode.id === contextNodeId,
// 			),
// 		[generation, contextNodeId],
// 	);
// 	if (contextNode === undefined) {
// 		return null;
// 	}
// 	if (contextNode.content.type === "file") {
// 		return contextNode.content.files.map((file) => file.name).join(", ");
// 	}
// 	return null;
// }
