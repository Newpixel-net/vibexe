"use client";

import type { VibexeClient } from "@vibexe-ai/react";
import { createContext, useContext } from "react";

const VibexeClientContext = createContext<VibexeClient | null>(null);

export function VibexeClientProvider({
	children,
	value,
}: React.PropsWithChildren<{ value: VibexeClient }>) {
	return (
		<VibexeClientContext.Provider value={value}>
			{children}
		</VibexeClientContext.Provider>
	);
}

/**
 * Returns the Vibexe API client injected at the app-designer root.
 *
 * Note: this intentionally uses the same name as `@vibexe-ai/react`'s hook,
 * but is scoped to `app-designer/store`.
 */
export function useVibexe(): VibexeClient {
	const client = useContext(VibexeClientContext);
	if (!client) {
		throw new Error("Missing VibexeClientProvider in the tree");
	}
	return client;
}
