import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Typewriter hook that cycles through placeholder strings.
 *
 * State machine: TYPING → PAUSING → DELETING → WAITING → TYPING (next string)
 *
 * Respects prefers-reduced-motion by showing full string immediately.
 */
export function useTypewriter(
	strings: string[],
	opts?: {
		typeSpeed?: number;
		deleteSpeed?: number;
		pauseMs?: number;
		waitMs?: number;
	},
) {
	const {
		typeSpeed = 45,
		deleteSpeed = 25,
		pauseMs = 2000,
		waitMs = 400,
	} = opts ?? {};

	const [text, setText] = useState("");
	const [showCursor, setShowCursor] = useState(true);
	const indexRef = useRef(0);
	const phaseRef = useRef<"typing" | "pausing" | "deleting" | "waiting">("typing");
	const charRef = useRef(0);
	const rafRef = useRef<ReturnType<typeof setTimeout>>();

	const tick = useCallback(() => {
		if (strings.length === 0) return;
		const current = strings[indexRef.current % strings.length];

		switch (phaseRef.current) {
			case "typing": {
				if (charRef.current < current.length) {
					charRef.current++;
					setText(current.slice(0, charRef.current));
					rafRef.current = setTimeout(tick, typeSpeed);
				} else {
					phaseRef.current = "pausing";
					rafRef.current = setTimeout(tick, pauseMs);
				}
				break;
			}
			case "pausing": {
				phaseRef.current = "deleting";
				rafRef.current = setTimeout(tick, deleteSpeed);
				break;
			}
			case "deleting": {
				if (charRef.current > 0) {
					charRef.current--;
					setText(current.slice(0, charRef.current));
					rafRef.current = setTimeout(tick, deleteSpeed);
				} else {
					phaseRef.current = "waiting";
					rafRef.current = setTimeout(tick, waitMs);
				}
				break;
			}
			case "waiting": {
				indexRef.current = (indexRef.current + 1) % strings.length;
				charRef.current = 0;
				phaseRef.current = "typing";
				rafRef.current = setTimeout(tick, typeSpeed);
				break;
			}
		}
	}, [strings, typeSpeed, deleteSpeed, pauseMs, waitMs]);

	useEffect(() => {
		// Respect reduced motion
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		if (mq.matches) {
			setText(strings[0] ?? "");
			setShowCursor(false);
			return;
		}

		// Reset on strings change
		indexRef.current = 0;
		charRef.current = 0;
		phaseRef.current = "typing";
		setText("");
		rafRef.current = setTimeout(tick, 500); // small initial delay

		return () => {
			if (rafRef.current) clearTimeout(rafRef.current);
		};
	}, [strings, tick]);

	return { text, showCursor };
}
