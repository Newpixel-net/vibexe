"use client";

/**
 * SpeakButton — Browser TTS using SpeechSynthesis API.
 *
 * Reads aloud any text with a pleasant voice. Strips markdown formatting
 * before speaking so it sounds natural. Supports auto-play for trigger messages.
 */

import { Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface SpeakButtonProps {
	text: string;
	autoPlay?: boolean;
	className?: string;
}

/** Strip markdown syntax so spoken text sounds natural */
function stripMarkdown(md: string): string {
	return md
		// Remove images entirely
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, "")
		// Convert links to just the text
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		// Remove headings markers
		.replace(/^#{1,6}\s+/gm, "")
		// Remove bold/italic markers
		.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
		.replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
		// Remove inline code backticks
		.replace(/`([^`]+)`/g, "$1")
		// Remove code fences
		.replace(/```[\s\S]*?```/g, "")
		// Remove bullet points
		.replace(/^[\s]*[-*+]\s+/gm, "")
		// Remove numbered list markers
		.replace(/^[\s]*\d+\.\s+/gm, "")
		// Collapse multiple newlines into pause
		.replace(/\n{2,}/g, ". ")
		// Single newlines to space
		.replace(/\n/g, " ")
		// Collapse multiple spaces
		.replace(/\s{2,}/g, " ")
		.trim();
}

/** Pick the best English voice available */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
	const preferences = [
		(v: SpeechSynthesisVoice) => /Google UK English Female/i.test(v.name),
		(v: SpeechSynthesisVoice) => /Libby|Aria/i.test(v.name),
		(v: SpeechSynthesisVoice) => /Samantha/i.test(v.name),
		(v: SpeechSynthesisVoice) => v.lang.startsWith("en") && /female/i.test(v.name),
		(v: SpeechSynthesisVoice) => v.lang.startsWith("en"),
	];
	for (const test of preferences) {
		const match = voices.find(test);
		if (match) return match;
	}
	return voices[0];
}

export function SpeakButton({ text, autoPlay, className }: SpeakButtonProps) {
	const [isSpeaking, setIsSpeaking] = useState(false);
	const [isSupported, setIsSupported] = useState(false);
	const autoPlayedRef = useRef(false);
	const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

	useEffect(() => {
		setIsSupported(typeof window !== "undefined" && "speechSynthesis" in window);
	}, []);

	const speak = useCallback((txt: string) => {
		if (!isSupported) return;
		const synth = window.speechSynthesis;
		// Cancel any ongoing speech
		synth.cancel();

		const cleaned = stripMarkdown(txt);
		if (!cleaned) return;

		const utterance = new SpeechSynthesisUtterance(cleaned);
		utteranceRef.current = utterance;

		// Voice selection — voices may load async
		const voices = synth.getVoices();
		const voice = pickVoice(voices);
		if (voice) utterance.voice = voice;

		utterance.rate = 1.0;
		utterance.pitch = 1.0;

		utterance.onstart = () => setIsSpeaking(true);
		utterance.onend = () => setIsSpeaking(false);
		utterance.onerror = () => setIsSpeaking(false);

		synth.speak(utterance);
	}, [isSupported]);

	const stop = useCallback(() => {
		if (!isSupported) return;
		window.speechSynthesis.cancel();
		setIsSpeaking(false);
	}, [isSupported]);

	const handleClick = useCallback(() => {
		if (isSpeaking) {
			stop();
		} else {
			speak(text);
		}
	}, [isSpeaking, stop, speak, text]);

	// Auto-play: trigger once when autoPlay becomes true
	useEffect(() => {
		if (autoPlay && !autoPlayedRef.current && isSupported && text) {
			autoPlayedRef.current = true;
			// Small delay to let voices load
			const timer = setTimeout(() => speak(text), 300);
			return () => clearTimeout(timer);
		}
	}, [autoPlay, isSupported, text, speak]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			window.speechSynthesis?.cancel();
		};
	}, []);

	if (!isSupported) return null;

	return (
		<button
			type="button"
			onClick={handleClick}
			className={cn(
				"relative p-1 rounded-md transition-colors",
				isSpeaking
					? "text-teal-400 hover:text-teal-300"
					: "text-white/20 hover:text-white/60",
				className,
			)}
			aria-label={isSpeaking ? "Stop speaking" : "Read aloud"}
			title={isSpeaking ? "Stop speaking" : "Read aloud"}
		>
			{isSpeaking ? (
				<>
					<VolumeX className="h-4 w-4" />
					{/* Animated pulse ring */}
					<span className="absolute inset-0 rounded-md border border-teal-400/40 animate-ping opacity-30" />
				</>
			) : (
				<Volume2 className="h-4 w-4" />
			)}
		</button>
	);
}

/** Shared speak function for use outside the button (e.g. dropdown menu) */
export function speakText(text: string) {
	if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
	const synth = window.speechSynthesis;
	synth.cancel();
	const cleaned = stripMarkdown(text);
	if (!cleaned) return;
	const utterance = new SpeechSynthesisUtterance(cleaned);
	const voice = pickVoice(synth.getVoices());
	if (voice) utterance.voice = voice;
	utterance.rate = 1.0;
	utterance.pitch = 1.0;
	synth.speak(utterance);
}
