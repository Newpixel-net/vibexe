"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { DefaultChatTransport, isToolUIPart } from "ai";
import clsx from "clsx";
import { Loader2, RotateCcw, Send, Workflow as WorkflowIcon } from "lucide-react";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	WorkflowPlanPreview,
	type WorkflowPlan,
} from "./workflow-plan-preview";
import { WorkflowTimeline } from "./workflow-timeline";

const generateId = () => crypto.randomUUID();

/** AI SDK v5 tool part shape */
interface ToolPart {
	type: string;
	toolCallId: string;
	toolName?: string;
	input?: unknown;
	output?: unknown;
	state: string;
}

function UserMessage({ message }: { message: UIMessage }) {
	const textContent = message.parts
		.filter((p) => p.type === "text")
		.map((p) => (p as { type: "text"; text: string }).text)
		.join("");

	return (
		<div className="flex justify-end">
			<div className="max-w-[80%] rounded-2xl bg-[rgba(0,135,246,0.12)] border border-[rgba(0,135,246,0.2)] px-4 py-2.5 text-[13px] text-text/90 leading-relaxed">
				{textContent}
			</div>
		</div>
	);
}

function AIMessage({
	message,
	isLoading,
}: {
	message: UIMessage;
	isLoading: boolean;
}) {
	const textParts = message.parts.filter((p) => p.type === "text");
	const textContent = textParts
		.map((p) => (p as { type: "text"; text: string }).text)
		.join("");

	if (!textContent && !isLoading) return null;

	return (
		<div className="flex justify-start">
			<div className="max-w-[85%] text-[13px] text-text/80 leading-relaxed whitespace-pre-wrap">
				{textContent || (isLoading && (
					<span className="inline-flex items-center gap-1.5 text-text-muted/60">
						<Loader2 className="h-3 w-3 animate-spin" />
						Thinking...
					</span>
				))}
			</div>
		</div>
	);
}

const ALL_SUGGESTIONS = [
	"Build a customer support assistant that answers questions helpfully",
	"Create a research pipeline that analyzes a topic and writes a report",
	"Build a content reviewer that checks text and suggests improvements",
	"Create an email drafter that writes professional emails from notes",
	"Build a multi-language translator with quality review",
	"Create a meeting notes summarizer that extracts action items",
	"Build a product description writer from feature lists",
	"Create a code explainer that breaks down complex code clearly",
	"Build a blog post generator that outlines then writes full articles",
	"Create a social media content creator for multiple platforms",
	"Build a resume analyzer that gives interview prep tips",
	"Create a legal document summarizer for contracts and agreements",
];

function pickRandomSuggestions(count: number): string[] {
	const shuffled = [...ALL_SUGGESTIONS].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, count);
}

/**
 * Extract the latest present_plan output from messages.
 * Scans backwards to find the most recent present_plan tool call with output.
 */
function extractLatestPlan(messages: UIMessage[]): WorkflowPlan | null {
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		for (const part of msg.parts) {
			if (!isToolUIPart(part)) continue;
			const toolPart = part as unknown as ToolPart;
			const toolName =
				toolPart.toolName || toolPart.type.replace(/^tool-/, "");
			if (toolName !== "present_plan") continue;
			if (toolPart.state !== "output-available") continue;
			const output = toolPart.output as
				| { success: boolean; plan?: WorkflowPlan }
				| undefined;
			if (output?.success && output.plan) {
				return output.plan;
			}
		}
	}
	return null;
}

/**
 * Check if any build tool has been called (create_workflow, add_node, etc.)
 */
function hasBuildStarted(messages: UIMessage[]): boolean {
	const BUILD_TOOLS = [
		"create_workflow",
		"add_node",
		"add_connection",
		"set_prompt",
		"finalize_workflow",
	];
	for (const msg of messages) {
		for (const part of msg.parts) {
			if (!isToolUIPart(part)) continue;
			const toolPart = part as unknown as ToolPart;
			const toolName =
				toolPart.toolName || toolPart.type.replace(/^tool-/, "");
			if (BUILD_TOOLS.includes(toolName)) return true;
		}
	}
	return false;
}

export function WorkflowBuilderChat() {
	const [chatId, setChatId] = useState<string>(generateId);
	const [input, setInput] = useState("");
	const scrollRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [suggestions] = useState(() => pickRandomSuggestions(5));
	const [buildApproved, setBuildApproved] = useState(false);

	const transport = useMemo(
		() =>
			new DefaultChatTransport({
				api: "/api/workflow-builder/chat",
			}),
		[],
	);

	const { messages, setMessages, sendMessage, status, error } = useChat({
		id: chatId,
		transport,
	});

	const isLoading = status === "submitted" || status === "streaming";

	const chatMessages = useMemo(
		() => messages.filter((m) => m.role === "user" || m.role === "assistant"),
		[messages],
	);

	// Detect plan and build state from messages
	const latestPlan = useMemo(() => extractLatestPlan(messages), [messages]);
	const buildStarted = useMemo(() => hasBuildStarted(messages), [messages]);

	// Show plan preview when we have a plan but haven't started building yet
	const showPlanPreview = latestPlan !== null && !buildStarted && !buildApproved;
	// Show timeline when build has started
	const showTimeline = buildStarted || buildApproved;

	// Auto-scroll when messages change
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [chatMessages, isLoading, latestPlan]);

	// Auto-resize textarea
	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
		}
	}, [input]);

	const onSubmit = useCallback(() => {
		if (input.trim() && !isLoading) {
			sendMessage({ text: input });
			setInput("");
			if (textareaRef.current) {
				textareaRef.current.style.height = "auto";
			}
		}
	}, [input, sendMessage, isLoading]);

	const handleNewChat = useCallback(() => {
		const newChatId = generateId();
		setChatId(newChatId);
		setMessages([]);
		setInput("");
		setBuildApproved(false);
	}, [setMessages]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
				e.preventDefault();
				onSubmit();
			}
		},
		[onSubmit],
	);

	const handleApprove = useCallback(() => {
		setBuildApproved(true);
		sendMessage({ text: "Build the workflow as planned." });
	}, [sendMessage]);

	// Determine placeholder text based on state
	const placeholderText = showPlanPreview
		? "Suggest changes to the plan, or click Build..."
		: "Describe the workflow you want to create...";

	// Loading text based on phase
	const loadingText = showTimeline
		? "Building workflow..."
		: "Planning workflow...";

	return (
		<div className="w-full flex flex-col">
			<div className="flex-1 min-w-0 flex flex-col px-4 sm:px-[24px] pt-[24px]">
				{/* Heading */}
				<div className="space-y-4 pb-4">
					<div className="relative flex w-full max-w-[960px] min-w-[320px] mx-auto flex-col overflow-hidden">
						<div className="w-full flex justify-center items-center pt-1 pb-1 sm:pt-2 sm:pb-2">
							<div className="flex flex-col items-center relative">
								<p className="font-thin text-[36px] font-sans text-blue-muted/70 text-center">
									Describe your workflow.
									<span className="block sm:inline">
										{" "}
										We&apos;ll build it.
									</span>
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* Chat messages area */}
				{chatMessages.length > 0 && (
					<div className="w-full max-w-[960px] mx-auto pb-4">
						{/* Reset button */}
						<div className="flex justify-end mb-2">
							<button
								type="button"
								onClick={handleNewChat}
								className="flex items-center gap-1.5 text-[11px] text-text-muted/50 hover:text-text-muted/80 transition-colors"
							>
								<RotateCcw className="h-3 w-3" />
								New conversation
							</button>
						</div>

						<div
							ref={scrollRef}
							className="max-h-[500px] overflow-y-auto rounded-xl border border-blue-muted/20 bg-[rgba(131,157,195,0.03)] p-4"
						>
							<div className="flex flex-col gap-4">
								{chatMessages.map((message, index) => {
									const isLast = index === chatMessages.length - 1;
									if (message.role === "user") {
										return (
											<UserMessage key={message.id} message={message} />
										);
									}
									return (
										<AIMessage
											key={message.id}
											message={message}
											isLoading={isLoading && isLast}
										/>
									);
								})}
								{isLoading && chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === "user" && (
									<div className="flex justify-start">
										<span className="inline-flex items-center gap-1.5 text-[13px] text-text-muted/60">
											<Loader2 className="h-3 w-3 animate-spin" />
											{loadingText}
										</span>
									</div>
								)}
							</div>

							{/* Plan Preview */}
							{showPlanPreview && latestPlan && (
								<WorkflowPlanPreview
									plan={latestPlan}
									onApprove={handleApprove}
									isBuilding={isLoading}
								/>
							)}

							{/* Workflow Timeline (build phase) */}
							{showTimeline && (
								<WorkflowTimeline
									messages={messages}
									isLoading={isLoading}
								/>
							)}
						</div>
					</div>
				)}

				{/* Error display */}
				{error && (
					<div className="w-full max-w-[960px] mx-auto mb-4">
						<div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-[12px] text-red-400">
							Error: {error.message}
						</div>
					</div>
				)}

				{/* Input area */}
				<div className="w-full max-w-[960px] mx-auto pb-8">
					<div className="relative rounded-2xl border border-blue-muted/30 bg-[rgba(131,157,195,0.06)] overflow-hidden shadow-[0_0_24px_rgba(0,135,246,0.06)]">
						<textarea
							ref={textareaRef}
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder={placeholderText}
							rows={1}
							className="w-full resize-none bg-transparent px-5 pt-4 pb-12 text-[14px] text-text placeholder:text-text-muted/40 outline-none leading-relaxed"
						/>
						<div className="absolute bottom-3 right-3 flex items-center gap-2">
							<button
								type="button"
								onClick={onSubmit}
								disabled={!input.trim() || isLoading}
								className={clsx(
									"flex items-center justify-center rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all",
									input.trim() && !isLoading
										? "bg-[rgba(0,135,246,0.2)] text-[rgba(120,180,255,0.9)] hover:bg-[rgba(0,135,246,0.3)] border border-[rgba(0,135,246,0.3)]"
										: "bg-transparent text-text-muted/30 cursor-not-allowed",
								)}
							>
								{isLoading ? (
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
								) : (
									<Send className="h-3.5 w-3.5" />
								)}
							</button>
						</div>
					</div>

					{/* Suggestions for empty state */}
					{chatMessages.length === 0 && (
						<div className="mt-4 flex flex-wrap gap-2 justify-center">
							{suggestions.map((suggestion) => (
								<button
									key={suggestion}
									type="button"
									onClick={() => {
										setInput(suggestion);
										textareaRef.current?.focus();
									}}
									className="rounded-full border border-blue-muted/20 bg-[rgba(131,157,195,0.05)] px-3.5 py-1.5 text-[11px] text-text-muted/60 hover:text-text-muted/80 hover:bg-[rgba(131,157,195,0.1)] transition-colors"
								>
									<WorkflowIcon className="h-3 w-3 inline mr-1.5 -mt-0.5" />
									{suggestion}
								</button>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
