"use client";

import { createContext, createElement, useContext } from "react";
import type { VibexeClient } from "./vibexe-client";

const VibexeClientContext = createContext<VibexeClient | null>(null);

export function VibexeClientProvider({
	children,
	value,
}: React.PropsWithChildren<{ value: VibexeClient }>) {
	// Avoid JSX in a .ts module.
	return createElement(VibexeClientContext.Provider, { value }, children);
}

/**
 * Returns the injected `VibexeClient`.
 * No fallback: callers must be wrapped by `VibexeClientProvider`.
 */
export function useVibexe(): VibexeClient {
	const client = useContext(VibexeClientContext);
	if (!client) {
		throw new Error("Missing VibexeClientProvider in the tree");
	}
	return client;
}
