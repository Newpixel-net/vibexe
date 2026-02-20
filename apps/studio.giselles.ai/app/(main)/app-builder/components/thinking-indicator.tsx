"use client";

/**
 * ThinkingIndicator — Aurora Glass Design
 *
 * Glass pill with gradient shimmer effect.
 */

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

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
	visible: boolean;
}

export function ThinkingIndicator({ visible }: ThinkingIndicatorProps) {
	const [phraseIndex, setPhraseIndex] = useState(0);

	useEffect(() => {
		if (!visible) {
			setPhraseIndex(0);
			return;
		}

		const interval = setInterval(() => {
			setPhraseIndex((prev) => (prev + 1) % THINKING_PHRASES.length);
		}, 2000);

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
					{/* Glass pill container with shimmer */}
					<div
						className="relative flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] overflow-hidden"
					>
						{/* Shimmer sweep effect */}
						<div
							className="absolute inset-0 pointer-events-none"
							style={{
								background: "linear-gradient(90deg, transparent 0%, rgba(124,58,237,0.06) 50%, transparent 100%)",
								backgroundSize: "200% 100%",
								animation: "shimmer-sweep 3s ease-in-out infinite",
							}}
						/>

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
							<Sparkles className="size-3 text-teal-400" style={{ filter: "drop-shadow(0 0 4px rgba(20,184,166,0.4))" }} />
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
								className="text-sm text-white/50 font-medium flex items-center gap-1 relative z-10"
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
					</div>
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
					className="w-1.5 h-1.5 rounded-full bg-white/40"
				/>
			))}
		</span>
	);
}
