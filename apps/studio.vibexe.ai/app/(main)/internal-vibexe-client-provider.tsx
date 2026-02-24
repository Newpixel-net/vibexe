"use client";

import { VibexeClientProvider } from "@vibexe-ai/react";
import { useMemo } from "react";
import { createInternalVibexeClient } from "@/lib/internal-api/create-vibexe-client";

export function InternalVibexeClientProvider({
	children,
}: React.PropsWithChildren) {
	const client = useMemo(() => {
		return createInternalVibexeClient();
	}, []);

	return (
		<VibexeClientProvider value={client}>{children}</VibexeClientProvider>
	);
}
