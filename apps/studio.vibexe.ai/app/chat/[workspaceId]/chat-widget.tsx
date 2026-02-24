"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Message {
	id: string;
	role: "user" | "assistant";
	content: string;
	timestamp: number;
}

interface WidgetConfig {
	title: string;
	placeholder: string;
	primaryColor: string;
	welcomeMessage?: string;
}

function generateId() {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ChatWidget({ workspaceId }: { workspaceId: string }) {
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [config, setConfig] = useState<WidgetConfig>({
		title: "Chat with AI",
		placeholder: "Type your message...",
		primaryColor: "#6366f1",
	});
	const [sessionId] = useState(() => {
		if (typeof window !== "undefined") {
			const stored = localStorage.getItem(`chat-session-${workspaceId}`);
			if (stored) return stored;
			const newId = generateId();
			localStorage.setItem(`chat-session-${workspaceId}`, newId);
			return newId;
		}
		return generateId();
	});

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	// Load widget config
	useEffect(() => {
		fetch(`/api/chat/${workspaceId}`)
			.then((res) => res.json())
			.then((data) => {
				if (data.config) {
					setConfig(data.config);
					if (data.config.welcomeMessage && messages.length === 0) {
						setMessages([
							{
								id: generateId(),
								role: "assistant",
								content: data.config.welcomeMessage,
								timestamp: Date.now(),
							},
						]);
					}
				}
			})
			.catch(() => {
				// Use defaults
			});
	}, [workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

	// Auto-scroll to bottom
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	const sendMessage = useCallback(async () => {
		const trimmed = input.trim();
		if (!trimmed || isLoading) return;

		const userMessage: Message = {
			id: generateId(),
			role: "user",
			content: trimmed,
			timestamp: Date.now(),
		};

		setMessages((prev) => [...prev, userMessage]);
		setInput("");
		setIsLoading(true);

		try {
			const response = await fetch(`/api/chat/${workspaceId}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sessionId,
					message: trimmed,
				}),
			});

			if (!response.ok) {
				throw new Error("Failed to send message");
			}

			const reader = response.body?.getReader();
			if (!reader) throw new Error("No response stream");

			const decoder = new TextDecoder();
			let assistantContent = "";
			const assistantId = generateId();

			// Add placeholder assistant message
			setMessages((prev) => [
				...prev,
				{
					id: assistantId,
					role: "assistant",
					content: "",
					timestamp: Date.now(),
				},
			]);

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const text = decoder.decode(value, { stream: true });
				const lines = text.split("\n");

				for (const line of lines) {
					if (line.startsWith("data: ")) {
						try {
							const data = JSON.parse(line.slice(6));
							if (data.type === "message") {
								assistantContent = data.content;
								setMessages((prev) =>
									prev.map((msg) =>
										msg.id === assistantId
											? { ...msg, content: assistantContent }
											: msg,
									),
								);
							} else if (data.type === "error") {
								assistantContent = data.message;
								setMessages((prev) =>
									prev.map((msg) =>
										msg.id === assistantId
											? { ...msg, content: assistantContent }
											: msg,
									),
								);
							}
						} catch {
							// Not valid JSON
						}
					}
				}
			}
		} catch (error) {
			setMessages((prev) => [
				...prev,
				{
					id: generateId(),
					role: "assistant",
					content: "Sorry, something went wrong. Please try again.",
					timestamp: Date.now(),
				},
			]);
		} finally {
			setIsLoading(false);
			inputRef.current?.focus();
		}
	}, [input, isLoading, workspaceId, sessionId]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				sendMessage();
			}
		},
		[sendMessage],
	);

	return (
		<div
			className="flex flex-col h-screen bg-black text-white"
			style={
				{
					"--chat-primary": config.primaryColor,
				} as React.CSSProperties
			}
		>
			{/* Header */}
			<div
				className="flex items-center gap-3 px-4 py-3 border-b border-white/10"
				style={{ backgroundColor: `${config.primaryColor}15` }}
			>
				<div
					className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
					style={{ backgroundColor: config.primaryColor }}
				>
					AI
				</div>
				<div>
					<h1 className="text-sm font-semibold">{config.title}</h1>
					<p className="text-[10px] text-white/40">Powered by Vibexe</p>
				</div>
			</div>

			{/* Messages */}
			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				{messages.length === 0 && !config.welcomeMessage && (
					<div className="flex items-center justify-center h-full text-white/30 text-sm">
						Send a message to start the conversation
					</div>
				)}
				{messages.map((msg) => (
					<div
						key={msg.id}
						className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
					>
						<div
							className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
								msg.role === "user"
									? "text-white"
									: "bg-white/5 text-white/90"
							}`}
							style={
								msg.role === "user"
									? { backgroundColor: config.primaryColor }
									: undefined
							}
						>
							{msg.content || (
								<span className="flex items-center gap-1 text-white/40">
									<span className="inline-block w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:0ms]" />
									<span className="inline-block w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:150ms]" />
									<span className="inline-block w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:300ms]" />
								</span>
							)}
						</div>
					</div>
				))}
				<div ref={messagesEndRef} />
			</div>

			{/* Input */}
			<div className="border-t border-white/10 p-3">
				<div className="flex items-end gap-2">
					<textarea
						ref={inputRef}
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder={config.placeholder}
						disabled={isLoading}
						rows={1}
						className="flex-1 resize-none bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/20 disabled:opacity-50"
						style={{
							minHeight: "40px",
							maxHeight: "120px",
						}}
						onInput={(e) => {
							const target = e.target as HTMLTextAreaElement;
							target.style.height = "40px";
							target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
						}}
					/>
					<button
						type="button"
						onClick={sendMessage}
						disabled={isLoading || !input.trim()}
						className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white transition-opacity disabled:opacity-30"
						style={{ backgroundColor: config.primaryColor }}
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 16 16"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<title>Send</title>
							<path
								d="M14.5 1.5L7 9M14.5 1.5L10 14.5L7 9M14.5 1.5L1.5 6L7 9"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</button>
				</div>
			</div>
		</div>
	);
}
