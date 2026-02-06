"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import clsx from "clsx";
import { Loader2, RotateCcw, Send, Workflow as WorkflowIcon } from "lucide-react";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { WorkflowTimeline } from "./workflow-timeline";

const generateId = () => crypto.randomUUID();

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

export function WorkflowBuilderChat() {
	const [chatId, setChatId] = useState<string>(generateId);
	const [input, setInput] = useState("");
	const scrollRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

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

	// Auto-scroll when messages change
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [chatMessages, isLoading]);

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
			// Reset textarea height
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
							className="max-h-[400px] overflow-y-auto rounded-xl border border-blue-muted/20 bg-[rgba(131,157,195,0.03)] p-4"
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
											Building workflow...
										</span>
									</div>
								)}
							</div>

							{/* Workflow Timeline */}
							<WorkflowTimeline
								messages={messages}
								isLoading={isLoading}
							/>
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
							placeholder="Describe the workflow you want to create..."
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
							{[
								"Create a text summarizer using Claude",
								"Build a workflow that translates text to multiple languages",
								"Make a content review pipeline with GPT-5",
							].map((suggestion) => (
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
