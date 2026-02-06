"use client";

/**
 * ChatColumn Component
 *
 * Main chat interface integrating AI SDK's useChat hook with VibeSDK components.
 * Manages chat state, phase timeline, and message display.
 *
 * Deploy to: /opt/giselle/apps/studio.giselles.ai/app/(main)/app-builder/components/chat-column.tsx
 */

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart } from "ai";
import {
	Lightbulb,
	MessageSquare,
	MoreHorizontal,
	Rocket,
	RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AppFile } from "../adapters/file-adapter";
import { toFileTypes } from "../adapters/file-adapter";
import { toChatMessages } from "../adapters/message-adapter";
import {
	createDefaultProjectStages,
	createPhaseFromToolEvent,
	markFileCompleted,
	markFileError,
	type ToolStreamEvent,
	updatePhaseWithFile,
	updateProjectStage,
} from "../adapters/phase-adapter";
import type {
	ChatMode,
	FileType,
	ImageAttachment,
	PhaseTimelineItem,
	ProjectStage,
} from "../types/vibesdk";
import { ChatBottomBar } from "./chat-bottom-bar";
import { ChatInput } from "./chat-input";
import { AIMessage, UserMessage } from "./messages";
import { PhaseTimeline } from "./phase-timeline";

interface ChatColumnProps {
	appId: string;
	appName: string;
	files: AppFile[];
	onFilesChange: () => void;
	onFileClick: (file: FileType) => void;
}

// Generate unique ID (fallback if nanoid not available)
const generateId = () => crypto.randomUUID();

// LocalStorage keys for chat persistence
const getChatStorageKey = (appId: string) => `giselle-builder-chat-${appId}`;
const getMessagesStorageKey = (appId: string) =>
	`giselle-builder-messages-${appId}`;

/**
 * Deploy banner shown when code generation is complete.
 * Placeholder for Phase 8 deployment functionality.
 */
function DeployBanner() {
	return (
		<div className="mx-4 mb-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
			<div className="flex items-center gap-3">
				<div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
					<Rocket className="h-5 w-5 text-green-500" />
				</div>
				<div className="flex-1">
					<p className="font-medium text-green-500">Ready to Deploy</p>
					<p className="text-sm text-muted-foreground">
						Your app is ready for deployment.
					</p>
				</div>
				<Button
					variant="default"
					onClick={() => {
						window.alert(
							"Deployment coming soon! Your app will be available at a public URL.",
						);
					}}
				>
					Deploy
				</Button>
			</div>
		</div>
	);
}

export function ChatColumn({
	appId,
	appName: _appName,
	files,
	onFilesChange,
	onFileClick,
}: ChatColumnProps) {
	// Track if component has mounted (for hydration safety)
	const [hasMounted, setHasMounted] = useState(false);

	// Chat state with localStorage persistence
	const [chatId, setChatId] = useState<string>(generateId);

	const [mode, _setMode] = useState<ChatMode>("generate");
	const [input, setInput] = useState("");
	const [attachments, setAttachments] = useState<ImageAttachment[]>([]);

	// Phase state managed internally (not from props)
	const [projectStages, setProjectStages] = useState<ProjectStage[]>(
		createDefaultProjectStages,
	);
	const [phaseTimeline, setPhaseTimeline] = useState<PhaseTimelineItem[]>([]);
	const [isThinking, setIsThinking] = useState(false);

	// Ref for scroll area (needed by PhaseTimeline)
	const scrollRef = useRef<HTMLDivElement>(null);
	// Track if we've loaded messages from localStorage (prevent duplicate loads)
	const hasLoadedMessages = useRef(false);

	// Convert files to vibeFiles
	const vibeFiles = useMemo(() => toFileTypes(files), [files]);

	// Calculate progress
	const progress = useMemo(() => {
		const completed = phaseTimeline.filter(
			(p) => p.status === "completed" || p.status === "error",
		).length;
		return completed;
	}, [phaseTimeline]);

	// Check if generation is complete (all phases completed/errored, not currently loading)
	const isGenerationComplete = useMemo(() => {
		if (phaseTimeline.length === 0) return false;
		return phaseTimeline.every(
			(p) => p.status === "completed" || p.status === "error",
		);
	}, [phaseTimeline]);

	// Load chatId from localStorage after mount (hydration-safe)
	useEffect(() => {
		setHasMounted(true);
		const stored = localStorage.getItem(getChatStorageKey(appId));
		if (stored && stored !== chatId) {
			setChatId(stored);
		}
	}, [appId, chatId]);

	// Persist chatId to localStorage
	useEffect(() => {
		if (hasMounted) {
			localStorage.setItem(getChatStorageKey(appId), chatId);
		}
	}, [appId, chatId, hasMounted]);

	// Create transport with custom body for our API - recreate when mode changes
	const transport = useMemo(
		() =>
			new DefaultChatTransport({
				api: "/api/app-builder/chat",
				body: {
					appId,
					chatId,
					mode,
				},
			}),
		[appId, chatId, mode],
	);

	// useChat hook for AI interaction
	const { messages, setMessages, sendMessage, status, error, stop } = useChat({
		id: chatId,
		transport,
		onToolCall: ({ toolCall }) => {
			// Update phase timeline when a tool is called
			// AI SDK v6 uses `input` instead of `args` for tool call arguments
			const toolInput = "input" in toolCall ? toolCall.input : undefined;
			const event: ToolStreamEvent = {
				type: "tool-call",
				toolCallId: toolCall.toolCallId,
				toolName: toolCall.toolName,
				args: (toolInput as Record<string, unknown>) ?? {},
			};

			setPhaseTimeline((prev) => {
				// Try to add to existing active phase
				const activePhase = prev.find((p) => p.status === "generating");
				if (activePhase) {
					const updated = updatePhaseWithFile(activePhase, event);
					if (updated) {
						return prev.map((p) => (p.id === activePhase.id ? updated : p));
					}
				}

				// Create new phase
				const newPhase = createPhaseFromToolEvent(event, prev);
				if (newPhase) {
					// Mark "Build" stage as active when first file operation starts
					if (prev.length === 0) {
						setProjectStages((stages) =>
							updateProjectStage(
								updateProjectStage(stages, "bootstrap", "completed"),
								"code",
								"active",
							),
						);
					}
					return [...prev, newPhase];
				}
				return prev;
			});
		},
		onFinish: ({ message }) => {
			// Check if any tool invocations modified files
			const hasFileChanges = message.parts?.some((part) => {
				if (!isToolUIPart(part)) return false;
				// Check if tool produced output
				const p = part as unknown as {
					output?: { success?: boolean; action?: string; path?: string };
				};
				// Update phase timeline with completion status
				if (p.output?.path) {
					const filePath = p.output.path;
					if (p.output.success) {
						setPhaseTimeline((prev) => markFileCompleted(prev, filePath));
					} else {
						setPhaseTimeline((prev) => markFileError(prev, filePath));
					}
				}
				return (
					p.output?.success &&
					["created", "updated", "deleted"].includes(p.output?.action || "")
				);
			});
			if (hasFileChanges) {
				onFilesChange();
			}

			// Mark thinking as done
			setIsThinking(false);
		},
		onError: (error) => {
			console.error("Chat error:", error);
			setIsThinking(false);
		},
	});

	const isLoading = status === "submitted" || status === "streaming";

	// Load messages from localStorage after mount (hydration-safe)
	useEffect(() => {
		if (hasMounted && !hasLoadedMessages.current) {
			hasLoadedMessages.current = true;
			try {
				const stored = localStorage.getItem(getMessagesStorageKey(appId));
				if (stored) {
					const parsedMessages = JSON.parse(stored);
					if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
						console.log(
							"[ChatColumn] Restoring",
							parsedMessages.length,
							"messages from localStorage",
						);
						setMessages(parsedMessages);
					}
				}
			} catch (e) {
				console.error(
					"[ChatColumn] Error loading messages from localStorage:",
					e,
				);
			}
		}
	}, [hasMounted, appId, setMessages]);

	// Persist messages to localStorage whenever they change
	useEffect(() => {
		if (hasMounted && messages.length > 0) {
			localStorage.setItem(
				getMessagesStorageKey(appId),
				JSON.stringify(messages),
			);
		}
	}, [appId, messages, hasMounted]);

	// Update thinking state when loading
	useEffect(() => {
		setIsThinking(isLoading && mode === "generate");
	}, [isLoading, mode]);

	// Convert AI SDK messages to VibeSDK ChatMessage format
	const chatMessages = useMemo(() => toChatMessages(messages), [messages]);

	// Track which tool completions we've already triggered file fetches for
	const fetchedToolIds = useRef<Set<string>>(new Set());

	// Stream file updates: trigger onFilesChange per completed file tool during streaming
	useEffect(() => {
		if (chatMessages.length === 0) return;

		const latestMessage = chatMessages[chatMessages.length - 1];
		if (latestMessage?.role !== "assistant" || !latestMessage.toolEvents)
			return;

		const fileToolNames = new Set([
			"createFile",
			"updateFile",
			"deleteFile",
			"create_file",
			"update_file",
			"delete_file",
		]);

		let hasNewCompletion = false;
		for (const event of latestMessage.toolEvents) {
			if (
				event.status === "completed" &&
				fileToolNames.has(event.toolName) &&
				!fetchedToolIds.current.has(event.id)
			) {
				fetchedToolIds.current.add(event.id);
				hasNewCompletion = true;
			}
		}

		if (hasNewCompletion) {
			onFilesChange();
		}
	}, [chatMessages, onFilesChange]);

	// Auto-scroll to bottom when messages change
	useEffect(() => {
		if (scrollRef.current) {
			const viewport = scrollRef.current.querySelector(
				"[data-slot='scroll-area-viewport']",
			);
			if (viewport) {
				viewport.scrollTop = viewport.scrollHeight;
			}
		}
	}, []);

	// Submit handler
	const onSubmit = useCallback(() => {
		if (input.trim()) {
			sendMessage({ text: input });
			setInput("");
			// Mark first stage as active when user sends first message in generate mode
			if (mode === "generate" && messages.length === 0) {
				setProjectStages((stages) =>
					updateProjectStage(stages, "bootstrap", "active"),
				);
			}
		}
	}, [input, sendMessage, mode, messages.length]);

	// Start new chat
	const handleNewChat = useCallback(() => {
		const newChatId = generateId();
		setChatId(newChatId);
		localStorage.setItem(getChatStorageKey(appId), newChatId);
		// Clear stored messages for new chat
		localStorage.removeItem(getMessagesStorageKey(appId));
		// Reset chat state
		setMessages([]);
		hasLoadedMessages.current = true; // Prevent loading old messages
		// Reset phase state for new chat
		setPhaseTimeline([]);
		setProjectStages(createDefaultProjectStages());
	}, [appId, setMessages]);

	return (
		<div className="flex flex-col h-full min-h-0">
			{/* Header - minimal with dropdown menu */}
			<div className="flex items-center justify-between border-b px-4 py-3">
				<span className="text-sm text-muted-foreground">Chat</span>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="link" className="h-8 w-8">
							<MoreHorizontal className="h-4 w-4" />
							<span className="sr-only">Chat options</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={handleNewChat}>
							<RotateCcw className="h-4 w-4 mr-2" />
							Reset conversation
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{/* Messages area with scroll - PhaseTimeline renders INLINE after messages */}
			<ScrollArea ref={scrollRef} className="flex-1 min-h-0">
				<div className="pt-5 px-4 pb-4">
					{chatMessages.length === 0 ? (
						// Empty state - mode aware
						<div className="flex flex-col items-center justify-center min-h-[300px] py-20 text-center">
							{mode === "generate" ? (
								<>
									<MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
									<h3 className="text-lg font-medium mb-2">
										Hi! Describe what you want to build.
									</h3>
									<p className="text-sm text-muted-foreground max-w-md">
										I&apos;ll help you create your app by generating code and
										files.
									</p>
								</>
							) : (
								<>
									<Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
									<h3 className="text-lg font-medium mb-2">
										Let&apos;s plan your app together
									</h3>
									<p className="text-sm text-muted-foreground max-w-md">
										I&apos;ll help you think through your app&apos;s design
										without generating code yet. Switch to Generate mode when
										you&apos;re ready to build.
									</p>
								</>
							)}
						</div>
					) : (
						// Messages list using VibeSDK components
						<div className="rounded-2xl border border-border/50 bg-card/50 p-4">
							<div className="flex flex-col gap-5">
								{chatMessages.map((message, index) => {
									const isLastMessage =
										index === chatMessages.length - 1;
									if (message.role === "user") {
										return (
											<UserMessage key={message.id} message={message} />
										);
									}
									return (
										<AIMessage
											key={message.id}
											message={message}
											isLoading={isLoading && isLastMessage}
										/>
									);
								})}
							</div>

							{/* PhaseTimeline INLINE after messages */}
							{phaseTimeline.length > 0 && (
								<div className="mt-4">
									<PhaseTimeline
										projectStages={projectStages}
										phaseTimeline={phaseTimeline}
										files={vibeFiles}
										view="preview"
										onFileClick={onFileClick}
										isThinkingNext={isThinking}
										progress={progress}
										total={phaseTimeline.length}
										parentScrollRef={scrollRef}
										isThinking={isThinking}
									/>
								</div>
							)}
						</div>
					)}

					{/* Deploy banner when generation complete */}
					{isGenerationComplete && mode === "generate" && (
						<div className="mt-4">
							<DeployBanner />
						</div>
					)}
				</div>
			</ScrollArea>

			{/* Error display */}
			{error && (
				<div className="px-4 py-2 text-sm text-destructive bg-destructive/10 border-t">
					Error: {error.message}
				</div>
			)}

			{/* Input area using VibeSDK ChatInput */}
			<div className="border-t p-4">
				<ChatInput
					value={input}
					onChange={setInput}
					onSubmit={onSubmit}
					isLoading={isLoading}
					isGenerating={isLoading}
					onStop={stop}
					attachments={attachments}
					onAttachmentsChange={setAttachments}
				/>
			</div>

			{/* Bottom action bar */}
			<ChatBottomBar />
		</div>
	);
}
