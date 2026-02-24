import type { FileId, WorkspaceId } from "@vibexe-ai/protocol";
import type { VibexeStorage } from "@vibexe-ai/storage";
import { filePath } from "./utils";

export async function removeFile(args: {
	storage: VibexeStorage;
	workspaceId: WorkspaceId;
	fileId: FileId;
}) {
	const path = filePath({
		type: "studio",
		workspaceId: args.workspaceId,
		fileId: args.fileId,
	});
	await args.storage.remove(path);
}
