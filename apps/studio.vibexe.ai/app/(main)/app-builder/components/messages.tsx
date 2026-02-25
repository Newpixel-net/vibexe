"use client";

/**
 * Message Components — Aurora Glass Design
 *
 * Glass message cards with warm user tint and cool AI tint.
 * Markdown rendering, code highlighting, and tool event display.
 */

import {
	AlertCircle,
	Bot,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	Copy,
	FileCode,
	FileText,
	Loader2,
	MoreHorizontal,
	RotateCcw,
	User,
	Volume2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeExternalLinks from "rehype-external-links";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Attachment, ChatMessage, ToolEvent } from "../types/vibesdk";
import { AttachmentLightbox } from "./attachment-lightbox";
import { SpeakButton, speakText } from "./speak-button";

interface MarkdownContentProps {
	content: string;
	className?: string;
}

/**
 * Markdown renderer with glass-themed code blocks.
 */
export function MarkdownContent({ content, className }: MarkdownContentProps) {
	return (
		<div
			className={cn("prose prose-sm dark:prose-invert max-w-none", className)}
		>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				rehypePlugins={[
					[
						rehypeExternalLinks,
						{ target: "_blank", rel: ["noopener", "noreferrer"] },
					],
				]}
				components={{
					code({ className, children, ...props }) {
						const isInline = !className;
						if (isInline) {
							return (
								<code
									className="px-1.5 py-0.5 rounded-md bg-white/[0.08] font-mono text-sm text-white/80"
									{...props}
								>
									{children}
								</code>
							);
						}
						const language = className?.replace("language-", "") || "";
						return (
							<div className="relative group my-3">
								{language && (
									<div className="absolute top-0 right-0 px-2 py-1 text-xs text-white/30 bg-white/[0.04] rounded-bl-lg">
										{language}
									</div>
								)}
								<pre className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.08] overflow-x-auto">
									<code
										className={cn("font-mono text-sm text-white/80", className)}
										{...props}
									>
										{children}
									</code>
								</pre>
							</div>
						);
					},
					a({ children, href, ...props }) {
						return (
							<a
								href={href}
								className="text-violet-400 hover:text-violet-300 hover:underline"
								{...props}
							>
								{children}
							</a>
						);
					},
					h1: ({ children }) => (
						<h1 className="text-xl font-bold mt-4 mb-2 text-white/90">{children}</h1>
					),
					h2: ({ children }) => (
						<h2 className="text-lg font-semibold mt-3 mb-2 text-white/90">{children}</h2>
					),
					h3: ({ children }) => (
						<h3 className="text-base font-medium mt-2 mb-1 text-white/85">{children}</h3>
					),
					ul: ({ children }) => (
						<ul className="list-disc list-inside my-2 space-y-1">{children}</ul>
					),
					ol: ({ children }) => (
						<ol className="list-decimal list-inside my-2 space-y-1">
							{children}
						</ol>
					),
					li: ({ children }) => <li className="text-white/70">{children}</li>,
					p: ({ children }) => (
						<p className="my-2 leading-relaxed text-white/70">{children}</p>
					),
					blockquote: ({ children }) => (
						<blockquote className="border-l-2 border-gradient-to-b from-violet-500 to-cyan-500 pl-4 my-2 italic text-white/50"
							style={{ borderImage: "linear-gradient(to bottom, rgb(139,92,246), rgb(6,182,212)) 1" }}
						>
							{children}
						</blockquote>
					),
				}}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
}

/**
 * Split markdown into intro paragraph and collapsible details.
 * Splits at the first bold heading (**Text:**), markdown heading (#), or
 * list that follows a blank line — whichever comes first.
 */
function splitMarkdownIntro(content: string): {
	intro: string;
	details: string;
} {
	// Match: blank line followed by bold heading, markdown heading, or list item
	const splitPattern = /\n\n(?=\*\*[^*]+\*\*:?|#{1,3}\s|[-*]\s|\d+\.\s)/;
	const match = content.match(splitPattern);
	if (!match || match.index === undefined) {
		return { intro: content, details: "" };
	}
	return {
		intro: content.slice(0, match.index).trim(),
		details: content.slice(match.index).trim(),
	};
}

/** Minimum details length to bother collapsing */
const COLLAPSE_THRESHOLD = 120;

/**
 * Animated typing dots — three bouncing dots for AI thinking state.
 */
function TypingIndicator() {
	return (
		<div className="flex items-center gap-1 py-1">
			{[0, 1, 2].map((i) => (
				<span
					key={i}
					className="w-1.5 h-1.5 rounded-full bg-teal-400/60"
					style={{
						animation: "typing-bounce 1.4s ease-in-out infinite",
						animationDelay: `${i * 0.16}s`,
					}}
				/>
			))}
			<style>{`
				@keyframes typing-bounce {
					0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
					30% { transform: translateY(-4px); opacity: 1; }
				}
			`}</style>
		</div>
	);
}

/**
 * Avatar bubble — gradient circle with icon.
 */
function Avatar({ variant }: { variant: "user" | "ai" }) {
	if (variant === "user") {
		return (
			<div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-orange-400/80 to-amber-500/80 flex items-center justify-center shadow-[0_0_10px_rgba(251,146,60,0.2)]">
				<User className="size-3.5 text-white" />
			</div>
		);
	}
	return (
		<div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-teal-400/80 to-cyan-500/80 flex items-center justify-center shadow-[0_0_10px_rgba(20,184,166,0.25)]">
			<Bot className="size-3.5 text-white" />
		</div>
	);
}

interface CollapsibleMarkdownProps {
	content: string;
	className?: string;
}

/**
 * Collapsible markdown — shows intro text with expand/collapse for long responses.
 */
function CollapsibleMarkdownContent({
	content,
	className,
}: CollapsibleMarkdownProps) {
	const [expanded, setExpanded] = useState(false);
	const { intro, details } = useMemo(
		() => splitMarkdownIntro(content),
		[content],
	);

	const shouldCollapse = details.length > COLLAPSE_THRESHOLD;

	if (!shouldCollapse) {
		return <MarkdownContent content={content} className={className} />;
	}

	return (
		<div>
			<div className="relative">
				<MarkdownContent content={intro} className={className} />
				{!expanded && (
					<div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[rgba(255,255,255,0.03)] to-transparent pointer-events-none" />
				)}
			</div>
			<button
				type="button"
				onClick={() => setExpanded((v) => !v)}
				className="flex items-center gap-1.5 mt-2 mb-1 px-3 py-1.5 rounded-lg text-xs font-medium text-teal-400/70 hover:text-teal-300 bg-teal-500/[0.06] hover:bg-teal-500/[0.12] border border-teal-500/[0.08] hover:border-teal-500/[0.15] transition-all duration-200 group"
			>
				{expanded ? (
					<>
						<ChevronDown className="size-3 transition-transform group-hover:translate-y-0.5" />
						Collapse
					</>
				) : (
					<>
						<ChevronRight className="size-3 transition-transform group-hover:translate-x-0.5" />
						Expand details
					</>
				)}
			</button>
			{expanded && (
				<div className="animate-in fade-in slide-in-from-top-1 duration-200">
					<MarkdownContent content={details} className={className} />
				</div>
			)}
		</div>
	);
}

/**
 * Tool event status indicator — glass chip style.
 */
function ToolStatusIndicator({ event, isActiveGeneration }: { event: ToolEvent; isActiveGeneration?: boolean }) {
	// If event shows "running" but no active generation → stale/interrupted
	const effectiveStatus =
		(event.status === "running" || event.status === "pending") && !isActiveGeneration
			? "interrupted"
			: event.status;

	const getStatusIcon = () => {
		switch (effectiveStatus) {
			case "completed":
				return <CheckCircle2 className="size-3 text-teal-400" />;
			case "running":
				return (
					<Loader2 className="size-3 text-white/40 animate-spin" />
				);
			case "interrupted":
				return <AlertCircle className="size-3 text-amber-400/70" />;
			case "error":
				return <AlertCircle className="size-3 text-red-400" />;
			default:
				return <Loader2 className="size-3 text-white/30" />;
		}
	};

	const getToolLabel = () => {
		const past = effectiveStatus === "interrupted" || effectiveStatus === "completed";
		switch (event.toolName) {
			case "createFile":
			case "create_file":
				return `${past ? "Created" : "Creating"} ${(event.args as { path?: string }).path || "file"}`;
			case "updateFile":
			case "update_file":
				return `${past ? "Updated" : "Updating"} ${(event.args as { path?: string }).path || "file"}`;
			case "deleteFile":
			case "delete_file":
				return `${past ? "Deleted" : "Deleting"} ${(event.args as { path?: string }).path || "file"}`;
			default:
				return event.toolName;
		}
	};

	return (
		<div className="flex items-center gap-2 px-3 py-1.5 my-1 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white/50">
			<FileCode className="size-3" />
			{getStatusIcon()}
			<span>{getToolLabel()}</span>
		</div>
	);
}

/**
 * Collapsed summary for tool events — glass chip style.
 */
function ToolEventsSummary({ events, isActiveGeneration }: { events: ToolEvent[]; isActiveGeneration?: boolean }) {
	const [expanded, setExpanded] = useState(false);

	if (events.length <= 2) {
		return (
			<>
				{events.map((event) => (
					<ToolStatusIndicator key={event.id} event={event} isActiveGeneration={isActiveGeneration} />
				))}
			</>
		);
	}

	const hasRunningEvents = events.some(
		(e) => e.status === "running" || e.status === "pending",
	);
	// Only show the spinning progress UI when the generation is ACTUALLY running.
	// If events have "running" status but the generation is NOT active, it means
	// the stream was interrupted (page reload, connection lost, timeout).
	const isActivelyStreaming = hasRunningEvents && !!isActiveGeneration;
	const completed = events.filter((e) => e.status === "completed").length;

	const counts: Record<string, number> = {};
	for (const e of events) {
		const action = getToolAction(e.toolName);
		counts[action] = (counts[action] || 0) + 1;
	}

	const summaryParts = Object.entries(counts).map(
		([action, count]) => `${action} ${count} file${count > 1 ? "s" : ""}`,
	);
	const summaryText = summaryParts.join(", ");

	if (isActivelyStreaming) {
		const pct = events.length > 0 ? (completed / events.length) * 100 : 0;
		return (
			<div className="rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2 my-1">
				<div className="flex items-center gap-2 text-sm text-white/50">
					<FileCode className="size-3.5" />
					<Loader2 className="size-3 animate-spin" />
					<span>
						Working on files... ({completed} of {events.length} done)
					</span>
				</div>
				<div className="mt-1.5 h-1 rounded-full bg-white/[0.06] overflow-hidden">
					<div
						className="h-full rounded-full bg-gradient-to-r from-violet-500/60 to-teal-500/60 transition-all duration-300"
						style={{ width: `${pct}%` }}
					/>
				</div>
			</div>
		);
	}

	// Stale/interrupted state: events have "running" status but no active generation
	const wasInterrupted = hasRunningEvents && !isActiveGeneration;

	return (
		<div className="rounded-xl bg-white/[0.04] border border-white/[0.08] my-1">
			<button
				type="button"
				className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white/50 hover:text-white/70 transition-colors"
				onClick={() => setExpanded(!expanded)}
			>
				<FileCode className="size-3.5" />
				{wasInterrupted ? (
					<AlertCircle className="size-3 text-amber-400/70" />
				) : (
					<CheckCircle2 className="size-3 text-teal-400" />
				)}
				<span className="flex-1 text-left">
					{wasInterrupted
						? `Worked on files (${completed} of ${events.length} completed)`
						: summaryText}
				</span>
				<ChevronDown
					className={cn(
						"size-3.5 transition-transform",
						expanded && "rotate-180",
					)}
				/>
			</button>
			{expanded && (
				<div className="px-3 pb-2 space-y-0.5">
					{events.map((event) => (
						<div
							key={event.id}
							className="flex items-center gap-2 text-xs text-white/40 py-0.5"
						>
							{event.status === "completed" ? (
								<CheckCircle2 className="size-2.5 text-teal-400" />
							) : event.status === "error" ? (
								<AlertCircle className="size-2.5 text-red-400" />
							) : (
								<AlertCircle className="size-2.5 text-amber-400/50" />
							)}
							<span>{(event.args as { path?: string }).path || event.toolName}</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function getToolAction(toolName: string): string {
	switch (toolName) {
		case "createFile":
		case "create_file":
			return "Created";
		case "updateFile":
		case "update_file":
			return "Updated";
		case "deleteFile":
		case "delete_file":
			return "Deleted";
		default:
			return "Processed";
	}
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Displays attachments — glass image frames and glass doc cards.
 */
function MessageAttachments({ attachments }: { attachments: Attachment[] }) {
	const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
	const [lightboxName, setLightboxName] = useState("");
	const [lightboxSize, setLightboxSize] = useState(0);

	const images = attachments.filter((a) => a.category === "image");
	const documents = attachments.filter((a) => a.category === "document");

	const openLightbox = useCallback((att: Attachment) => {
		setLightboxUrl(att.url);
		setLightboxName(att.name);
		setLightboxSize(att.size);
	}, []);

	const gridClass =
		images.length === 1
			? ""
			: images.length <= 4
				? "grid grid-cols-2 gap-1.5"
				: "grid grid-cols-2 gap-1.5";

	const showOverflow = images.length > 4;
	const displayImages = showOverflow ? images.slice(0, 4) : images;

	return (
		<>
			{images.length > 0 && (
				<div className={cn("mt-2 max-w-[300px]", gridClass)}>
					{displayImages.map((att, idx) => (
						<div
							key={att.id}
							className="relative rounded-xl overflow-hidden cursor-pointer border border-white/[0.08]"
						>
							{/* biome-ignore lint/a11y/useKeyWithClickEvents: Image preview click */}
							{/* biome-ignore lint/performance/noImgElement: Dynamic data URLs */}
							<img
								src={att.url}
								alt={att.name}
								className={cn(
									"w-full object-cover rounded-xl",
									images.length === 1 ? "max-h-[300px]" : "h-[120px]",
								)}
								onClick={() => openLightbox(att)}
							/>
							{showOverflow && idx === 3 && (
								// biome-ignore lint/a11y/useKeyWithClickEvents: Overlay click
								<div
									className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center rounded-xl"
									onClick={() => openLightbox(att)}
								>
									<span className="text-white text-lg font-bold">
										+{images.length - 4}
									</span>
								</div>
							)}
						</div>
					))}
				</div>
			)}

			{documents.length > 0 && (
				<div className="mt-2 flex flex-col gap-1.5">
					{documents.map((att) => (
						<div
							key={att.id}
							className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] max-w-[250px]"
						>
							<FileText
								className={cn(
									"h-4 w-4 flex-shrink-0",
									att.mediaType === "application/pdf" ? "text-red-400" : "text-white/40",
								)}
							/>
							<span className="text-xs truncate flex-1 text-white/60">{att.name}</span>
							{att.size > 0 && (
								<span className="text-[10px] text-white/30 flex-shrink-0">
									{formatFileSize(att.size)}
								</span>
							)}
						</div>
					))}
				</div>
			)}

			{lightboxUrl && (
				<AttachmentLightbox
					url={lightboxUrl}
					name={lightboxName}
					size={lightboxSize}
					onClose={() => setLightboxUrl(null)}
				/>
			)}
		</>
	);
}

interface UserMessageProps {
	message: ChatMessage;
}

/**
 * User message — warm glass card with orange tint.
 */
export function UserMessage({ message }: UserMessageProps) {
	const isVisualEdit = message.content?.startsWith("[VISUAL EDIT]");
	// Extract the element tag from visual edit messages (e.g., "Element: <h1>")
	const visualEditTag = isVisualEdit
		? message.content.match(/Element:\s*<(\w+)>/)?.[1] || null
		: null;
	// Extract just the user request part for display
	const displayContent = isVisualEdit
		? message.content.match(/User request:\s*([\s\S]*)/)?.[1]?.trim() || message.content
		: message.content;

	return (
		<div className="flex gap-2.5">
			<Avatar variant="user" />
			<div className="flex-1 min-w-0">
				<span className="text-xs font-medium text-white/50 mb-1 block">You</span>
				<div className={`rounded-2xl px-4 py-3 backdrop-blur-sm border shadow-[inset_-1px_0_12px_rgba(249,115,22,0.06)] ${
					isVisualEdit
						? "bg-violet-500/[0.06] border-violet-500/[0.12]"
						: "bg-orange-500/[0.06] border-orange-500/[0.1]"
				}`}>
					{isVisualEdit && (
						<div className="flex items-center gap-1.5 mb-1.5">
							<span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-violet-500/20 text-violet-300 border border-violet-500/20">
								{visualEditTag ? `<${visualEditTag}>` : "Visual Edit"}
							</span>
							<span className="text-[10px] text-white/30">Visual Edit</span>
						</div>
					)}
					<div className="text-white/80 whitespace-pre-wrap text-sm leading-relaxed">
						{displayContent}
					</div>
					{message.attachments && message.attachments.length > 0 && (
						<MessageAttachments attachments={message.attachments} />
					)}
					{!message.attachments && message.images && message.images.length > 0 && (
						<div className="flex gap-2 mt-2 flex-wrap">
							{message.images.map((img) => (
								// biome-ignore lint/performance/noImgElement: Using native img for dynamic blob/data URLs
								<img
									key={img.id}
									src={img.url}
									alt={img.name || "Attached image"}
									className="max-w-[200px] max-h-[200px] rounded-xl object-cover border border-white/[0.08]"
								/>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

interface AIMessageProps {
	message: ChatMessage;
	isLoading?: boolean;
	aiName?: string;
	autoPlayTTS?: boolean;
	onRetry?: () => void;
	onCopy?: () => void;
}

/**
 * AI message — cool glass card with teal tint.
 */
export function AIMessage({
	message,
	isLoading,
	aiName = "Vibexe",
	autoPlayTTS,
	onRetry,
	onCopy,
}: AIMessageProps) {
	const handleCopy = () => {
		if (message.content) {
			navigator.clipboard.writeText(message.content);
		}
		onCopy?.();
	};

	return (
		<div className="flex gap-2.5">
			<Avatar variant="ai" />
			<div className="flex-1 min-w-0">
				<div className="flex items-center justify-between mb-1">
					<div className="flex items-center gap-2">
						<span className="text-xs font-medium text-white/50">
							{aiName}
						</span>
						{isLoading && (
							<span className="text-[10px] text-teal-400/50 font-medium">typing</span>
						)}
					</div>
					{!isLoading && message.content && (
						<div className="flex items-center gap-0.5">
							<SpeakButton text={message.content} autoPlay={autoPlayTTS} />
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="link" className="h-6 w-6 text-white/20 hover:text-white/60 transition-colors">
										<MoreHorizontal className="h-4 w-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="backdrop-blur-xl bg-[#1a1a2e]/95 border-white/[0.1]">
									<DropdownMenuItem onClick={() => message.content && speakText(message.content)}>
										<Volume2 className="h-4 w-4 mr-2" />
										Read Aloud
									</DropdownMenuItem>
									<DropdownMenuItem onClick={handleCopy}>
										<Copy className="h-4 w-4 mr-2" />
										Copy
									</DropdownMenuItem>
									{onRetry && (
										<DropdownMenuItem onClick={onRetry}>
											<RotateCcw className="h-4 w-4 mr-2" />
											Retry
										</DropdownMenuItem>
									)}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					)}
				</div>
				<div className="rounded-2xl px-4 py-3 bg-white/[0.03] backdrop-blur-sm border border-white/[0.08] shadow-[inset_1px_0_12px_rgba(20,184,166,0.06)]">
					{message.toolEvents && message.toolEvents.length > 0 && (
						<ToolEventsSummary events={message.toolEvents} isActiveGeneration={isLoading} />
					)}
					{message.content ? (
						<CollapsibleMarkdownContent content={message.content} />
					) : isLoading ? (
						<TypingIndicator />
					) : null}
				</div>
			</div>
		</div>
	);
}

interface MessageListProps {
	messages: ChatMessage[];
	isLoading?: boolean;
	aiName?: string;
}

/** Check if message content matches the plan-created trigger phrases */
function isTTSTrigger(content: string | undefined): boolean {
	if (!content) return false;
	const lower = content.toLowerCase();
	return (
		(lower.includes("plan created") || lower.includes("blueprint")) &&
		(lower.includes("documents tab") || lower.includes("build it"))
	);
}

export function MessageList({ messages, isLoading, aiName }: MessageListProps) {
	const prevLoadingRef = useRef(isLoading);
	const [autoPlayId, setAutoPlayId] = useState<string | null>(null);

	// Detect when streaming finishes (isLoading transitions from true to false)
	useEffect(() => {
		if (prevLoadingRef.current && !isLoading && messages.length > 0) {
			const last = messages[messages.length - 1];
			if (last.role === "assistant" && isTTSTrigger(last.content)) {
				setAutoPlayId(last.id);
			}
		}
		prevLoadingRef.current = isLoading;
	}, [isLoading, messages]);

	return (
		<div className="flex flex-col gap-5">
			{messages.map((message, index) => {
				const isLastMessage = index === messages.length - 1;
				if (message.role === "user") {
					return <UserMessage key={message.id} message={message} />;
				}
				return (
					<AIMessage
						key={message.id}
						message={message}
						isLoading={isLoading && isLastMessage}
						aiName={aiName}
						autoPlayTTS={message.id === autoPlayId}
					/>
				);
			})}
		</div>
	);
}
