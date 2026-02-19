"use client";

/**
 * VoiceInputButton Component
 *
 * Browser-native speech recognition using Web Speech API.
 * Pulsing red ring while listening, returns transcript via callback.
 * Falls back to disabled state with tooltip if API unavailable.
 */

import { Mic } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface VoiceInputButtonProps {
	onTranscript?: (text: string) => void;
	className?: string;
}

// Web Speech API types (not in all TS libs)
interface SpeechRecognitionEvent extends Event {
	results: SpeechRecognitionResultList;
	resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
	error: string;
}

export function VoiceInputButton({ onTranscript, className }: VoiceInputButtonProps) {
	const [isListening, setIsListening] = useState(false);
	const [isSupported, setIsSupported] = useState(false);
	const recognitionRef = useRef<ReturnType<typeof createRecognition> | null>(null);

	useEffect(() => {
		const supported = typeof window !== "undefined" &&
			("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
		setIsSupported(supported);
	}, []);

	const handleClick = useCallback(() => {
		if (!isSupported || !onTranscript) return;

		if (isListening) {
			// Stop
			recognitionRef.current?.stop();
			setIsListening(false);
			return;
		}

		// Start
		const recognition = createRecognition();
		if (!recognition) return;

		recognition.continuous = false;
		recognition.interimResults = false;
		recognition.lang = "en-US";

		recognition.onresult = (event: SpeechRecognitionEvent) => {
			const last = event.results[event.results.length - 1];
			if (last?.isFinal) {
				const transcript = last[0]?.transcript?.trim();
				if (transcript) {
					onTranscript(transcript);
				}
			}
		};

		recognition.onend = () => {
			setIsListening(false);
			recognitionRef.current = null;
		};

		recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
			if (event.error !== "aborted") {
				console.warn("[Voice] Speech recognition error:", event.error);
			}
			setIsListening(false);
			recognitionRef.current = null;
		};

		recognitionRef.current = recognition;
		recognition.start();
		setIsListening(true);
	}, [isListening, isSupported, onTranscript]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			recognitionRef.current?.stop();
		};
	}, []);

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={!isSupported}
			className={cn(
				className,
				isListening && "relative text-red-500 hover:text-red-400",
			)}
			aria-label={isListening ? "Stop recording" : "Voice input"}
			title={
				!isSupported
					? "Voice input not supported in this browser"
					: isListening
						? "Click to stop recording"
						: "Click to start voice input"
			}
		>
			<Mic className="h-4 w-4 shrink-0" />
			{/* Pulsing ring while listening */}
			{isListening && (
				<span className="absolute inset-0 rounded-md border-2 border-red-500 animate-ping opacity-50" />
			)}
		</button>
	);
}

/** Create a SpeechRecognition instance (cross-browser) */
function createRecognition() {
	const W = window as unknown as Record<string, unknown>;
	const SpeechRecognition = W.SpeechRecognition || W.webkitSpeechRecognition;
	if (!SpeechRecognition) return null;
	return new (SpeechRecognition as new () => {
		continuous: boolean;
		interimResults: boolean;
		lang: string;
		onresult: ((event: SpeechRecognitionEvent) => void) | null;
		onend: (() => void) | null;
		onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
		start: () => void;
		stop: () => void;
	})();
}
