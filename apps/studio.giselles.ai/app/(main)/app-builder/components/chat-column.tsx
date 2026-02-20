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
import { DefaultChatTransport } from "ai";
import { motion } from "framer-motion";
import {
	ArrowRight,
	Compass,
	Lightbulb,
	Loader2,
	MessageSquare,
	MoreHorizontal,
	Plus,
	Rocket,
	RotateCcw,
	Sparkles,
	Wrench,
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
	markAllPhasesComplete,
	type ToolStreamEvent,
	updatePhaseWithFile,
	updateProjectStage,
} from "../adapters/phase-adapter";
import { DEFAULT_MODEL_ID, getModelCapabilities } from "../lib/model-resolver";
import type {
	AgentEvent,
	Attachment,
	ChatMode,
	FileType,
	PhaseTimelineItem,
	ProjectStage,
} from "../types/vibesdk";
import {
	AgentActivityCard,
	OrchestrationHeader,
} from "./agent-activity-card";
import { ChatBottomBar } from "./chat-bottom-bar";
import { ChatInput } from "./chat-input";
import { AIMessage, UserMessage } from "./messages";
import { PhaseTimeline } from "./phase-timeline";
import { ReviewVerdict } from "./review-verdict";

interface ChatColumnProps {
	appId: string;
	appName: string;
	files: AppFile[];
	onFilesChange: () => void;
	onFileClick: (file: FileType) => void;
	onAppNameChange?: (name: string) => void;
	onGeneratingChange?: (isGenerating: boolean) => void;
}

// Generate unique ID (fallback if nanoid not available)
const generateId = () => crypto.randomUUID();

// LocalStorage keys for chat persistence
const getChatStorageKey = (appId: string) => `giselle-builder-chat-${appId}`;
const getMessagesStorageKey = (appId: string) =>
	`giselle-builder-messages-${appId}`;
const getModelStorageKey = (appId: string) =>
	`giselle-builder-model-${appId}`;

/**
 * Deploy banner shown when code generation is complete.
 * Placeholder for Phase 8 deployment functionality.
 */
function DeployBanner() {
	return (
		<div className="mx-4 mb-4 p-4 rounded-2xl bg-emerald-500/[0.06] backdrop-blur-sm border border-emerald-500/[0.12]">
			<div className="flex items-center gap-3">
				<div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/[0.12] border border-emerald-500/[0.15] flex items-center justify-center">
					<Rocket className="h-5 w-5 text-emerald-400" />
				</div>
				<div className="flex-1">
					<p className="font-medium text-emerald-400">Ready to Deploy</p>
					<p className="text-sm text-white/40">
						Your app is ready for deployment.
					</p>
				</div>
				<button
					type="button"
					onClick={() => {
						window.alert(
							"Deployment coming soon! Your app will be available at a public URL.",
						);
					}}
					className="px-4 py-2 text-sm font-medium rounded-xl bg-gradient-to-r from-emerald-500/80 to-teal-500/80 hover:from-emerald-500 hover:to-teal-500 text-white transition-all duration-200"
				>
					Deploy
				</button>
			</div>
		</div>
	);
}

/** Suggestion chips for empty state (new projects) */
const SUGGESTION_CHIPS = [
	"Task manager app",
	"Landing page with animations",
	"Dashboard with charts",
	"Social media feed",
];

/** Continuation suggestion for returning users */
interface ContinuationSuggestion {
	id: string;
	label: string;
	icon: "sparkles" | "wrench" | "compass";
	prompt: string;
}

/** Analyze response from /api/app-builder/apps/[appId]/analyze */
interface AnalyzeResponse {
	hasProject: boolean;
	fileCount?: number;
	hasBlueprint?: boolean;
	hasEntities?: boolean;
	todoCount?: number;
	todoItems?: string[];
	plannedFeatures?: string[];
	appName?: string;
}

/** Build smart suggestions from analyze response */
function buildContinuationSuggestions(
	analysis: AnalyzeResponse,
): ContinuationSuggestion[] {
	const suggestions: ContinuationSuggestion[] = [];

	// TODOs are highest priority
	if (analysis.todoCount && analysis.todoCount > 0) {
		suggestions.push({
			id: "fix-todos",
			label: `Fix ${analysis.todoCount} TODO${analysis.todoCount > 1 ? "s" : ""} in code`,
			icon: "wrench",
			prompt: `Read the existing files and fix all TODO, FIXME, and HACK comments. Replace placeholder implementations with real working code.`,
		});
	}

	// Planned features from Blueprint
	if (analysis.plannedFeatures && analysis.plannedFeatures.length > 0) {
		for (const feature of analysis.plannedFeatures.slice(0, 3)) {
			suggestions.push({
				id: `feature-${feature.slice(0, 20).replace(/\s/g, "-").toLowerCase()}`,
				label: `Implement: ${feature}`,
				icon: "sparkles",
				prompt: `Read Blueprint.md and the existing code, then implement the "${feature}" feature. Make sure to integrate it properly with the existing components.`,
			});
		}
	}

	// Always offer polish
	suggestions.push({
		id: "polish",
		label: "Improve & polish the app",
		icon: "compass",
		prompt: `Read all existing files and improve the app: better error handling, loading states, animations, accessibility, and visual polish. Don't change core functionality — just make everything more polished and production-ready.`,
	});

	return suggestions.slice(0, 4);
}

/**
 * Generate a display name from the user's first message.
 * Strips common prefixes like "Create/Build/Make a/an/the", capitalizes words, truncates to 50 chars.
 */
function generateAppName(message: string): string {
	let name = message.trim();
	// Strip common imperative prefixes
	name = name.replace(
		/^(please\s+)?(create|build|make|design|develop|generate|write|code)\s+(me\s+)?(a|an|the)\s+/i,
		"",
	);
	// Also strip without article
	name = name.replace(
		/^(please\s+)?(create|build|make|design|develop|generate|write|code)\s+(me\s+)?/i,
		"",
	);
	// Collapse URLs to just domain
	name = name.replace(
		/https?:\/\/(?:www\.)?([^\s/]+)\S*/gi,
		(_match, domain) => domain,
	);
	// Capitalize first letter of each word
	name = name
		.split(/\s+/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
	// Truncate to 50 chars at word boundary
	if (name.length > 50) {
		name = name.slice(0, 50).replace(/\s+\S*$/, "");
	}
	return name || "My App";
}

export function ChatColumn({
	appId,
	appName,
	files,
	onFilesChange,
	onFileClick,
	onAppNameChange,
	onGeneratingChange,
}: ChatColumnProps) {
	// Track if component has mounted (for hydration safety)
	const [hasMounted, setHasMounted] = useState(false);

	// Chat state with localStorage persistence
	const [chatId, setChatId] = useState<string>(generateId);

	const [mode, setMode] = useState<ChatMode>("generate");
	const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);
	const [input, setInput] = useState("");
	const [attachments, setAttachments] = useState<Attachment[]>([]);

	// Phase state managed internally (not from props)
	const [projectStages, setProjectStages] = useState<ProjectStage[]>(
		createDefaultProjectStages,
	);
	const [phaseTimeline, setPhaseTimeline] = useState<PhaseTimelineItem[]>([]);
	const [isThinking, setIsThinking] = useState(false);

	// Agent events from orchestration data stream
	const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
	const [activeAgentIds, setActiveAgentIds] = useState<Set<string>>(new Set());
	const [completedAgentIds, setCompletedAgentIds] = useState<Set<string>>(
		new Set(),
	);

	// Continuation agent state for returning users
	const [continuationSuggestions, setContinuationSuggestions] = useState<ContinuationSuggestion[]>([]);
	const [continuationLoading, setContinuationLoading] = useState(false);
	const continuationAnalyzed = useRef(false);

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

	// Load model selection from localStorage after mount
	useEffect(() => {
		if (hasMounted) {
			const stored = localStorage.getItem(getModelStorageKey(appId));
			if (stored) {
				setSelectedModelId(stored);
			}
		}
	}, [appId, hasMounted]);

	// Continuation analysis for returning users
	useEffect(() => {
		if (
			hasMounted &&
			files.length > 0 &&
			chatMessages.length === 0 &&
			!continuationAnalyzed.current &&
			!continuationLoading
		) {
			continuationAnalyzed.current = true;
			setContinuationLoading(true);
			fetch(`/api/app-builder/apps/${appId}/analyze`)
				.then((res) => (res.ok ? res.json() : null))
				.then((data: AnalyzeResponse | null) => {
					if (data?.hasProject) {
						setContinuationSuggestions(buildContinuationSuggestions(data));
					}
				})
				.catch(() => {})
				.finally(() => setContinuationLoading(false));
		}
	}, [hasMounted, files.length, chatMessages.length, appId, continuationLoading]);

	// Persist model selection to localStorage
	const handleModelChange = useCallback(
		(modelId: string) => {
			setSelectedModelId(modelId);
			localStorage.setItem(getModelStorageKey(appId), modelId);
		},
		[appId],
	);

	// Create transport with custom body for our API - recreate when mode or model changes
	const transport = useMemo(
		() =>
			new DefaultChatTransport({
				api: "/api/app-builder/chat",
				body: {
					appId,
					chatId,
					mode,
					modelId: selectedModelId,
				},
			}),
		[appId, chatId, mode, selectedModelId],
	);

	// useChat hook for AI interaction
	const { messages, setMessages, sendMessage, status, error, stop } =
		useChat({
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
					// Mark stages when first file operation starts
					if (prev.length === 0) {
						setProjectStages((stages) =>
							updateProjectStage(
								updateProjectStage(
									updateProjectStage(stages, "bootstrap", "completed"),
									"blueprint",
									"completed",
								),
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
		onFinish: () => {
			// Fetch latest files in case any were created/updated
			onFilesChange();
			setIsThinking(false);
		},
		onError: (error) => {
			console.error("Chat error:", error);
			setIsThinking(false);
		},
	});

	const isLoading = status === "submitted" || status === "streaming";

	// Notify parent when generating state changes (for preview loading overlay)
	useEffect(() => {
		onGeneratingChange?.(isLoading);
	}, [isLoading, onGeneratingChange]);

	// Debounced DB save timer
	const dbSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const dbChatId = useRef<string | null>(null);

	/** Save messages to DB (fire-and-forget). */
	const saveToDb = useCallback(
		(msgs: typeof messages) => {
			const cid = dbChatId.current;
			if (!cid || msgs.length === 0) return;
			fetch(`/api/app-builder/apps/${appId}/chat`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ messages: msgs }),
			}).catch((e) => console.error("[ChatColumn] DB save error:", e));
		},
		[appId],
	);

	// Load messages from DB first, fallback to localStorage
	useEffect(() => {
		if (hasMounted && !hasLoadedMessages.current) {
			hasLoadedMessages.current = true;

			fetch(`/api/app-builder/apps/${appId}/chat`)
				.then((res) => (res.ok ? res.json() : null))
				.then((data) => {
					if (data?.chatId) {
						dbChatId.current = data.chatId;
					}
					if (
						data?.messages &&
						Array.isArray(data.messages) &&
						data.messages.length > 0
					) {
						console.log(
							"[ChatColumn] Restoring",
							data.messages.length,
							"messages from DB",
						);
						setMessages(data.messages);
						return;
					}
					// Fallback to localStorage
					const stored = localStorage.getItem(getMessagesStorageKey(appId));
					if (stored) {
						const parsedMessages = JSON.parse(stored);
						if (
							Array.isArray(parsedMessages) &&
							parsedMessages.length > 0
						) {
							console.log(
								"[ChatColumn] Restoring",
								parsedMessages.length,
								"messages from localStorage",
							);
							setMessages(parsedMessages);
						}
					}
				})
				.catch((e) => {
					console.error("[ChatColumn] DB load error, falling back to localStorage:", e);
					try {
						const stored = localStorage.getItem(getMessagesStorageKey(appId));
						if (stored) {
							const parsedMessages = JSON.parse(stored);
							if (
								Array.isArray(parsedMessages) &&
								parsedMessages.length > 0
							) {
								setMessages(parsedMessages);
							}
						}
					} catch (_) {
						// ignore
					}
				});
		}
	}, [hasMounted, appId, setMessages]);

	// Persist messages to localStorage + debounced DB save
	useEffect(() => {
		if (hasMounted && messages.length > 0) {
			localStorage.setItem(
				getMessagesStorageKey(appId),
				JSON.stringify(messages),
			);
			// Debounce DB save (3s)
			if (dbSaveTimer.current) clearTimeout(dbSaveTimer.current);
			dbSaveTimer.current = setTimeout(() => saveToDb(messages), 3000);
		}
	}, [appId, messages, hasMounted, saveToDb]);

	// Extract agent events from data parts in assistant messages
	const processedEventCount = useRef(0);
	useEffect(() => {
		if (messages.length === 0) return;

		// Find latest assistant message with data parts
		const lastAssistant = [...messages]
			.reverse()
			.find((m) => m.role === "assistant");
		if (!lastAssistant?.parts) return;

		// Extract data-agent-event parts
		const events: AgentEvent[] = [];
		for (const part of lastAssistant.parts) {
			if (
				"type" in part &&
				part.type === "data-agent-event" &&
				"data" in part
			) {
				events.push(
					(part as { type: string; data: AgentEvent }).data,
				);
			}
		}

		// Only update if we have new events
		if (events.length > processedEventCount.current) {
			processedEventCount.current = events.length;
			setAgentEvents(events);
			const startIds = events
				.filter((e) => e.type === "agent-start" && e.agentId)
				.map((e) => e.agentId!);
			setActiveAgentIds(new Set(startIds));
		}
	}, [messages]);

	// Update thinking state when loading
	useEffect(() => {
		setIsThinking(isLoading && mode === "generate");
	}, [isLoading, mode]);

	// Finalize all phases, agents, and project stages when streaming finishes
	const wasLoadingRef = useRef(false);
	useEffect(() => {
		if (wasLoadingRef.current && !isLoading) {
			// Streaming just ended - mark all generating phases/files as completed
			setPhaseTimeline((prev) => {
				if (prev.length === 0) return prev;
				return markAllPhasesComplete(prev);
			});
			// Mark all project stages as completed
			setProjectStages((stages) =>
				updateProjectStage(
					updateProjectStage(
						updateProjectStage(stages, "bootstrap", "completed"),
						"blueprint",
						"completed",
					),
					"code",
					"completed",
				),
			);
			// Mark all active agents as complete
			setActiveAgentIds((prev) => {
				if (prev.size > 0) {
					setCompletedAgentIds((completed) => new Set([...completed, ...prev]));
				}
				return new Set();
			});
			// Flush messages to DB immediately (no debounce)
			if (dbSaveTimer.current) clearTimeout(dbSaveTimer.current);
			saveToDb(messages);

			// Auto-rename app on first generation (if still "Untitled App")
			if (appName === "Untitled App" && onAppNameChange && messages.length > 0) {
				const firstUserMsg = messages.find((m) => m.role === "user");
				if (firstUserMsg) {
					// AI SDK v6: text is in parts[0].text, not content
				const text =
						"content" in firstUserMsg && typeof firstUserMsg.content === "string"
							? firstUserMsg.content
							: firstUserMsg.parts?.find((p: { type: string }) => p.type === "text")?.text ?? "";
					if (text) {
						const newName = generateAppName(text);
						fetch(`/api/app-builder/apps/${appId}/name`, {
							method: "PUT",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ name: newName }),
						})
							.then((r) => {
								if (r.ok) onAppNameChange(newName);
							})
							.catch(() => {});
					}
				}
			}
		}
		wasLoadingRef.current = isLoading;
	}, [isLoading, messages, saveToDb, appName, appId, onAppNameChange]);

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

	// Convert File to data URL for AI SDK FileUIPart
	const fileToDataUrl = useCallback((file: File): Promise<string> => {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}, []);

	// Submit handler — sends text + file attachments via AI SDK
	const onSubmit = useCallback(async () => {
		if (input.trim() || attachments.length > 0) {
			if (attachments.length > 0) {
				// Convert File objects to FileUIPart data URLs
				const fileUIParts = await Promise.all(
					attachments.map(async (a) => ({
						type: "file" as const,
						mediaType: a.mediaType,
						filename: a.name,
						url: await fileToDataUrl(a.file),
					})),
				);
				sendMessage({ text: input || " ", files: fileUIParts });
			} else {
				sendMessage({ text: input });
			}
			setInput("");
			setAttachments([]);
			// Mark first stage as active when user sends first message in generate mode
			if (mode === "generate" && messages.length === 0) {
				setProjectStages((stages) =>
					updateProjectStage(stages, "bootstrap", "active"),
				);
			}
		}
	}, [input, attachments, sendMessage, mode, messages.length, fileToDataUrl]);

	// Start new chat
	const handleNewChat = useCallback(() => {
		const newChatId = generateId();
		setChatId(newChatId);
		localStorage.setItem(getChatStorageKey(appId), newChatId);
		// Clear stored messages for new chat
		localStorage.removeItem(getMessagesStorageKey(appId));
		// Clear DB messages
		if (dbChatId.current) {
			fetch(`/api/app-builder/apps/${appId}/chat`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ messages: [] }),
			}).catch(() => {});
			dbChatId.current = null;
		}
		// Reset chat state
		setMessages([]);
		hasLoadedMessages.current = true; // Prevent loading old messages
		// Reset phase state for new chat
		setPhaseTimeline([]);
		setProjectStages(createDefaultProjectStages());
		// Reset agent events
		setAgentEvents([]);
		setActiveAgentIds(new Set());
		setCompletedAgentIds(new Set());
		processedEventCount.current = 0;
		// Reset continuation state so it re-analyzes on next empty chat
		setContinuationSuggestions([]);
		continuationAnalyzed.current = false;
	}, [appId, setMessages]);

	// Discuss mode toggle
	const handleDiscussToggle = useCallback(() => {
		setMode((prev) => (prev === "generate" ? "discuss" : "generate"));
	}, []);

	// Plus button opens file picker on the ChatInput
	const handlePlus = useCallback(() => {
		// Trigger the file input inside ChatInput via ref
		const fileInput = document.querySelector<HTMLInputElement>(
			'input[type="file"][data-attachment-input]',
		);
		if (fileInput) fileInput.click();
	}, []);

	// Voice transcript handler
	const handleVoiceTranscript = useCallback((text: string) => {
		setInput((prev) => (prev ? `${prev} ${text}` : text));
	}, []);

	// Handle suggestion chip click — fill input and focus textarea
	const handleSuggestionClick = useCallback(
		(text: string) => {
			setInput(text);
			// Focus the textarea
			const textarea = document.querySelector<HTMLTextAreaElement>(
				"textarea[placeholder]",
			);
			if (textarea) textarea.focus();
		},
		[setInput],
	);

	// Handle continuation suggestion click — auto-submit the prompt
	const handleContinuationClick = useCallback(
		(suggestion: ContinuationSuggestion) => {
			sendMessage({ text: suggestion.prompt });
			setContinuationSuggestions([]);
			if (mode === "generate") {
				setProjectStages((stages) =>
					updateProjectStage(stages, "bootstrap", "active"),
				);
			}
		},
		[sendMessage, mode],
	);

	return (
		<div className="flex flex-col h-full min-h-0">
			{/* Glass header with New Chat + dropdown */}
			<div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3 backdrop-blur-sm bg-white/[0.02]">
				<div className="flex items-center gap-2">
					<span className="text-sm text-white/40 font-medium">Chat</span>
				</div>
				<div className="flex items-center gap-1.5">
					<button
						type="button"
						onClick={handleNewChat}
						className="h-7 px-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/60 hover:text-white/90 flex items-center gap-1.5 text-xs font-medium transition-all duration-200"
					>
						<Plus className="h-3.5 w-3.5" />
						New Chat
					</button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="link" className="h-7 w-7 text-white/40 hover:text-white/70">
								<MoreHorizontal className="h-4 w-4" />
								<span className="sr-only">Chat options</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="backdrop-blur-xl bg-[#1a1a2e]/95 border-white/[0.1]">
							<DropdownMenuItem onClick={handleNewChat}>
								<RotateCcw className="h-4 w-4 mr-2" />
								Reset conversation
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{/* Messages area with scroll */}
			<ScrollArea ref={scrollRef} className="flex-1 min-h-0">
				<div className="pt-5 px-4 pb-4">
					{chatMessages.length === 0 ? (
						files.length > 0 && (continuationSuggestions.length > 0 || continuationLoading) ? (
							// Returning user — "Welcome back" with smart suggestions
							<div className="flex flex-col items-center justify-center min-h-[400px] py-16 text-center">
								<div className="relative p-8 rounded-3xl glass-card max-w-sm w-full">
									<div
										className="absolute inset-0 rounded-3xl opacity-30 pointer-events-none"
										style={{
											background:
												"conic-gradient(from 0deg, rgba(20,184,166,0.3), rgba(59,130,246,0.3), rgba(124,58,237,0.3), rgba(20,184,166,0.3))",
											padding: "1px",
											mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
											WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
											WebkitMaskComposite: "xor",
											maskComposite: "exclude",
										}}
									/>
									<Compass className="h-10 w-10 text-teal-400/60 mx-auto mb-3" />
									<h3 className="text-xl font-semibold mb-2 bg-gradient-to-r from-teal-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
										Welcome back
									</h3>
									<p className="text-sm text-white/40 mb-6">
										{appName !== "Untitled App" ? appName : "Your project"} has {files.length} files. What&apos;s next?
									</p>

									{continuationLoading ? (
										<div className="flex items-center justify-center gap-2 text-white/30">
											<Loader2 className="h-4 w-4 animate-spin" />
											<span className="text-xs">Analyzing project...</span>
										</div>
									) : (
										<div className="flex flex-col gap-2">
											{continuationSuggestions.map((suggestion) => (
												<motion.button
													key={suggestion.id}
													type="button"
													onClick={() => handleContinuationClick(suggestion)}
													className="flex items-center gap-3 w-full px-4 py-3 text-left text-sm rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/70 hover:bg-white/[0.08] hover:text-white/90 hover:border-white/[0.15] transition-all duration-200 group"
													whileHover={{ scale: 1.02 }}
													whileTap={{ scale: 0.98 }}
												>
													<span className="flex-shrink-0 w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center">
														{suggestion.icon === "sparkles" && <Sparkles className="h-3.5 w-3.5 text-violet-400" />}
														{suggestion.icon === "wrench" && <Wrench className="h-3.5 w-3.5 text-amber-400" />}
														{suggestion.icon === "compass" && <Compass className="h-3.5 w-3.5 text-teal-400" />}
													</span>
													<span className="flex-1 truncate">{suggestion.label}</span>
													<ArrowRight className="h-3.5 w-3.5 text-white/20 group-hover:text-white/50 transition-colors" />
												</motion.button>
											))}
										</div>
									)}

									<p className="text-xs text-white/20 mt-4">
										Or type your own request below
									</p>
								</div>
							</div>
						) : (
							// New project — original empty state with suggestion chips
							<div className="flex flex-col items-center justify-center min-h-[400px] py-16 text-center">
								<div className="relative p-8 rounded-3xl glass-card max-w-sm w-full">
									{/* Animated gradient border */}
									<div
										className="absolute inset-0 rounded-3xl opacity-30 pointer-events-none"
										style={{
											background:
												"conic-gradient(from 0deg, rgba(124,58,237,0.3), rgba(20,184,166,0.3), rgba(59,130,246,0.3), rgba(124,58,237,0.3))",
											padding: "1px",
											mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
											WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
											WebkitMaskComposite: "xor",
											maskComposite: "exclude",
										}}
									/>
									{mode === "generate" ? (
										<>
											<h3 className="text-xl font-semibold mb-2 bg-gradient-to-r from-violet-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
												What do you want to build?
											</h3>
											<p className="text-sm text-white/40 mb-6">
												Describe your app and I&apos;ll bring it to life
											</p>
										</>
									) : (
										<>
											<Lightbulb className="h-10 w-10 text-violet-400/60 mx-auto mb-3" />
											<h3 className="text-xl font-semibold mb-2 bg-gradient-to-r from-violet-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
												Let&apos;s plan together
											</h3>
											<p className="text-sm text-white/40 mb-6">
												Think through your app&apos;s design without generating code yet
											</p>
										</>
									)}

									{/* Suggestion chips */}
									{mode === "generate" && (
										<div className="flex flex-wrap justify-center gap-2">
											{SUGGESTION_CHIPS.map((chip) => (
												<motion.button
													key={chip}
													type="button"
													onClick={() => handleSuggestionClick(chip)}
													className="px-3 py-1.5 text-xs font-medium rounded-xl bg-white/[0.05] border border-white/[0.1] text-white/60 hover:bg-white/[0.08] hover:text-white/80 hover:border-white/[0.15] transition-all duration-200"
													whileHover={{ scale: 1.04 }}
													whileTap={{ scale: 0.97 }}
												>
													{chip}
												</motion.button>
											))}
										</div>
									)}
								</div>
							</div>
						)
					) : (
						// Messages list — no outer card wrapper (messages float directly)
						<div className="flex flex-col gap-4">
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

							{/* Agent Events */}
							{agentEvents.length > 0 && (
								<div className="space-y-2">
									{agentEvents.map((event, idx) => {
										if (event.type === "orchestration-start") {
											return (
												<OrchestrationHeader
													key={`orch-${idx}`}
													event={event}
												/>
											);
										}
										if (event.type === "agent-start") {
											return (
												<AgentActivityCard
													key={`agent-${event.agentId}-${idx}`}
													event={event}
													isActive={activeAgentIds.has(
														event.agentId || "",
													)}
													isComplete={completedAgentIds.has(
														event.agentId || "",
													)}
												/>
											);
										}
										if (event.type === "review-verdict") {
											return (
												<ReviewVerdict
													key={`verdict-${event.agentId}-${idx}`}
													event={event}
												/>
											);
										}
										return null;
									})}
								</div>
							)}

							{/* PhaseTimeline INLINE after messages */}
							{phaseTimeline.length > 0 && (
								<div className="mt-2">
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

			{/* Error display — glass */}
			{error && (
				<div className="px-4 py-2 text-sm text-red-400 bg-red-500/[0.06] border-t border-red-500/[0.1]">
					Error: {error.message}
				</div>
			)}

			{/* Discussion mode banner — glass */}
			{mode === "discuss" && (
				<div className="px-4 py-2 text-xs text-center text-violet-300/60 bg-violet-500/[0.04] border-t border-violet-500/[0.08]">
					Discussion mode — no file changes will be made
				</div>
			)}

			{/* Input area — glass */}
			<div className="border-t border-white/[0.06] p-4">
				<ChatInput
					value={input}
					onChange={setInput}
					onSubmit={onSubmit}
					isLoading={isLoading}
					isGenerating={isLoading}
					onStop={stop}
					attachments={attachments}
					onAttachmentsChange={setAttachments}
					modelCapabilities={getModelCapabilities(selectedModelId)}
				/>
			</div>

			{/* Bottom action bar */}
			<ChatBottomBar
				appId={appId}
				selectedModelId={selectedModelId}
				onModelChange={handleModelChange}
				onPlus={handlePlus}
				onDiscuss={handleDiscussToggle}
				onVoiceTranscript={handleVoiceTranscript}
				onNewChat={handleNewChat}
				mode={mode}
			/>
		</div>
	);
}
