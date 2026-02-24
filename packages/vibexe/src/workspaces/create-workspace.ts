import { generateInitialWorkspace, Workspace } from "@vibexe-ai/protocol";
import type { VibexeContext } from "../types";
import { setWorkspace } from "./utils";

export async function createWorkspace(args: { context: VibexeContext }) {
	const workspace = generateInitialWorkspace();
	await setWorkspace({
		workspaceId: workspace.id,
		workspace: Workspace.parse(workspace),
		context: args.context,
	});
	return workspace;
}
