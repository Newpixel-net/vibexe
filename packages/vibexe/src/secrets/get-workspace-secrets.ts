import { SecretIndex, type WorkspaceId } from "@vibexe-ai/protocol";
import type { VibexeContext } from "../types";
import { getWorkspaceIndex } from "../utils/workspace-index";
import { workspaceSecretIndexPath } from "./paths";

export async function getWorkspaceSecrets(args: {
	context: VibexeContext;
	workspaceId: WorkspaceId;
	tags?: string[];
}) {
	const { context, workspaceId, tags } = args;
	const secrets = await getWorkspaceIndex({
		context,
		indexPath: workspaceSecretIndexPath(workspaceId),
		itemSchema: SecretIndex,
	});

	if (tags === undefined || tags.length === 0) {
		return secrets;
	}

	return secrets.filter((secret) => {
		const secretTags = secret.tags ?? [];
		return tags?.every((tag) => secretTags.includes(tag));
	});
}
