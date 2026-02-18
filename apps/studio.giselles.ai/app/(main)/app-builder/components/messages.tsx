"use client";

/**
 * Message Components (VibeSDK)
 *
 * Provides markdown rendering, code highlighting, and tool event display
 * for the App Builder chat interface.
 */

import {
	AlertCircle,
	Bot,
	CheckCircle2,
	ChevronDown,
	Copy,
	FileCode,
	Loader2,
	MoreHorizontal,
	RotateCcw,
} from "lucide-react";
import { useState } from "react";
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
import type { ChatMessage, ToolEvent } from "../types/vibesdk";

interface MarkdownContentProps {
	content: string;
	className?: string;
}

/**
 * Markdown renderer with syntax highlighting and external link handling.
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
					// Custom code block rendering
					code({ className, children, ...props }) {
						const isInline = !className;
						if (isInline) {
							return (
								<code
									className="px-1.5 py-0.5 rounded bg-muted font-mono text-sm"
									{...props}
								>
									{children}
								</code>
							);
						}
						// Block code
						const language = className?.replace("language-", "") || "";
						return (
							<div className="relative group my-3">
								{language && (
									<div className="absolute top-0 right-0 px-2 py-1 text-xs text-muted-foreground bg-muted rounded-bl">
										{language}
									</div>
								)}
								<pre className="p-4 rounded-lg bg-muted overflow-x-auto">
									<code
										className={cn("font-mono text-sm", className)}
										{...props}
									>
										{children}
									</code>
								</pre>
							</div>
						);
					},
					// Custom link styling
					a({ children, href, ...props }) {
						return (
							<a
								href={href}
								className="text-primary hover:underline"
								{...props}
							>
								{children}
							</a>
						);
					},
					// Custom heading sizes
					h1: ({ children }) => (
						<h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>
					),
					h2: ({ children }) => (
						<h2 className="text-lg font-semibold mt-3 mb-2">{children}</h2>
					),
					h3: ({ children }) => (
						<h3 className="text-base font-medium mt-2 mb-1">{children}</h3>
					),
					// Custom list styling
					ul: ({ children }) => (
						<ul className="list-disc list-inside my-2 space-y-1">{children}</ul>
					),
					ol: ({ children }) => (
						<ol className="list-decimal list-inside my-2 space-y-1">
							{children}
						</ol>
					),
					li: ({ children }) => <li className="text-foreground">{children}</li>,
					// Custom paragraph
					p: ({ children }) => (
						<p className="my-2 leading-relaxed">{children}</p>
					),
					// Custom blockquote
					blockquote: ({ children }) => (
						<blockquote className="border-l-2 border-primary pl-4 my-2 italic text-muted-foreground">
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
 * Tool event status indicator shown inline with messages.
 */
function ToolStatusIndicator({ event }: { event: ToolEvent }) {
	const getStatusIcon = () => {
		switch (event.status) {
			case "completed":
				return <CheckCircle2 className="size-3 text-green-500" />;
			case "running":
				return (
					<Loader2 className="size-3 text-muted-foreground animate-spin" />
				);
			case "error":
				return <AlertCircle className="size-3 text-red-500" />;
			default:
				return <Loader2 className="size-3 text-muted-foreground" />;
		}
	};

	const getToolLabel = () => {
		switch (event.toolName) {
			case "createFile":
			case "create_file":
				return `Creating ${(event.args as { path?: string }).path || "file"}`;
			case "updateFile":
			case "update_file":
				return `Updating ${(event.args as { path?: string }).path || "file"}`;
			case "deleteFile":
			case "delete_file":
				return `Deleting ${(event.args as { path?: string }).path || "file"}`;
			default:
				return event.toolName;
		}
	};

	return (
		<div className="flex items-center gap-2 px-3 py-1.5 my-1 rounded bg-muted text-sm text-muted-foreground">
			<FileCode className="size-3" />
			{getStatusIcon()}
			<span>{getToolLabel()}</span>
		</div>
	);
}

/**
 * Collapsed summary for tool events (3+ events).
 * Shows live progress while streaming, collapsed summary when complete.
 */
function ToolEventsSummary({ events }: { events: ToolEvent[] }) {
	const [expanded, setExpanded] = useState(false);

	// For 1-2 events, show individual badges
	if (events.length <= 2) {
		return (
			<>
				{events.map((event) => (
					<ToolStatusIndicator key={event.id} event={event} />
				))}
			</>
		);
	}

	// Count by action and status
	const isStreaming = events.some(
		(e) => e.status === "running" || e.status === "pending",
	);
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

	if (isStreaming) {
		// Live progress card
		const pct = events.length > 0 ? (completed / events.length) * 100 : 0;
		return (
			<div className="rounded-lg bg-muted/50 border border-border/50 px-3 py-2 my-1">
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<FileCode className="size-3.5" />
					<Loader2 className="size-3 animate-spin" />
					<span>
						Working on files... ({completed} of {events.length} done)
					</span>
				</div>
				<div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
					<div
						className="h-full rounded-full bg-green-500/50 transition-all duration-300"
						style={{ width: `${pct}%` }}
					/>
				</div>
			</div>
		);
	}

	// Collapsed summary card
	return (
		<div className="rounded-lg bg-muted/50 border border-border/50 my-1">
			<button
				type="button"
				className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
				onClick={() => setExpanded(!expanded)}
			>
				<FileCode className="size-3.5" />
				<CheckCircle2 className="size-3 text-green-500" />
				<span className="flex-1 text-left">{summaryText}</span>
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
							className="flex items-center gap-2 text-xs text-muted-foreground py-0.5"
						>
							<CheckCircle2 className="size-2.5 text-green-500" />
							<span>{(event.args as { path?: string }).path || event.toolName}</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

/** Map tool name to a human-readable verb. */
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

interface UserMessageProps {
	message: ChatMessage;
}

/**
 * User message display with avatar.
 */
export function UserMessage({ message }: UserMessageProps) {
	return (
		<div className="flex gap-3">
			<div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
				<span className="text-sm font-semibold text-white">Y</span>
			</div>
			<div className="flex-1 min-w-0">
				<div className="text-sm font-medium text-foreground mb-1">You</div>
				<div className="text-foreground whitespace-pre-wrap">
					{message.content}
				</div>
				{message.images && message.images.length > 0 && (
					<div className="flex gap-2 mt-2 flex-wrap">
						{message.images.map((img) => (
							// biome-ignore lint/performance/noImgElement: Using native img for dynamic blob/data URLs which Next.js Image doesn't support
							<img
								key={img.id}
								src={img.url}
								alt={img.name || "Attached image"}
								className="max-w-[200px] max-h-[200px] rounded object-cover"
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

interface AIMessageProps {
	message: ChatMessage;
	isLoading?: boolean;
	aiName?: string;
	onRetry?: () => void;
	onCopy?: () => void;
}

/**
 * AI assistant message with markdown rendering and tool events.
 */
export function AIMessage({
	message,
	isLoading,
	aiName = "Vibexe",
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
		<div className="flex gap-3">
			<div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center">
				<Bot className="size-4 text-teal-500" />
			</div>
			<div className="flex-1 min-w-0">
				<div className="flex items-center justify-between mb-1">
					<div className="text-sm font-medium text-foreground flex items-center gap-2">
						{aiName}
						{isLoading && (
							<Loader2 className="size-3 animate-spin text-muted-foreground" />
						)}
					</div>
					{!isLoading && message.content && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="link" className="h-6 w-6">
									<MoreHorizontal className="h-4 w-4 text-muted-foreground" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
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
					)}
				</div>
				<div className="text-foreground">
					{/* Render tool events — collapsed summary for 3+ */}
					{message.toolEvents && message.toolEvents.length > 0 && (
						<ToolEventsSummary events={message.toolEvents} />
					)}
					{/* Render markdown content */}
					{message.content ? (
						<MarkdownContent content={message.content} />
					) : isLoading ? (
						<span className="text-muted-foreground animate-pulse">
							Thinking...
						</span>
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

/**
 * List of messages with alternating user/assistant display.
 */
export function MessageList({ messages, isLoading, aiName }: MessageListProps) {
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
					/>
				);
			})}
		</div>
	);
}
