import { useCallback } from "react";
import { useVibexe } from "../vibexe-client-provider";
import { useAppDesignerStore } from "../hooks";

export function useAddSecret() {
	const client = useVibexe();
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);

	return useCallback(
		async (args: { label: string; value: string }) => {
			return await client.addSecret({
				workspaceId,
				label: args.label,
				value: args.value,
			});
		},
		[client, workspaceId],
	);
}
