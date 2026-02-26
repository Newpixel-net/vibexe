"use client";

/**
 * ChatColumn Component
 *
 * Main chat interface integrating AI SDK's useChat hook with VibeSDK components.
 * Manages chat state, phase timeline, and message display.
 *
 * Deploy to: /opt/vibexe/apps/studio.vibexe.ai/app/(main)/app-builder/components/chat-column.tsx
 */

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { motion } from "framer-motion";
import {
	AlertTriangle,
	ArrowRight,
	Bot,
	Brain,
	CheckCircle2,
	Clock,
	Compass,
	Eye,
	Globe,
	LayoutGrid,
	Lightbulb,
	Loader2,
	MessageSquare,
	MoreHorizontal,
	Plus,
	RefreshCw,
	Rocket,
	RotateCcw,
	Shield,
	Sparkles,
	Wrench,
	X,
	Zap,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
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
import { useVisualEdit } from "../lib/visual-edit-context";
import {
	createDefaultProjectStages,
	createPhaseFromToolEvent,
	markAllPhasesComplete,
	markAllPhasesError,
	type ToolStreamEvent,
	updatePhaseWithFile,
	updateProjectStage,
} from "../adapters/phase-adapter";
import { DEFAULT_MODEL_ID, getModelCapabilities } from "../lib/model-options";
import type {
	AgentEvent,
	Attachment,
	ChatMode,
	FileType,
	PhaseTimelineItem,
	ProjectStage,
} from "../types/vibesdk";
import { AGENT_INFO } from "../lib/slash-commands";
import {
	AgentActivationCard,
	AgentActivityCard,
	OrchestrationHeader,
} from "./agent-activity-card";
import { ChatBottomBar } from "./chat-bottom-bar";
import { ChatInput } from "./chat-input";
import { getSettingsKey, DEFAULT_SETTINGS, type ChatSettings } from "./chat-settings-popover";
import { AIMessage, UserMessage } from "./messages";
import { PhaseTimeline } from "./phase-timeline";
import { GitHubSyncBar } from "./github-sync-bar";
import { ReviewVerdict } from "./review-verdict";

interface ChatColumnProps {
	appId: string;
	appName: string;
	files: AppFile[];
	onFilesChange: () => void;
	onFileClick: (file: FileType) => void;
	onAppNameChange?: (name: string) => void;
	onGeneratingChange?: (isGenerating: boolean) => void;
	onStreamingDoc?: (doc: { path: string; content: string } | null) => void;
}

// Generate unique ID (fallback if nanoid not available)
const generateId = () => crypto.randomUUID();

// LocalStorage keys for chat persistence
const getChatStorageKey = (appId: string) => `vibexe-builder-chat-${appId}`;
const getMessagesStorageKey = (appId: string) =>
	`vibexe-builder-messages-${appId}`;
const getModelStorageKey = (appId: string) =>
	`vibexe-builder-model-${appId}`;

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
	icon: string;
	prompt: string;
}

/** History entry from /api/app-builder/apps/[appId]/history */
interface HistoryEntry {
	id: number;
	summary: string;
	details: {
		filesCreated?: string[];
		filesModified?: string[];
		filesDeleted?: string[];
		urls?: string[];
		userMessages?: string[];
		messageCount?: number;
		userMessageCount?: number;
		assistantMessageCount?: number;
	};
	sessionType: string;
	createdAt: string;
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
	buildInterrupted?: boolean;
	codeFileCount?: number;
	suggestions?: { id: number; label: string; prompt: string; icon: string; category: string }[];
}

/** Build continuation suggestions from server data + client-side TODO fallback */
function buildContinuationSuggestions(
	analysis: AnalyzeResponse,
): ContinuationSuggestion[] {
	const suggestions: ContinuationSuggestion[] = [];

	// TODOs — always generated client-side as highest priority
	if (analysis.todoCount && analysis.todoCount > 0) {
		suggestions.push({
			id: "fix-todos",
			label: `Fix ${analysis.todoCount} TODO${analysis.todoCount > 1 ? "s" : ""} in code`,
			icon: "wrench",
			prompt: `Read the existing files and fix all TODO, FIXME, and HACK comments. Replace placeholder implementations with real working code.`,
		});
	}

	// Server-matched suggestion templates
	if (analysis.suggestions && analysis.suggestions.length > 0) {
		for (const s of analysis.suggestions) {
			suggestions.push({
				id: `tmpl-${s.id}`,
				label: s.label,
				icon: s.icon || "sparkles",
				prompt: s.prompt,
			});
		}
	}

	// Fallback: if no server suggestions, add polish
	if (!analysis.suggestions || analysis.suggestions.length === 0) {
		suggestions.push({
			id: "polish",
			label: "Improve & polish the app",
			icon: "compass",
			prompt: `Read all existing files and improve the app: better error handling, loading states, animations, accessibility, and visual polish. Don't change core functionality — just make everything more polished and production-ready.`,
		});
	}

	return suggestions.slice(0, 5);
}

/** Render an icon by name */
function SuggestionIcon({ icon }: { icon: string }) {
	switch (icon) {
		case "wrench": return <Wrench className="h-3.5 w-3.5 text-amber-400" />;
		case "compass": return <Compass className="h-3.5 w-3.5 text-teal-400" />;
		case "rocket": return <Rocket className="h-3.5 w-3.5 text-emerald-400" />;
		case "globe": return <Globe className="h-3.5 w-3.5 text-blue-400" />;
		case "layout": return <LayoutGrid className="h-3.5 w-3.5 text-indigo-400" />;
		case "shield": return <Shield className="h-3.5 w-3.5 text-orange-400" />;
		case "zap": return <Zap className="h-3.5 w-3.5 text-yellow-400" />;
		default: return <Sparkles className="h-3.5 w-3.5 text-violet-400" />;
	}
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

/** Parse AI provider errors into actionable user-facing messages */
function parseGenerationError(
	message: string,
	modelId: string,
): { userMessage: string; provider: string; code: string; canRetry: boolean } {
	const lc = message.toLowerCase();
	// Detect provider from model ID
	const providerMap: Record<string, string> = {
		"kimi-k2-5-fireworks": "Fireworks AI",
		"kimi-k2-5": "NVIDIA NIM",
		"claude-sonnet-4-5": "Anthropic",
		"claude-opus-4-6": "Anthropic",
		"claude-haiku-4-5": "Anthropic",
		"gpt-4o": "OpenAI",
		"grok-4-1-fast": "xAI",
	};
	const provider = providerMap[modelId] || "AI provider";

	// Parse HTTP status codes from error messages
	if (lc.includes("402") || lc.includes("payment") || lc.includes("insufficient") || lc.includes("credit") || lc.includes("quota")) {
		return { userMessage: `${provider} credits exhausted. Switch to a different model to continue.`, provider, code: "402", canRetry: false };
	}
	if (lc.includes("429") || lc.includes("rate limit") || lc.includes("too many")) {
		return { userMessage: `${provider} rate limited. Wait a moment and try again.`, provider, code: "429", canRetry: true };
	}
	if (lc.includes("401") || lc.includes("unauthorized") || lc.includes("invalid.*key") || lc.includes("api key")) {
		return { userMessage: `Invalid API key for ${provider}. Check your provider settings.`, provider, code: "401", canRetry: false };
	}
	if (lc.includes("503") || lc.includes("service unavailable") || lc.includes("overloaded")) {
		return { userMessage: `${provider} is temporarily unavailable. Try again or switch models.`, provider, code: "503", canRetry: true };
	}
	if (lc.includes("timeout") || lc.includes("timed out") || lc.includes("econnreset") || lc.includes("econnrefused")) {
		return { userMessage: `Connection to ${provider} lost. Check your internet and try again.`, provider, code: "timeout", canRetry: true };
	}
	if (lc.includes("failed to fetch") || lc.includes("network") || lc.includes("fetch")) {
		return { userMessage: `Could not reach ${provider}. Check your connection or try a different model.`, provider, code: "network", canRetry: true };
	}
	// Generic fallback
	return { userMessage: `Generation stopped: ${provider} returned an error.`, provider, code: "unknown", canRetry: true };
}

export function ChatColumn({
	appId,
	appName,
	files,
	onFilesChange,
	onFileClick,
	onAppNameChange,
	onGeneratingChange,
	onStreamingDoc,
}: ChatColumnProps) {
	// Track if component has mounted (for hydration safety)
	const [hasMounted, setHasMounted] = useState(false);
	const searchParams = useSearchParams();

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

	// Error context for actionable error card
	const [errorContext, setErrorContext] = useState<{
		message: string;
		provider?: string;
		code?: string;
		filesCompleted: number;
		filesTotal: number;
		canRetry: boolean;
	} | null>(null);
	// Track last user message for retry
	const lastUserMessageRef = useRef<string>("");

	// Agent events from orchestration data stream
	const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
	const [activeAgentIds, setActiveAgentIds] = useState<Set<string>>(new Set());
	const [completedAgentIds, setCompletedAgentIds] = useState<Set<string>>(
		new Set(),
	);

	// Pinned agent — activated via slash command, persists until switched
	const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
	// Activation card shown in timeline when agent is activated via slash command
	const [activationCard, setActivationCard] = useState<{
		agentId: string;
		timestamp: number;
	} | null>(null);

	// Continuation agent state for returning users
	const [continuationSuggestions, setContinuationSuggestions] = useState<ContinuationSuggestion[]>([]);
	const [continuationLoading, setContinuationLoading] = useState(false);
	const continuationAnalyzed = useRef(false);
	const [buildInterrupted, setBuildInterrupted] = useState(false);

	// Returning user detection: true when messages were loaded from DB/localStorage
	const [isReturningUser, setIsReturningUser] = useState(false);
	const [welcomeDismissed, setWelcomeDismissed] = useState(false);

	// History modal state
	const [showHistory, setShowHistory] = useState(false);
	const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
	const [historyLoading, setHistoryLoading] = useState(false);

	// Source URL extracted from history (the domain the website was copied from)
	const [sourceUrl, setSourceUrl] = useState<string | null>(null);

	// Deep Thinking: auto-review & auto-fix after build
	const [deepThinking, setDeepThinking] = useState(false);
	const [deepThinkingStatus, setDeepThinkingStatus] = useState<
		null | "reviewing" | "fixing" | "approved" | "complete"
	>(null);
	const autoReviewTriggeredRef = useRef(false);
	const autoFixTriggeredRef = useRef(false);
	const deepThinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

	// Load model selection: URL param (from dashboard) > localStorage > default
	useEffect(() => {
		if (!hasMounted) return;
		// Dashboard passes ?model= when user picks a model before generating
		const modelParam = searchParams.get("model");
		if (modelParam) {
			setSelectedModelId(modelParam);
			localStorage.setItem(getModelStorageKey(appId), modelParam);
			// Clean up URL param
			const url = new URL(window.location.href);
			url.searchParams.delete("model");
			window.history.replaceState({}, "", url.pathname + url.search);
			return;
		}
		const stored = localStorage.getItem(getModelStorageKey(appId));
		if (stored) {
			setSelectedModelId(stored);
		}
	}, [appId, hasMounted, searchParams]);

	// Persist model selection to localStorage
	const handleModelChange = useCallback(
		(modelId: string) => {
			setSelectedModelId(modelId);
			localStorage.setItem(getModelStorageKey(appId), modelId);
		},
		[appId],
	);

	// Load deepThinking from per-app settings (same key as ChatSettingsPopover)
	useEffect(() => {
		if (!hasMounted) return;
		try {
			const stored = localStorage.getItem(getSettingsKey(appId));
			if (stored) {
				const settings: ChatSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
				setDeepThinking(settings.deepThinking);
			}
		} catch {
			// ignore
		}
	}, [appId, hasMounted]);

	// Handle deep thinking toggle
	const handleDeepThinkingChange = useCallback(
		(value: boolean) => {
			setDeepThinking(value);
			// Persist to same settings key used by ChatSettingsPopover
			try {
				const stored = localStorage.getItem(getSettingsKey(appId));
				const settings: ChatSettings = stored
					? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
					: { ...DEFAULT_SETTINGS };
				settings.deepThinking = value;
				localStorage.setItem(getSettingsKey(appId), JSON.stringify(settings));
			} catch {
				// ignore
			}
			// Cancel pending timers when disabling
			if (!value && deepThinkingTimerRef.current) {
				clearTimeout(deepThinkingTimerRef.current);
				deepThinkingTimerRef.current = null;
				setDeepThinkingStatus(null);
			}
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
					...(activeAgentId ? { activeAgentId } : {}),
				},
			}),
		[appId, chatId, mode, selectedModelId, activeAgentId],
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
		onError: (err) => {
			console.error("Chat error:", err);
			setIsThinking(false);

			// Parse provider error for actionable context
			const msg = err?.message || "Unknown error";
			const parsed = parseGenerationError(msg, selectedModelId);

			// Mark all generating phases as error (not completed)
			setPhaseTimeline((prev) => {
				if (prev.length === 0) return prev;
				const completed = prev.reduce((n, p) => n + p.files.filter(f => f.status === "completed").length, 0);
				const total = prev.reduce((n, p) => n + p.files.length, 0);
				setErrorContext({
					message: parsed.userMessage,
					provider: parsed.provider,
					code: parsed.code,
					filesCompleted: completed,
					filesTotal: total,
					canRetry: parsed.canRetry,
				});
				return markAllPhasesError(prev);
			});

			// Mark project stages as error
			setProjectStages((stages) =>
				updateProjectStage(stages, "code", "completed"),
			);
		},
	});

	const isLoading = status === "submitted" || status === "streaming";

	// Auto-submit from ?prompt= query param (dashboard → builder flow)
	const autoSubmitFired = useRef(false);
	useEffect(() => {
		if (autoSubmitFired.current) return;
		const promptParam = searchParams.get("prompt");
		if (!promptParam || !hasMounted) return;

		// Wait for message loading to settle, then auto-send
		const timer = setTimeout(() => {
			if (autoSubmitFired.current) return;
			autoSubmitFired.current = true;
			const typeParam = searchParams.get("type");
			const categoryParam = searchParams.get("category");
			const templateParam = searchParams.get("template");
			const TEMPLATE_LABELS: Record<string, string> = {
				nextjs: "Next.js + TypeScript",
				"react-vite": "React + Vite",
				"node-express": "Node.js + Express",
				static: "Static HTML/CSS/JS",
			};
			const parts: string[] = [];
			if (typeParam && typeParam !== "app") {
				parts.push(`Project type: ${typeParam}${categoryParam ? `, Category: ${categoryParam}` : ""}`);
			}
			if (templateParam && templateParam !== "default" && TEMPLATE_LABELS[templateParam]) {
				parts.push(`Framework: ${TEMPLATE_LABELS[templateParam]}`);
			}
			const contextPrefix = parts.length > 0 ? `[${parts.join(", ")}]\n\n` : "";
			sendMessage({ text: contextPrefix + promptParam });
			// Clean up URL (remove query params)
			const url = new URL(window.location.href);
			url.searchParams.delete("prompt");
			url.searchParams.delete("type");
			url.searchParams.delete("category");
			url.searchParams.delete("model");
			url.searchParams.delete("template");
			window.history.replaceState({}, "", url.pathname);
		}, 800);

		return () => clearTimeout(timer);
	}, [searchParams, hasMounted, sendMessage]);

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
						setIsReturningUser(true);
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
							setIsReturningUser(true);
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
								setIsReturningUser(true);
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
			// Strip base64 image data before localStorage save to avoid QuotaExceededError
			// (screenshots as data URLs can be 1-5MB, exceeding ~5MB localStorage quota)
			try {
				const lightweight = messages.map((m) => {
					if (!m.experimental_attachments?.length) return m;
					return {
						...m,
						experimental_attachments: m.experimental_attachments.map(
							(a: Record<string, unknown>) =>
								typeof a.url === "string" &&
								(a.url as string).startsWith("data:")
									? { ...a, url: `stripped:${a.name || "file"}` }
									: a,
						),
					};
				});
				localStorage.setItem(
					getMessagesStorageKey(appId),
					JSON.stringify(lightweight),
				);
			} catch {
				// QuotaExceededError — localStorage full, skip caching (DB save is primary)
			}
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
			if (isLoading) {
				// Live streaming — mark agents as active (show spinner)
				setActiveAgentIds(new Set(startIds));
			} else {
				// Restored from DB — mark agents as completed (show checkmark, no spinner)
				setActiveAgentIds(new Set());
				setCompletedAgentIds(new Set(startIds));
			}
		}
	}, [messages, isLoading]);

	// Update thinking state when loading
	useEffect(() => {
		setIsThinking(isLoading && mode === "generate");
		// Clear activation card once streaming starts — real agent card takes over
		if (isLoading) {
			setActivationCard(null);
		}
	}, [isLoading, mode]);

	// Finalize all phases, agents, and project stages when streaming finishes
	const wasLoadingRef = useRef(false);
	useEffect(() => {
		if (wasLoadingRef.current && !isLoading) {
			// Streaming just ended — mark generating phases as complete.
			// Skip if onError already marked them as error (errorContext is set).
			setPhaseTimeline((prev) => {
				if (prev.length === 0) return prev;
				// If phases are already marked error by onError handler, don't override
				const hasErrorPhases = prev.some((p) => p.status === "error");
				if (hasErrorPhases) return prev;
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

	// --- Pipeline action detection ---
	// Detect if last assistant message is a review with issues (Review Feedback Loop)
	const isReviewWithIssues = useMemo(() => {
		if (isLoading || chatMessages.length === 0) return false;
		const lastAssistant = [...chatMessages].reverse().find((m) => m.role === "assistant");
		if (!lastAssistant?.content) return false;
		const text = lastAssistant.content;
		return (
			text.includes("## Combined Verdict") &&
			(text.includes("WARNING") || text.includes("BLOCK") || text.includes("FAIL")) &&
			text.includes("Fix Issues")
		);
	}, [chatMessages, isLoading]);

	// Check if project has actual code files (not just Blueprint.md)
	const hasCodeFiles = useMemo(() => {
		return files.some((f) => {
			const p = f.path || "";
			return p.endsWith(".tsx") || p.endsWith(".ts") || p.endsWith(".jsx") || p.endsWith(".js");
		});
	}, [files]);

	// Detect if we just completed a code generation (for showing Review button)
	const showReviewButton = useMemo(() => {
		if (isLoading || isReviewWithIssues) return false;
		// Hide manual review when deep thinking is handling it
		if (deepThinking && (autoReviewTriggeredRef.current || deepThinkingStatus)) return false;
		// Show review button when generation completed and we have code files
		return isGenerationComplete && hasCodeFiles;
	}, [isLoading, isReviewWithIssues, isGenerationComplete, hasCodeFiles, deepThinking, deepThinkingStatus]);

	// Detect if last assistant message is a clean review (APPROVE/PASS, no issues)
	const isReviewApproved = useMemo(() => {
		if (isLoading || chatMessages.length === 0) return false;
		const lastAssistant = [...chatMessages].reverse().find((m) => m.role === "assistant");
		if (!lastAssistant?.content) return false;
		const text = lastAssistant.content;
		return (
			text.includes("APPROVE") &&
			(text.includes("PASS") || text.includes("pass")) &&
			!text.includes("WARNING") &&
			!text.includes("BLOCK") &&
			!text.includes("FAIL")
		);
	}, [chatMessages, isLoading]);

	// --- Deep Thinking: Auto-review trigger ---
	// After build completes, auto-send [REVIEW CODE] if deep thinking is ON
	useEffect(() => {
		if (
			!deepThinking ||
			isLoading ||
			!isGenerationComplete ||
			!hasCodeFiles ||
			mode !== "generate" ||
			autoReviewTriggeredRef.current ||
			phaseTimeline.length === 0
		) return;

		// Don't trigger if the last user message was already a review/fix command
		const lastUser = [...chatMessages].reverse().find((m) => m.role === "user");
		if (lastUser?.content) {
			const userText = lastUser.content;
			if (userText.includes("[REVIEW CODE]") || userText.includes("[AUTO-FIX]")) return;
		}

		// Don't trigger if review already completed
		if (isReviewApproved || isReviewWithIssues) return;

		autoReviewTriggeredRef.current = true;
		deepThinkingTimerRef.current = setTimeout(() => {
			setDeepThinkingStatus("reviewing");
			sendMessage({ text: "[REVIEW CODE] Review all generated files for code quality, correctness, and security issues." });
		}, 1500);

		return () => {
			if (deepThinkingTimerRef.current) {
				clearTimeout(deepThinkingTimerRef.current);
			}
		};
	}, [deepThinking, isLoading, isGenerationComplete, hasCodeFiles, mode, phaseTimeline.length, chatMessages, isReviewApproved, isReviewWithIssues, sendMessage]);

	// --- Deep Thinking: Auto-fix trigger ---
	// After review finds issues, auto-send [AUTO-FIX]
	useEffect(() => {
		if (
			!deepThinking ||
			isLoading ||
			!isReviewWithIssues ||
			autoFixTriggeredRef.current
		) return;

		autoFixTriggeredRef.current = true;
		deepThinkingTimerRef.current = setTimeout(() => {
			setDeepThinkingStatus("fixing");
			sendMessage({ text: "[AUTO-FIX] Fix all the issues identified in the code review above. Read each affected file, apply the recommended fixes, and ensure the app builds without errors." });
		}, 1500);

		return () => {
			if (deepThinkingTimerRef.current) {
				clearTimeout(deepThinkingTimerRef.current);
			}
		};
	}, [deepThinking, isLoading, isReviewWithIssues, sendMessage]);

	// --- Deep Thinking: Status completion detection ---
	useEffect(() => {
		if (!deepThinking || !deepThinkingStatus) return;

		if (deepThinkingStatus === "reviewing" && !isLoading && isReviewApproved) {
			setDeepThinkingStatus("approved");
		} else if (deepThinkingStatus === "fixing" && !isLoading) {
			setDeepThinkingStatus("complete");
		}
	}, [deepThinking, deepThinkingStatus, isLoading, isReviewApproved]);

	// Continuation analysis for returning users
	// Triggers when: mounted, has files, and hasn't analyzed yet.
	// Works both for empty chat (New Chat on existing project) and returning users with messages.
	useEffect(() => {
		if (
			hasMounted &&
			files.length > 0 &&
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
						if (data.buildInterrupted) setBuildInterrupted(true);
					}
				})
				.catch(() => {})
				.finally(() => setContinuationLoading(false));

			// Also fetch history to extract source URL (the domain the site was copied from)
			if (!sourceUrl) {
				fetch(`/api/app-builder/apps/${appId}/history`)
					.then((res) => (res.ok ? res.json() : null))
					.then((data: { history?: HistoryEntry[] } | null) => {
						if (data?.history && data.history.length > 0) {
							setHistoryEntries(data.history);
							// Find the first URL from any history entry (oldest first = last in array)
							for (let i = data.history.length - 1; i >= 0; i--) {
								const urls = data.history[i].details?.urls;
								if (urls && urls.length > 0) {
									try {
										const hostname = new URL(urls[0]).hostname;
										setSourceUrl(hostname);
									} catch {
										setSourceUrl(urls[0].replace(/^https?:\/\//, "").split("/")[0]);
									}
									break;
								}
							}
						}
					})
					.catch(() => {});
			}
		}
	}, [hasMounted, files.length, appId, continuationLoading, sourceUrl]);

	// Visual Edit: auto-append pending messages from Visual Edit context
	const visualEdit = useVisualEdit();
	useEffect(() => {
		if (visualEdit.pendingVisualEditMessage && !isLoading) {
			sendMessage({ text: visualEdit.pendingVisualEditMessage });
			visualEdit.clearPendingMessage();
		}
	}, [visualEdit.pendingVisualEditMessage, isLoading, sendMessage, visualEdit.clearPendingMessage]);

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

	// Stream doc updates: detect running create_file/update_file for .md files
	useEffect(() => {
		if (!onStreamingDoc) return;
		if (!isLoading) {
			onStreamingDoc(null);
			return;
		}
		if (chatMessages.length === 0) return;

		const latestMessage = chatMessages[chatMessages.length - 1];
		if (latestMessage?.role !== "assistant" || !latestMessage.toolEvents) return;

		const fileToolNames = new Set(["create_file", "update_file", "createFile", "updateFile"]);

		// Find the last running file tool that targets a .md file
		for (let i = latestMessage.toolEvents.length - 1; i >= 0; i--) {
			const event = latestMessage.toolEvents[i];
			if (
				event.status === "running" &&
				fileToolNames.has(event.toolName) &&
				typeof event.args?.path === "string" &&
				event.args.path.endsWith(".md") &&
				typeof event.args?.content === "string"
			) {
				onStreamingDoc({ path: event.args.path, content: event.args.content });
				return;
			}
		}
		onStreamingDoc(null);
	}, [chatMessages, isLoading, onStreamingDoc]);

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
	}, [chatMessages.length, isLoading]);

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
			// Track last user message for retry-on-error
			lastUserMessageRef.current = input;
			// Clear any previous error context
			setErrorContext(null);
			// Reset deep thinking state when user manually sends a message
			autoReviewTriggeredRef.current = false;
			autoFixTriggeredRef.current = false;
			setDeepThinkingStatus(null);
			if (deepThinkingTimerRef.current) {
				clearTimeout(deepThinkingTimerRef.current);
				deepThinkingTimerRef.current = null;
			}

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
			// Dismiss Welcome back banner when prompt is sent
			if (isReturningUser && !welcomeDismissed) {
				setWelcomeDismissed(true);
			}
			// Mark first stage as active when user sends first message in generate mode
			if (mode === "generate" && messages.length === 0) {
				setProjectStages((stages) =>
					updateProjectStage(stages, "bootstrap", "active"),
				);
			}
		}
	}, [input, attachments, sendMessage, mode, messages.length, fileToDataUrl, isReturningUser, welcomeDismissed]);

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
		// Reset pinned agent
		setActiveAgentId(null);
		setActivationCard(null);
		// Reset continuation state so it re-analyzes on next empty chat
		setContinuationSuggestions([]);
		continuationAnalyzed.current = false;
		// Reset returning user state
		setIsReturningUser(false);
		setWelcomeDismissed(false);
		// Reset deep thinking state
		autoReviewTriggeredRef.current = false;
		autoFixTriggeredRef.current = false;
		setDeepThinkingStatus(null);
		if (deepThinkingTimerRef.current) {
			clearTimeout(deepThinkingTimerRef.current);
			deepThinkingTimerRef.current = null;
		}
	}, [appId, setMessages]);

	// Agent activation via slash command
	const handleAgentActivate = useCallback((agentId: string) => {
		setActiveAgentId(agentId);
		setActivationCard({ agentId, timestamp: Date.now() });
	}, []);

	// Deactivate pinned agent (return to auto-orchestration)
	const handleAgentDeactivate = useCallback(() => {
		setActiveAgentId(null);
		setActivationCard(null);
	}, []);

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

	// Handle continuation suggestion click — populate input for user editing
	// Banner stays visible until the prompt is actually sent
	const handleContinuationClick = useCallback(
		(suggestion: ContinuationSuggestion) => {
			setInput(suggestion.prompt);
			// Focus the textarea
			const textarea = document.querySelector<HTMLTextAreaElement>(
				"textarea[placeholder]",
			);
			if (textarea) textarea.focus();
		},
		[],
	);

	// --- Pipeline action handlers ---
	const handleReviewCode = useCallback(() => {
		sendMessage({ text: "[REVIEW CODE] Review all generated files for code quality, correctness, and security issues." });
	}, [sendMessage]);

	const handleFixIssues = useCallback(() => {
		sendMessage({ text: "[AUTO-FIX] Fix all the issues identified in the code review above. Read each affected file, apply the recommended fixes, and ensure the app builds without errors." });
	}, [sendMessage]);

	// Deep Thinking status indicator component
	const DeepThinkingIndicator = useMemo(() => {
		if (!deepThinking || !deepThinkingStatus) return null;

		const configs = {
			reviewing: { icon: <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />, text: "Deep Thinking: Reviewing code...", color: "cyan" },
			fixing: { icon: <Loader2 className="h-4 w-4 animate-spin text-amber-400" />, text: "Deep Thinking: Fixing issues...", color: "amber" },
			approved: { icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />, text: "Deep Thinking: All checks passed!", color: "emerald" },
			complete: { icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />, text: "Deep Thinking: Issues fixed", color: "emerald" },
		};
		const cfg = configs[deepThinkingStatus];
		const borderColor = cfg.color === "cyan" ? "border-cyan-500/[0.2]" : cfg.color === "amber" ? "border-amber-500/[0.2]" : "border-emerald-500/[0.2]";
		const bgColor = cfg.color === "cyan" ? "bg-cyan-500/[0.06]" : cfg.color === "amber" ? "bg-amber-500/[0.06]" : "bg-emerald-500/[0.06]";

		return (
			<div className={`mt-4 mx-1 flex items-center gap-3 p-3 rounded-2xl ${bgColor} backdrop-blur-sm border ${borderColor}`}>
				<div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center">
					{cfg.icon}
				</div>
				<div className="flex items-center gap-2">
					<Brain className="h-3.5 w-3.5 text-cyan-400/60" />
					<span className="text-sm font-medium text-white/80">{cfg.text}</span>
				</div>
			</div>
		);
	}, [deepThinking, deepThinkingStatus]);

	// Load and show history modal
	const handleShowHistory = useCallback(async () => {
		setShowHistory(true);
		setHistoryLoading(true);
		try {
			const res = await fetch(`/api/app-builder/apps/${appId}/history`);
			if (res.ok) {
				const data = await res.json();
				setHistoryEntries(data.history || []);
			}
		} catch (e) {
			console.error("[ChatColumn] History load error:", e);
		} finally {
			setHistoryLoading(false);
		}
	}, [appId]);

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
						onClick={handleShowHistory}
						className="h-7 px-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/60 hover:text-white/90 flex items-center gap-1.5 text-xs font-medium transition-all duration-200"
						title="Development History"
					>
						<Clock className="h-3.5 w-3.5" />
					</button>
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
										{appName !== "Untitled App" ? appName : "Your project"}
										{sourceUrl ? (
											<>
												{" "}
												<a
													href={`https://${sourceUrl}`}
													target="_blank"
													rel="noopener noreferrer"
													className="text-violet-400/70 hover:text-violet-300 transition-colors"
												>
													({sourceUrl})
												</a>
											</>
										) : null}
										{" "}has {files.length} files. What&apos;s next?
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
														<SuggestionIcon icon={suggestion.icon} />
													</span>
													<span className="flex-1 truncate">{suggestion.label}</span>
													<ArrowRight className="h-3.5 w-3.5 text-white/20 group-hover:text-white/50 transition-colors" />
												</motion.button>
											))}
										</div>
									)}

									<div className="flex items-center justify-center gap-4 mt-4">
										<p className="text-xs text-white/20">
											Or type your own request below
										</p>
										<button
											type="button"
											onClick={handleShowHistory}
											className="text-xs text-white/20 hover:text-white/40 flex items-center gap-1 transition-colors"
										>
											<Clock className="h-3 w-3" />
											History
										</button>
									</div>
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

							{/* Welcome back banner for returning users — at bottom of messages */}
							{isReturningUser && !welcomeDismissed && files.length > 0 && (continuationSuggestions.length > 0 || continuationLoading) && (
								<motion.div
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: 10 }}
									className="relative p-5 rounded-2xl bg-gradient-to-br from-teal-500/[0.06] via-cyan-500/[0.04] to-violet-500/[0.06] border border-teal-500/[0.15] backdrop-blur-sm"
								>
									<button
										type="button"
										onClick={() => setWelcomeDismissed(true)}
										className="absolute top-3 right-3 h-6 w-6 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white/30 hover:text-white/60 transition-all"
									>
										<X className="h-3.5 w-3.5" />
									</button>
									<div className="flex items-start gap-3 mb-3">
										<div className={`flex-shrink-0 w-9 h-9 rounded-xl ${buildInterrupted ? "bg-amber-500/[0.12] border-amber-500/[0.15]" : "bg-teal-500/[0.12] border-teal-500/[0.15]"} border flex items-center justify-center`}>
											{buildInterrupted ? (
												<AlertTriangle className="h-5 w-5 text-amber-400/70" />
											) : (
												<Compass className="h-5 w-5 text-teal-400/70" />
											)}
										</div>
										<div className="flex-1 min-w-0">
											<h4 className="text-sm font-semibold bg-gradient-to-r from-teal-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
												{buildInterrupted ? "Build interrupted" : "Welcome back"}
											</h4>
											<p className="text-xs text-white/40 mt-0.5">
												{buildInterrupted ? (
													<>
														<span className="text-amber-400/70">Generation was interrupted.</span>
														{" "}Your saved files are safe. Resume to complete the build:
													</>
												) : (
													<>
														{appName !== "Untitled App" ? appName : "Your project"}
														{sourceUrl ? (
															<>
																{" "}
																<a href={`https://${sourceUrl}`} target="_blank" rel="noopener noreferrer" className="text-violet-400/70 hover:text-violet-300 transition-colors">
																	({sourceUrl})
																</a>
															</>
														) : null}
														{" "}&mdash; {files.length} files. Pick up where you left off:
													</>
												)}
											</p>
										</div>
									</div>
									{continuationLoading ? (
										<div className="flex items-center gap-2 text-white/30 pl-12">
											<Loader2 className="h-3.5 w-3.5 animate-spin" />
											<span className="text-xs">Analyzing project...</span>
										</div>
									) : (
										<div className="flex flex-wrap gap-2 pl-12">
											{continuationSuggestions.map((suggestion) => (
												<button
													key={suggestion.id}
													type="button"
													onClick={() => handleContinuationClick(suggestion)}
													className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/60 hover:bg-white/[0.08] hover:text-white/90 hover:border-white/[0.15] transition-all duration-200"
												>
													<SuggestionIcon icon={suggestion.icon} />
													<span className="truncate max-w-[200px]">{suggestion.label}</span>
												</button>
											))}
										</div>
									)}
								</motion.div>
							)}

							{/* Agent activation card from slash command — always newest item */}
							{activationCard && AGENT_INFO[activationCard.agentId] && (
								<AgentActivationCard
									key={`activation-${activationCard.timestamp}`}
									agentId={activationCard.agentId}
									agentName={AGENT_INFO[activationCard.agentId].name}
									modelTier={AGENT_INFO[activationCard.agentId].modelTier}
									description={AGENT_INFO[activationCard.agentId].description}
									onDeactivate={handleAgentDeactivate}
								/>
							)}
						</div>
					)}

					{/* Deep Thinking status indicator */}
					{DeepThinkingIndicator}

					{/* Review button after generation completes (hidden when deep thinking handles it) */}
					{showReviewButton && (
						<div className="mt-4 mx-1 space-y-2">
							<DeployBanner />
							<motion.button
								type="button"
								onClick={handleReviewCode}
								className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-cyan-500/[0.2] hover:bg-white/[0.06] transition-all duration-200 group"
								whileHover={{ scale: 1.01 }}
								whileTap={{ scale: 0.99 }}
							>
								<div className="flex-shrink-0 w-10 h-10 rounded-full bg-cyan-500/[0.15] border border-cyan-500/[0.2] flex items-center justify-center">
									<Eye className="h-5 w-5 text-cyan-400" />
								</div>
								<div className="flex-1 text-left">
									<p className="text-sm font-medium text-white/90">Review Code</p>
									<p className="text-xs text-white/40">Run code quality and security review</p>
								</div>
								<div className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/80 to-teal-500/80 hover:from-cyan-500 hover:to-teal-500 text-white text-xs font-medium transition-all duration-200">
									Go
								</div>
							</motion.button>
						</div>
					)}

					{/* Fix Issues button after review finds problems (hidden when deep thinking auto-fixes) */}
					{isReviewWithIssues && !isLoading && !(deepThinking && autoFixTriggeredRef.current) && (
						<div className="mt-4 mx-1">
							<motion.button
								type="button"
								onClick={handleFixIssues}
								className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-amber-500/[0.2] hover:bg-white/[0.06] transition-all duration-200 group"
								whileHover={{ scale: 1.01 }}
								whileTap={{ scale: 0.99 }}
							>
								<div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/[0.15] border border-amber-500/[0.2] flex items-center justify-center">
									<Wrench className="h-5 w-5 text-amber-400" />
								</div>
								<div className="flex-1 text-left">
									<p className="text-sm font-medium text-white/90">Fix Issues</p>
									<p className="text-xs text-white/40">Auto-fix all issues from the review above</p>
								</div>
								<div className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/80 to-orange-500/80 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-medium transition-all duration-200">
									Go
								</div>
							</motion.button>
						</div>
					)}

					{/* Deploy banner — shown after deep thinking completes (approved/complete) */}
					{deepThinking && (deepThinkingStatus === "approved" || deepThinkingStatus === "complete") && hasCodeFiles && (
						<div className="mt-4">
							<DeployBanner />
						</div>
					)}

					{/* Deploy banner (standalone when no review button shown and no deep thinking) */}
					{isGenerationComplete && mode === "generate" && !showReviewButton && hasCodeFiles && !deepThinking && (
						<div className="mt-4">
							<DeployBanner />
						</div>
					)}
				</div>
			</ScrollArea>

			{/* Error display — actionable card */}
			{error && errorContext && (
				<div className="px-4 py-3 bg-red-500/[0.06] border-t border-red-500/[0.12]">
					<div className="flex items-start gap-3">
						<div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-red-500/[0.12] flex items-center justify-center">
							<AlertTriangle className="h-4 w-4 text-red-400" />
						</div>
						<div className="flex-1 min-w-0">
							<p className="text-sm font-medium text-red-400">{errorContext.message}</p>
							{errorContext.filesTotal > 0 && (
								<p className="text-xs text-white/40 mt-0.5">
									{errorContext.filesCompleted} of {errorContext.filesTotal} files saved before error
								</p>
							)}
						</div>
						<button
							type="button"
							onClick={() => { setErrorContext(null); }}
							className="flex-shrink-0 p-1 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
						>
							<X className="h-3.5 w-3.5" />
						</button>
					</div>
					<div className="flex items-center gap-2 mt-2.5 ml-11">
						{errorContext.canRetry && (
							<button
								type="button"
								onClick={() => {
									setErrorContext(null);
									if (lastUserMessageRef.current) {
										sendMessage({ text: lastUserMessageRef.current });
									}
								}}
								className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/[0.08] border border-white/[0.1] text-white/70 hover:bg-white/[0.12] hover:text-white/90 transition-all"
							>
								<RefreshCw className="h-3 w-3" />
								Retry
							</button>
						)}
						<button
							type="button"
							onClick={() => {
								setErrorContext(null);
								setInput("continue building from where you stopped");
							}}
							className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/[0.08] border border-white/[0.1] text-white/70 hover:bg-white/[0.12] hover:text-white/90 transition-all"
						>
							<ArrowRight className="h-3 w-3" />
							Resume
						</button>
					</div>
				</div>
			)}
			{/* Fallback: simple error display when no error context parsed */}
			{error && !errorContext && (
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

			{/* Active agent indicator — compact bar when activation card has scrolled away */}
			{activeAgentId && AGENT_INFO[activeAgentId] && !activationCard && (
				<div className="px-4 py-1.5 flex items-center gap-2 bg-violet-500/[0.04] border-t border-violet-500/[0.1]">
					<div className="flex-shrink-0 w-4 h-4 rounded bg-violet-500/[0.12] flex items-center justify-center">
						<Bot className="h-2.5 w-2.5 text-violet-400" />
					</div>
					<span className="text-[11px] font-medium text-violet-300/80">
						{AGENT_INFO[activeAgentId].name}
					</span>
					<span className="text-[11px] text-white/25">active</span>
					<div className="flex-1" />
					<button
						type="button"
						onClick={handleAgentDeactivate}
						className="text-[11px] text-white/25 hover:text-white/60 px-2 py-0.5 rounded hover:bg-white/[0.06] transition-colors"
					>
						Switch to Auto
					</button>
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
					onAgentActivate={handleAgentActivate}
				/>
			</div>

			{/* GitHub sync bar */}
			<GitHubSyncBar appId={appId} onFilesChange={onFilesChange} />

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
				onInsertText={setInput}
				deepThinking={deepThinking}
				onDeepThinkingChange={handleDeepThinkingChange}
			/>

			{/* History Modal */}
			{showHistory && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
					onClick={(e) => { if (e.target === e.currentTarget) setShowHistory(false); }}
					onKeyDown={(e) => { if (e.key === "Escape") setShowHistory(false); }}
					role="dialog"
					aria-modal="true"
					aria-label="Development History"
				>
					<div className="bg-[#0f0f1a] border border-white/[0.1] rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
						<div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
							<div className="flex items-center gap-2.5">
								<Clock className="h-4.5 w-4.5 text-teal-400" />
								<h3 className="text-base font-medium text-white">Development History</h3>
							</div>
							<button
								type="button"
								onClick={() => setShowHistory(false)}
								className="p-1 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-white/70 transition-colors"
							>
								<X className="h-4 w-4" />
							</button>
						</div>

						<div className="flex-1 overflow-y-auto px-5 py-4">
							{historyLoading ? (
								<div className="flex items-center justify-center py-12">
									<Loader2 className="h-5 w-5 animate-spin text-white/30" />
								</div>
							) : historyEntries.length === 0 ? (
								<div className="text-center py-12">
									<Clock className="h-8 w-8 text-white/10 mx-auto mb-3" />
									<p className="text-sm text-white/30">No development history yet</p>
									<p className="text-xs text-white/15 mt-1">History is saved when you start a new chat</p>
								</div>
							) : (
								<div className="relative">
									{/* Timeline line */}
									<div className="absolute left-[11px] top-2 bottom-2 w-px bg-white/[0.06]" />

									<div className="flex flex-col gap-5">
										{historyEntries.map((entry) => {
											const date = new Date(entry.createdAt);
											const details = entry.details || {};
											const created = details.filesCreated || [];
											const modified = details.filesModified || [];
											const deleted = details.filesDeleted || [];
											const urls = details.urls || [];
											const userMsgs = details.userMessages || [];
											const msgCount = details.messageCount || 0;

											return (
												<div key={entry.id} className="relative pl-8 group">
													{/* Timeline dot */}
													<div className="absolute left-[7px] top-1.5 w-[9px] h-[9px] rounded-full bg-white/[0.15] border-2 border-[#0f0f1a] group-hover:bg-teal-400/50 transition-colors" />

													<div className="flex items-center gap-2 text-xs text-white/25 mb-1.5">
														<span>
															{date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
															{" "}
															{date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
														</span>
														{msgCount > 0 && (
															<span className="text-white/15">{msgCount} messages</span>
														)}
													</div>

													{/* URLs referenced */}
													{urls.length > 0 && (
														<div className="flex flex-wrap gap-1.5 mb-1.5">
															{urls.map((url) => (
																<a
																	key={url}
																	href={url}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="text-[11px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400/70 hover:text-violet-300 hover:bg-violet-500/20 transition-colors truncate max-w-[280px]"
																>
																	{url.replace(/^https?:\/\//, "")}
																</a>
															))}
														</div>
													)}

													{/* User messages */}
													{userMsgs.length > 0 ? (
														<div className="flex flex-col gap-1.5">
															{userMsgs.map((msg, i) => (
																<div key={i} className="text-[13px] text-white/60 leading-snug">
																	{userMsgs.length > 1 && (
																		<span className="text-white/25 text-[10px] mr-1">#{i + 1}</span>
																	)}
																	{msg.length > 200 ? `${msg.slice(0, 200)}...` : msg}
																</div>
															))}
														</div>
													) : (
														<p className="text-sm text-white/50 leading-snug">{entry.summary}</p>
													)}

													{/* File operation badges */}
													{(created.length > 0 || modified.length > 0 || deleted.length > 0) && (
														<div className="mt-2 flex flex-wrap gap-1.5">
															{created.length > 0 && (
																<span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400/60">
																	+{created.length} created
																</span>
															)}
															{modified.length > 0 && (
																<span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400/60">
																	~{modified.length} modified
																</span>
															)}
															{deleted.length > 0 && (
																<span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400/60">
																	-{deleted.length} deleted
																</span>
															)}
														</div>
													)}
												</div>
											);
										})}
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
