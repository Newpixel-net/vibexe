import type { WorkspaceId } from "@vibexe-ai/protocol";
import type { VibexeContext } from "../types";
import { getWorkspace as getWorkspaceInternal } from "./utils";

export async function getWorkspace(args: {
	context: VibexeContext;
	workspaceId: WorkspaceId;
}) {
	return await getWorkspaceInternal({
		context: args.context,
		workspaceId: args.workspaceId,
	});
}
