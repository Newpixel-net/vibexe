import type { Workspace } from "@vibexe-ai/protocol";
import type { VibexeContext } from "../types";
import { setWorkspace } from "./utils";

export async function updateWorkspace(args: {
	context: VibexeContext;
	workspace: Workspace;
}) {
	await setWorkspace({
		workspaceId: args.workspace.id,
		workspace: args.workspace,
		context: args.context,
	});
	return args.workspace;
}
