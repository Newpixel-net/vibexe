import useSWR from "swr";
import { useAppDesignerStore } from "../../app-designer";
import { useVibexe } from "../../app-designer/store/vibexe-client-provider";
export function useWorkspaceSecrets(tags?: string[]) {
	const workspaceId = useAppDesignerStore((s) => s.workspaceId);
	const client = useVibexe();
	return useSWR(
		{
			namespace: "get-workspace-secrets",
			workspaceId,
			tags: tags ?? [],
		},
		({ workspaceId, tags }) =>
			client
				.getWorkspaceSecrets({ workspaceId, tags })
				.then((res) => res.secrets),
	);
}
