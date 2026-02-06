"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Phrases cycled through during AI thinking
 */
const THINKING_PHRASES = [
	"Thinking",
	"Ideating",
	"Planning",
	"Designing",
	"Crafting",
	"Architecting",
	"Conceptualizing",
	"Envisioning",
	"Strategizing",
	"Formulating",
	"Contemplating",
	"Analyzing",
	"Brainstorming",
	"Sketching",
	"Exploring",
	"Imagining",
	"Structuring",
	"Orchestrating",
	"Composing",
	"Refining",
];

interface ThinkingIndicatorProps {
	/** Whether the indicator is visible */
	visible: boolean;
}

/**
 * Animated thinking indicator with rotating phrases.
 * Shows a sparkle icon with cycling "Thinking...", "Planning...", etc.
 */
export function ThinkingIndicator({ visible }: ThinkingIndicatorProps) {
	const [phraseIndex, setPhraseIndex] = useState(0);

	useEffect(() => {
		if (!visible) {
			setPhraseIndex(0);
			return;
		}

		const interval = setInterval(() => {
			setPhraseIndex((prev) => (prev + 1) % THINKING_PHRASES.length);
		}, 2000); // Change phrase every 2 seconds

		return () => clearInterval(interval);
	}, [visible]);

	if (!visible) return null;

	return (
		<AnimatePresence>
			{visible && (
				<motion.div
					initial={{ opacity: 0, y: 10, scale: 0.95 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: -10, scale: 0.95 }}
					transition={{
						duration: 0.4,
						ease: [0.23, 1, 0.32, 1],
					}}
					className="flex items-center gap-2 mt-3"
				>
					<motion.div
						animate={{
							rotate: [0, 360],
							scale: [1, 1.1, 1],
						}}
						transition={{
							rotate: { duration: 3, repeat: Infinity, ease: "linear" },
							scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
						}}
					>
						<Sparkles className="size-3 text-orange-400" />
					</motion.div>
					<AnimatePresence mode="wait">
						<motion.span
							key={phraseIndex}
							initial={{ opacity: 0, x: -10 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: 10 }}
							transition={{
								duration: 0.3,
								ease: [0.23, 1, 0.32, 1],
							}}
							className="text-sm text-muted-foreground font-medium flex items-center gap-1"
						>
							{THINKING_PHRASES[phraseIndex]}
							<motion.span
								animate={{ opacity: [1, 0.3, 1] }}
								transition={{ duration: 1.5, repeat: Infinity }}
								className="inline-block"
							>
								...
							</motion.span>
						</motion.span>
					</AnimatePresence>
				</motion.div>
			)}
		</AnimatePresence>
	);
}

/**
 * Simple inline thinking dots for compact spaces
 */
export function ThinkingDots() {
	return (
		<span className="inline-flex items-center gap-0.5">
			{[0, 1, 2].map((i) => (
				<motion.span
					key={i}
					animate={{ opacity: [0.3, 1, 0.3] }}
					transition={{
						duration: 1.2,
						repeat: Infinity,
						delay: i * 0.2,
					}}
					className="w-1.5 h-1.5 rounded-full bg-muted-foreground"
				/>
			))}
		</span>
	);
}
